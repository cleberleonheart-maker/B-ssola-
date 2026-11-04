import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { normalizeHeading, formatAzimuth } from '../utils/compass';
import { angleDiff, intersectRays } from '../utils/triangulate';
import { formatDistance, haversine, initialBearing } from '../utils/geo';

type Marker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

/** Uma avistagem: o marco mirado e o rumo que a agulha marcava nesse instante. */
type Sighting = {
  marker: Marker;
  /** Rumo verdadeiro (0–360) do observador para o marco. */
  bearing: number;
};

type Props = {
  heading: number;
  latitude: number;
  longitude: number;
  hasFix: boolean;
  declinationEnabled: boolean;
  declinationDegrees: number;
  mils?: boolean;
  waypoints: Marker[];
  onAddWaypoint: (wp: { name: string; latitude: number; longitude: number }) => void;
};

/**
 * Triangulação por marcadores (ideia #33).
 *
 * Aqui os pontos de referência são conhecidos — são os marcos guardados — e o
 * que se estima é a posição de quem está a mirar. A conta é a interseção de
 * dois raios, mas com os raios a partir dos marcos e o rumo invertido: quem
 * mira o marco A com a agulha em α está no raio que sai de A para α+180°, e o
 * mesmo vale para o marco B. Onde os dois raios se cruzam é a posição.
 *
 * Um só marco não chega: os dois raios precisam de sair de pontos diferentes,
 * senão são paralelos e não se cruzam.
 */
export const WaypointTriangulation = ({
  heading,
  latitude,
  longitude,
  hasFix,
  declinationEnabled,
  declinationDegrees,
  mils = false,
  waypoints,
  onAddWaypoint,
}: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = createStyles();

  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [target, setTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [name, setName] = useState('');
  const [added, setAdded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Rumo verdadeiro: o que a agulha mostra é magnético, e a geometria é
  // geográfica.
  const trueHeading = normalizeHeading(
    heading + (declinationEnabled ? 0 : declinationDegrees),
  );

  const markers = useMemo(
    () =>
      waypoints.map(wp => ({
        ...wp,
        distance: hasFix ? haversine(latitude, longitude, wp.latitude, wp.longitude) : null,
        bearing: hasFix
          ? initialBearing(latitude, longitude, wp.latitude, wp.longitude)
          : null,
      })),
    [waypoints, hasFix, latitude, longitude],
  );

  const selected = markers.find(m => m.id === selectedId) ?? null;
  const deviation =
    selected && selected.bearing != null
      ? angleDiff(trueHeading, selected.bearing)
      : null;

  const record = useCallback(() => {
    if (!selected) return;
    if (sightings.some(s => s.marker.id === selected.id)) {
      setErr(t('tri_wp_same_marker'));
      return;
    }
    const next = [...sightings, { marker: selected, bearing: trueHeading }];
    setSightings(next);
    setErr(null);
    setTarget(null);
    setAdded(false);
    if (next.length === 2) {
      const [a, b] = next;
      const res = intersectRays(
        {
          point: { lat: a.marker.latitude, lon: a.marker.longitude },
          bearing: (a.bearing + 180) % 360,
        },
        {
          point: { lat: b.marker.latitude, lon: b.marker.longitude },
          bearing: (b.bearing + 180) % 360,
        },
      );
      if (!res) {
        setErr(t('tri_wp_parallel'));
      } else {
        setTarget(res);
        setErr(null);
      }
    }
  }, [selected, sightings, trueHeading, t]);

  const add = useCallback(() => {
    if (!target) return;
    const label = name.trim() || t('tri_default_name');
    onAddWaypoint({ name: label, latitude: target.lat, longitude: target.lon });
    setAdded(true);
  }, [target, name, onAddWaypoint, t]);

  const reset = useCallback(() => {
    setSightings([]);
    setTarget(null);
    setErr(null);
    setAdded(false);
    setName('');
  }, []);

  if (!hasFix) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>{t('tri_wp_title')}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('tri_no_gps')}</Text>
      </View>
    );
  }

  if (markers.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>{t('tri_wp_title')}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('tri_wp_no_markers')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('tri_wp_title')}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('tri_wp_hint')}</Text>

      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('tri_wp_select')}
      </Text>
      <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
        {markers.map(marker => {
          const picked = marker.id === selectedId;
          const sighted = sightings.some(s => s.marker.id === marker.id);
          return (
            <Pressable
              key={marker.id}
              onPress={() => setSelectedId(marker.id)}
              style={[
                styles.marker,
                {
                  borderColor: picked ? colors.primary : colors.border,
                  backgroundColor: picked ? colors.surfaceAlt : 'transparent',
                },
              ]}>
              <Text style={[styles.markerName, { color: colors.text }]}>
                {marker.name}
              </Text>
              <Text style={[styles.markerInfo, { color: colors.textMuted }]}>
                {marker.distance != null && marker.bearing != null
                  ? `${formatDistance(marker.distance)} · ${formatAzimuth(marker.bearing, mils)}`
                  : '—'}
                {sighted ? ` · ${t('tri_wp_sighted')}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selected ? (
        <Text style={[styles.aiming, { color: colors.text }]}>
          {t('tri_wp_aiming', { name: selected.name })}
          {deviation != null ? ` · ${t('tri_wp_deviation', { deg: Math.round(deviation) })}` : ''}
        </Text>
      ) : null}

      <Pressable
        disabled={!selected || sightings.length >= 2}
        onPress={record}
        style={[
          styles.btn,
          {
            backgroundColor:
              !selected || sightings.length >= 2 ? colors.surfaceAlt : colors.primary,
          },
        ]}>
        <Text
          style={[
            styles.btnText,
            {
              color:
                !selected || sightings.length >= 2
                  ? colors.textMuted
                  : colors.background,
            },
          ]}>
          {sightings.length === 0 ? t('tri_wp_sight1') : t('tri_wp_sight2')}
        </Text>
      </Pressable>

      {sightings.map((s, idx) => (
        <Text
          key={`${s.marker.id}-${idx}`}
          style={[styles.recorded, { color: colors.textMuted }]}>
          {t('tri_wp_recorded', {
            name: s.marker.name,
            deg: Math.round(s.bearing),
          })}
        </Text>
      ))}

      {err && <Text style={[styles.err, { color: colors.warning }]}>{err}</Text>}

      {target && (
        <View style={[styles.box, { borderColor: colors.success + '55' }]}>
          <Text style={[styles.txt, { color: colors.text }]}>
            {t('tri_wp_result', {
              lat: target.lat.toFixed(6),
              lon: target.lon.toFixed(6),
            })}
          </Text>
          {!added ? (
            <>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('tri_default_name')}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
              />
              <Pressable
                onPress={add}
                style={[styles.btn, { backgroundColor: colors.primary, marginTop: spacing.sm }]}>
                <Text style={[styles.btnText, { color: colors.background }]}>
                  {t('tri_wp_add')}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.ok, { color: colors.success }]}>{t('tri_added')}</Text>
          )}
        </View>
      )}

      {(sightings.length > 0 || target) && (
        <Pressable onPress={reset} style={styles.reset}>
          <Text style={[styles.resetText, { color: colors.textMuted }]}>
            {t('tri_reset')}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: { padding: spacing.lg },
    title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
    hint: { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
    section: { fontSize: 12, fontWeight: '700', marginBottom: spacing.xs },
    list: { maxHeight: 140 },
    listInner: { paddingBottom: spacing.xs },
    marker: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.xs,
    },
    markerName: { fontSize: 14, fontWeight: '700' },
    markerInfo: { fontSize: 12, marginTop: 2 },
    aiming: { fontSize: 13, fontWeight: '700', marginTop: spacing.sm },
    btn: { padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
    btnText: { fontWeight: '800' },
    recorded: { fontSize: 12, marginTop: spacing.xs },
    box: {
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    txt: { textAlign: 'center' },
    input: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },
    err: { textAlign: 'center', marginTop: spacing.md },
    ok: { textAlign: 'center', marginTop: spacing.sm, fontWeight: '700' },
    reset: { marginTop: spacing.md },
    resetText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  });

export default WaypointTriangulation;
