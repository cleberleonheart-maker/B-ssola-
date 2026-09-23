import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { formatDistance, haversine, initialBearing, normalizeAzimuth } from '../utils/geo';
import { serializeTrackToGpx } from '../utils/gpx';
import { shareTrackGpx } from '../services/trackShare';
import TargetNavBar from './TargetNavBar';
import type { LocationFix } from '../services/locationService';
import {
  loadTracks,
  saveTrack,
  deleteTrack,
  createTrackId,
  computeTrackStats,
  simplifyPath,
  formatDuration,
  type TrackPoint,
  type RecordedTrack,
} from '../services/trackService';
import { ensureCloudUser, pushTracks } from '../services/cloud';

const MIN_SEGMENT_M = 3;
const MIN_GAP_MS = 1000;
const ARRIVE_BACK_METERS = 15;

type Props = {
  active: boolean;
  location: LocationFix;
  heading?: number;
};

type DrawPoint = { x: number; y: number; alt: number | null };

const TrackView = ({ active, location, heading = 0 }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [saved, setSaved] = useState<RecordedTrack[]>([]);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);
  const [navId, setNavId] = useState<string | 'live' | null>(null);

  const pointsRef = useRef<TrackPoint[]>([]);
  const lastPtRef = useRef<TrackPoint | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadTracks().then(setSaved);
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    return () => {};
  }, [active]);

  const start = useCallback(() => {
    if (!location || (location.latitude === 0 && location.longitude === 0)) {
      return;
    }
    const first: TrackPoint = {
      lat: location.latitude,
      lon: location.longitude,
      alt: location.altitude,
      ts: Date.now(),
    };
    pointsRef.current = [first];
    lastPtRef.current = first;
    startedAtRef.current = Date.now();
    setPoints([first]);
    setRecording(true);
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAtRef.current);
    }, 1000);
  }, [location]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const pts = pointsRef.current;
    setRecording(false);
    if (pts.length < 2) {
      return;
    }
    const stats = computeTrackStats(pts);
    const d = new Date();
    const track: RecordedTrack = {
      id: createTrackId(),
      name: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      startedAt: pts[0].ts,
      endedAt: pts[pts.length - 1].ts,
      points: pts,
      ...stats,
    };
    saveTrack(track).then(setSaved);
    pointsRef.current = [];
    lastPtRef.current = null;
    setPoints([]);
    setElapsed(0);
  }, []);

  const discard = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    pointsRef.current = [];
    lastPtRef.current = null;
    setPoints([]);
    setRecording(false);
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (!recording || !location) {
      return;
    }
    if (location.latitude === 0 && location.longitude === 0) {
      return;
    }
    const now = Date.now();
    const last = lastPtRef.current;
    if (last) {
      const d = Math.hypot(
        (last.lat - location.latitude) * 111000,
        (last.lon - location.longitude) * 111000 * Math.cos((location.latitude * Math.PI) / 180),
      );
      if (d < MIN_SEGMENT_M || now - last.ts < MIN_GAP_MS) {
        return;
      }
    }
    const pt: TrackPoint = {
      lat: location.latitude,
      lon: location.longitude,
      alt: location.altitude,
      ts: now,
    };
    lastPtRef.current = pt;
    pointsRef.current = [...pointsRef.current, pt];
    setPoints(pointsRef.current);
  }, [location, recording]);

  const liveStats = useMemo(() => computeTrackStats(points), [points]);

  const hasFix = location.latitude !== 0 || location.longitude !== 0;

  const drawPoints = useMemo(() => {
    const pts = points.length > 0 ? points : saved[0]?.points ?? [];
    if (pts.length === 0) return [] as DrawPoint[];
    const simplified = simplifyPath(pts, 0.00002);
    const maxDraw = 500;
    const step = Math.max(1, Math.ceil(simplified.length / maxDraw));
    const drawn = simplified.filter((_, i) => i % step === 0 || i === simplified.length - 1);
    const lats = drawn.map(p => p.lat);
    const lons = drawn.map(p => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latSpan = Math.max(maxLat - minLat, 1e-6);
    const lonSpan = Math.max(maxLon - minLon, 1e-6);
    const pad = 0.1;
    const padLat = latSpan * pad;
    const padLon = lonSpan * pad;
    const totalLat = latSpan + padLat * 2;
    const totalLon = lonSpan + padLon * 2;
    const canvas = 280;
    const scale = Math.min(canvas / totalLon, canvas / totalLat) * 2.04;
    return drawn.map((p, i) => ({
      x: (p.lon - minLon + padLon) * scale,
      y: (maxLat + padLat - p.lat) * scale,
      alt: p.alt,
      i,
    })) as (DrawPoint & { i: number })[];
  }, [points, saved]);

  const segments = useMemo(() => {
    const out: { x: number; y: number; w: number; a: number }[] = [];
    for (let i = 1; i < drawPoints.length; i++) {
      const a = drawPoints[i - 1];
      const b = drawPoints[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      out.push({ x: (a.x + b.x) / 2 - len / 2, y: (a.y + b.y) / 2 - 1, w: len, a: angle });
    }
    return out;
  }, [drawPoints]);

  const removeTrack = useCallback(async (id: string) => {
    const next = await deleteTrack(id);
    setSaved(next);
    setCloudMsg(null);
    if (navId === id) {
      setNavId(null);
    }
  }, [navId]);

  const uploadTrack = useCallback(async (track: RecordedTrack) => {
    try {
      const userId = await ensureCloudUser();
      if (!userId) {
        setCloudMsg(t('track_cloud_disabled'));
        return;
      }
      const ok = await pushTracks(userId, [
        {
          id: track.id,
          data: {
            name: track.name,
            startedAt: track.startedAt,
            endedAt: track.endedAt,
            points: track.points,
            distance: track.distance,
            eleGain: track.eleGain,
            eleLoss: track.eleLoss,
          },
        },
      ]);
      setCloudMsg(ok ? t('track_cloud_ok') : t('track_cloud_fail'));
    } catch {
      setCloudMsg(t('track_cloud_fail'));
    }
  }, [t]);

  const exportTrack = useCallback(async (track: RecordedTrack) => {
    try {
      const ok = await shareTrackGpx(
        track.name,
        serializeTrackToGpx({
          ...track,
          points: simplifyPath(track.points, 0.00002),
        }),
      );
      setCloudMsg(ok ? t('track_gpx_ok') : t('track_cloud_fail'));
    } catch {
      setCloudMsg(t('track_cloud_fail'));
    }
  }, [t]);

  const navTrack: RecordedTrack | 'live' | null =
    navId === 'live' ? 'live' : saved.find(tr => tr.id === navId) ?? null;
  const navActive = navId !== null && !!navTrack;

  const navPath = useMemo(() => {
    const src = navTrack === 'live' ? points : navTrack ? navTrack.points : [];
    return simplifyPath(src).slice().reverse();
  }, [navTrack, points]);

  const navTarget = useMemo(() => {
    if (!navTrack || navPath.length === 0 || !hasFix) {
      return null;
    }
    const meLat = location.latitude;
    const meLon = location.longitude;
    const home = navPath[navPath.length - 1];
    const total = haversine(meLat, meLon, home.lat, home.lon);
    const arrived = total <= ARRIVE_BACK_METERS;
    let best = 0;
    let bestD = Infinity;
    const quick = (i: number) => {
      const p = navPath[i];
      const dy = (p.lat - meLat) * 111000;
      const dx =
        (p.lon - meLon) * 111000 * Math.cos((meLat * Math.PI) / 180);
      return Math.hypot(dx, dy);
    };
    for (let i = 0; i < navPath.length; i++) {
      const d = quick(i);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const aimIndex = Math.min(best + 1, navPath.length - 1);
    const aim = arrived ? home : navPath[aimIndex];
    const distance = arrived
      ? total
      : haversine(meLat, meLon, aim.lat, aim.lon);
    const bearing = initialBearing(meLat, meLon, aim.lat, aim.lon);
    const relative = normalizeAzimuth(bearing - heading);
    return { arrived, distance, relative };
  }, [navTrack, navPath, location.latitude, location.longitude, heading, hasFix]);

  const startNav = useCallback((target: string | 'live') => {
    setNavId(prev => (prev === target ? null : target));
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <Text style={[styles.emoji, { fontSize: 34 }]}>🥾</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('track_title')}
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('track_hint')}
        </Text>
      </View>

      <View style={[styles.card, { borderColor: colors.primary + '44' }]}>
        {hasFix ? (
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('track_dist')}
              </Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {formatDistance(liveStats.distance)}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('track_time')}
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {recording ? formatDuration(elapsed) : '—'}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('track_gain')}
              </Text>
              <Text style={[styles.statValue, { color: colors.success }]}>
                +{liveStats.eleGain} m
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('track_loss')}
              </Text>
              <Text style={[styles.statValue, { color: colors.north }]}>
                -{liveStats.eleLoss} m
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.noFix, { color: colors.textMuted }]}>
            {t('track_no_gps')}
          </Text>
        )}

        {points.length >= 2 && (
          <View style={styles.canvas}>
            {segments.map((seg, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: seg.x,
                  top: seg.y,
                  width: Math.max(seg.w, 2),
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: colors.primary,
                  transform: [{ rotate: `${seg.a}deg` }],
                }}
              />
            ))}
            {drawPoints.length > 0 && (
              <>
                <View
                  style={[
                    styles.dot,
                    {
                      left: drawPoints[0].x - 4,
                      top: drawPoints[0].y - 4,
                      backgroundColor: colors.success,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.dot,
                    {
                      left: drawPoints[drawPoints.length - 1].x - 4,
                      top: drawPoints[drawPoints.length - 1].y - 4,
                      backgroundColor: colors.north,
                    },
                  ]}
                />
              </>
            )}
          </View>
        )}

        {navActive && navPath.length >= 2 ? (
          <View style={styles.navWrap}>
            <TargetNavBar
              name={`🏠 ${navTrack === 'live' ? t('track_back_live') : navTrack ? navTrack.name : ''}`}
              distance={navTarget ? navTarget.distance : 0}
              relative={navTarget ? navTarget.relative : 0}
              arrived={navTarget ? navTarget.arrived : false}
            />
            <Pressable
              onPress={() => setNavId(null)}
              style={[styles.navStop, { borderColor: colors.border }]}>
              <Text style={[styles.navStopText, { color: colors.danger }]}>
                {t('track_back_stop')}
              </Text>
            </Pressable>
          </View>
        ) : (
          navActive && (
            <Text style={[styles.navHint, { color: colors.textMuted }]}>
              {t('track_back_hint')}
            </Text>
          )
        )}

        <View style={styles.controls}>
          {!recording ? (
            <Pressable
              onPress={start}
              disabled={!hasFix}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: hasFix ? colors.primary : colors.surfaceAlt,
                },
              ]}>
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: hasFix ? colors.background : colors.textMuted },
                ]}>
                {t('track_start')}
              </Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={stop}
                style={[styles.primaryButton, { backgroundColor: colors.success }]}>
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                  {t('track_stop')}
                </Text>
              </Pressable>
              <Pressable
                onPress={discard}
                style={[styles.secondaryButton, { borderColor: colors.border }]}>
                <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>
                  {t('track_discard')}
                </Text>
              </Pressable>
              {points.length >= 2 && navActive && (
                <Pressable
                  onPress={() => startNav('live')}
                  style={[
                    styles.secondaryButton,
                    { borderColor: navId === 'live' ? colors.success : colors.border },
                  ]}>
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: navId === 'live' ? colors.success : colors.north },
                    ]}>
                    {navId === 'live' ? t('track_back_stop') : t('track_back_live_start')}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>

      {saved.length > 0 && (
        <View style={[styles.savedCard, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('track_saved')}
          </Text>

          {saved.map(track => (
            <View
              key={track.id}
              style={[styles.savedRow, { borderColor: colors.border }]}>
              <View style={styles.savedInfo}>
                <Text style={[styles.savedName, { color: colors.text }]}>
                  {track.name}
                </Text>
                <Text style={[styles.savedMeta, { color: colors.textMuted }]}>
                  {formatDistance(track.distance)} · {formatDuration(track.endedAt - track.startedAt)}{' '}
                  · +{track.eleGain}/-{track.eleLoss} m
                </Text>
              </View>
              <Pressable
                onPress={() => uploadTrack(track)}
                style={[styles.smallButton, { borderColor: colors.primary }]}>
                <Text style={[styles.smallButtonText, { color: colors.primary }]}>
                  {t('track_upload')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => exportTrack(track)}
                style={[styles.smallButton, { borderColor: colors.accent }]}>
                <Text style={[styles.smallButtonText, { color: colors.accent }]}>
                  {t('track_gpx')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => startNav(track.id)}
                style={[
                  styles.smallButton,
                  { borderColor: navId === track.id ? colors.success : colors.north },
                ]}>
                <Text
                  style={[
                    styles.smallButtonText,
                    { color: navId === track.id ? colors.success : colors.north },
                  ]}>
                  {navId === track.id ? t('track_back_stop') : `← ${t('track_back')}`}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => removeTrack(track.id)}
                style={[styles.smallButton, { borderColor: colors.danger }]}>
                <Text style={[styles.smallButtonText, { color: colors.danger }]}>
                  {t('track_delete')}
                </Text>
              </Pressable>
            </View>
          ))}

          {cloudMsg && (
            <Text style={[styles.cloudMsg, { color: colors.primary }]}>
              {cloudMsg}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const createStyles = (colors: {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  accent: string;
  success: string;
  danger: string;
  north: string;
  border: string;
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg,
    },
    intro: {
      alignItems: 'center',
      marginVertical: spacing.md,
    },
    emoji: {
      marginBottom: spacing.xs,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
    },
    hint: {
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    card: {
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surface + 'B3',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    statCell: {
      width: '50%',
      paddingVertical: spacing.sm,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '900',
      marginTop: 2,
    },
    noFix: {
      textAlign: 'center',
      paddingVertical: spacing.md,
      fontSize: 13,
    },
    canvas: {
      width: 280,
      height: 168,
      alignSelf: 'center',
      marginVertical: spacing.md,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dot: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    navWrap: {
      marginTop: spacing.md,
    },
    navHint: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: spacing.md,
    },
    navStop: {
      alignSelf: 'center',
      borderRadius: radius.full,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      marginTop: spacing.sm,
    },
    navStopText: {
      fontSize: 12,
      fontWeight: '800',
    },
    primaryButton: {
      borderRadius: radius.full,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      marginHorizontal: spacing.xs,
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '800',
    },
    secondaryButton: {
      borderRadius: radius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderWidth: 1,
      marginHorizontal: spacing.xs,
    },
    secondaryButtonText: {
      fontSize: 14,
      fontWeight: '800',
    },
    savedCard: {
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.md,
      backgroundColor: colors.surface + 'B3',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    savedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    savedInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    savedName: {
      fontSize: 14,
      fontWeight: '800',
    },
    savedMeta: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    smallButton: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      marginLeft: spacing.xs,
    },
    smallButtonText: {
      fontSize: 11,
      fontWeight: '800',
    },
    cloudMsg: {
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });

export default TrackView;