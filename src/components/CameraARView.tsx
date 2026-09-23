import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraDevices,
  useCameraPermission,
  type CameraDevice,
  type TargetCameraPosition,
} from 'react-native-vision-camera';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { cardinalOf, normalizeHeading } from '../utils/compass';
import { formatDistance } from '../utils/geo';
import type { CelestialPoint } from '../utils/astro';

const FOV = 110;

const PREVIEW_SETTLE_MS = 2600;
const PREVIEW_PULSE_MS = 1100;
const PREVIEW_MODES = ['performance', 'compatible'] as const;
type PreviewMode = (typeof PREVIEW_MODES)[number];

type Props = {
  heading: number;
  sun: CelestialPoint | null;
  moon: CelestialPoint | null;
  moonIcon: string;
  target: { name: string; bearing: number; distance: number } | null;
  virtual: { name: string; bearing: number; distance: number } | null;
  active: boolean;
};

type Marker = {
  key: string;
  icon: string;
  angle: number;
  label: string;
  sub: string;
};

const angularDiff = (from: number, to: number): number => {
  return (normalizeHeading(to - from) + 180) % 360 - 180;
};

const CameraARView = ({
  heading,
  sun,
  moon,
  moonIcon,
  target,
  virtual,
  active,
}: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backDevice = useCameraDevice('back');
  const allDevices = useCameraDevices();
  const hasBack = backDevice !== undefined;
  const cameraDevice =
    backDevice ??
    allDevices.find(d => d.position === 'back') ??
    allDevices[0] ??
    undefined;

  const { hasPermission, canRequestPermission, requestPermission } =
    useCameraPermission();
  const [previewMode, setPreviewMode] = useState<PreviewMode>(
    PREVIEW_MODES[0],
  );
  const [retryKey, setRetryKey] = useState(0);
  const [graphical, setGraphical] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previewLive, setPreviewLive] = useState(false);
  const [armed, setArmed] = useState(true);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [sessionInfo, setSessionInfo] = useState('—');

  const previewLiveRef = useRef(false);
  const triedModesRef = useRef<Record<PreviewMode, boolean>>({
    performance: false,
    compatible: false,
  });

  const showCamera =
    hasPermission && cameraDevice !== undefined && !graphical;

  const cameraTarget: CameraDevice | TargetCameraPosition = hasBack
    ? 'back'
    : (cameraDevice as CameraDevice);

  useEffect(() => {
    if (active && showCamera) {
      previewLiveRef.current = false;
      setPreviewLive(false);
      return () => {
        previewLiveRef.current = false;
        setPreviewLive(false);
      };
    }
  }, [active, showCamera, retryKey]);

  const autoFallback = useCallback(() => {
    setGraphical(true);
  }, []);

  const cycleMode = useCallback(() => {
    setPreviewMode(p => (p === 'performance' ? 'compatible' : 'performance'));
    triedModesRef.current = { compatible: false, performance: false };
    setRetryKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (!active || !showCamera) {
      return;
    }
    let alive = true;
    const startedAt = Date.now();
    let everLive = false;
    let pulsed = false;
    const id = setInterval(() => {
      if (!alive) {
        return;
      }
      const elapsed = Date.now() - startedAt;
      if (previewLiveRef.current) {
        everLive = true;
      }
      if (!pulsed && !everLive && elapsed >= PREVIEW_PULSE_MS) {
        pulsed = true;
        setArmed(false);
        setTimeout(() => {
          if (alive) {
            setArmed(true);
          }
        }, 150);
        return;
      }
      if (elapsed < PREVIEW_SETTLE_MS) {
        return;
      }
      if (everLive && previewLiveRef.current) {
        return;
      }
      clearInterval(id);
      triedModesRef.current[previewMode] = true;
      const triedAll = PREVIEW_MODES.every(mode => triedModesRef.current[mode]);
      if (triedAll) {
        autoFallback();
        return;
      }
      const next: PreviewMode =
        previewMode === 'performance' ? 'compatible' : 'performance';
      setPreviewMode(next);
      setRetryKey(k => k + 1);
    }, 500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [active, showCamera, retryKey, previewMode, autoFallback]);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission()
        .then(granted => {
          if (!granted) {
            setGraphical(true);
          }
        })
        .catch(() => {
          setGraphical(true);
        });
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  useEffect(() => {
    if (cameraDevice !== undefined) {
      setPreviewLive(false);
    }
  }, [cameraDevice]);

  const tryCameraAgain = useCallback(() => {
    setGraphical(false);
    triedModesRef.current = { compatible: false, performance: false };
    setPreviewMode(PREVIEW_MODES[0]);
    setStatus(null);
    setPreviewLive(false);
    setArmed(true);
    setRetryKey(k => k + 1);
  }, [setRetryKey]);

  const toggleGraphical = useCallback(() => {
    if (showCamera && !graphical) {
      setGraphical(true);
      return;
    }
    tryCameraAgain();
  }, [showCamera, graphical, tryCameraAgain]);

  const markers: Marker[] = [];
  if (sun) {
    markers.push({
      key: 'sun',
      icon: '☀️',
      angle: sun.azimuth,
      label: t('ui_sun_short'),
      sub: `${Math.round(sun.elevation)}°`,
    });
  }
  if (moon) {
    markers.push({
      key: 'moon',
      icon: moonIcon,
      angle: moon.azimuth,
      label: t('ui_moon_short'),
      sub: `${Math.round(moon.elevation)}°`,
    });
  }
  if (target) {
    markers.push({
      key: 'target',
      icon: '📍',
      angle: target.bearing,
      label: target.name,
      sub: formatDistance(target.distance),
    });
  }
  if (virtual) {
    markers.push({
      key: 'vmark',
      icon: '◆',
      angle: virtual.bearing,
      label: virtual.name,
      sub: formatDistance(virtual.distance),
    });
  }
  const cardinals: { key: string; icon: string; angle: number }[] = [
    { key: 'N', icon: t('ui_dir_n'), angle: 0 },
    { key: 'E', icon: t('ui_dir_e'), angle: 90 },
    { key: 'S', icon: t('ui_dir_s'), angle: 180 },
    { key: 'W', icon: t('ui_dir_w'), angle: 270 },
  ];

  const cardinal = cardinalOf(heading);
  const notDenied = hasPermission || canRequestPermission;
  const noCamera = cameraDevice === undefined;
  const waitingPermission = !hasPermission && canRequestPermission;
  const effectiveGraphical = notDenied && (graphical || !showCamera);

  return (
    <View style={styles.container}>
      {showCamera ? (
        <View
          collapsable={false}
          onLayout={e =>
            setViewSize({
              w: Math.round(e.nativeEvent.layout.width),
              h: Math.round(e.nativeEvent.layout.height),
            })
          }
          style={styles.cameraLayer}>
          <Camera
            key={retryKey}
            device={cameraTarget}
            isActive={active && armed}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            implementationMode={previewMode}
            mirrorMode="auto"
            constraints={[{ binned: true }, { fps: 30 }]}
            onSessionConfigSelected={cfg => {
              try {
                setSessionInfo(`${cfg.selectedFPS ?? '-'}fps ${cfg.nativePixelFormat}`);
              } catch {
                setSessionInfo('?');
              }
            }}
            onStarted={() => setStatus(null)}
            onPreviewStarted={() => {
              previewLiveRef.current = true;
              setPreviewLive(true);
              setStatus(null);
            }}
            onPreviewStopped={() => {
              previewLiveRef.current = false;
              setPreviewLive(false);
            }}
            onStopped={() => {
              previewLiveRef.current = false;
              setPreviewLive(false);
            }}
            onError={() => {
              previewLiveRef.current = false;
              setPreviewLive(false);
              setStatus(t('cam_error_short'));
            }}
          />
        </View>
      ) : null}

      {notDenied ? (
        <View pointerEvents="none" style={styles.markersLayer}>
          {cardinals.map(card => {
            const diff = angularDiff(heading, card.angle);
            const clamped = Math.max(-1, Math.min(1, diff / FOV));
            const leftPct = 50 + clamped * 50;
            return (
              <View
                key={card.key}
                style={[
                  styles.cardLeft,
                  { left: `${leftPct}%` },
                  Math.abs(diff) > FOV && styles.markerDim,
                ]}>
                <Text style={[styles.cardText, { color: colors.primary }]}>
                  {card.icon}
                </Text>
              </View>
            );
          })}
          {markers.map(marker => {
            const diff = angularDiff(heading, marker.angle);
            const clamped = Math.max(-1, Math.min(1, diff / FOV));
            const leftPct = 50 + clamped * 50;
            return (
              <View
                key={marker.key}
                style={[
                  styles.marker,
                  styles.markerTop,
                  { left: `${leftPct}%` },
                  Math.abs(diff) > FOV && styles.markerDim,
                  !graphical && styles.markerCamera,
                ]}>
                <View style={styles.markerChip}>
                  <Text style={styles.markerIcon}>{marker.icon}</Text>
                  <Text style={styles.markerLabel}>{marker.label}</Text>
                  <Text style={styles.markerSub}>{marker.sub}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {!notDenied && (
        <View style={styles.cover}>
          <Text style={styles.coverEmoji}>🍂</Text>
          <Text style={styles.coverTitle}>{t('cam_denied')}</Text>
          <Pressable
            onPress={() => Linking.openSettings()}
            style={styles.neonButton}>
            <Text style={[styles.neonButtonText, { color: colors.background }]}>
              {t('cam_open_settings')}
            </Text>
          </Pressable>
        </View>
      )}

      {effectiveGraphical && (
        <View style={styles.fallbackWrap}>
          <View style={[styles.fallbackChip, { borderColor: colors.border }]}>
            <Text style={styles.fallbackTitle}>
              {noCamera
                ? t('cam_no_camera')
                : waitingPermission
                ? t('cam_perm_waiting')
                : t('ui_cam_unavailable')}
            </Text>
            <Text style={styles.fallbackHint}>
              {noCamera
                ? t('ui_cam_unavailable')
                : waitingPermission
                ? t('cam_perm_hint')
                : t('cam_graphical_on')}
            </Text>
            <Text style={styles.fallbackDiag}>
              📷 devs:{allDevices.length} · back:{hasBack ? 1 : 0} · perm:
              {hasPermission ? 1 : 0} · can:{canRequestPermission ? 1 : 0}
            </Text>
            <Pressable
              onPress={tryCameraAgain}
              style={[styles.fallbackRetry, { borderColor: colors.primary }]}>
              <Text style={[styles.fallbackRetryText, { color: colors.primary }]}>
                {t('cam_retry')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {showCamera && !previewLive && !graphical && (
        <View style={styles.warmupWrap}>
          <View style={styles.warmupChip}>
            <Text style={styles.warmupText}>
              {t('cam_loading')} · devs:{allDevices.length} back:
              {hasBack ? 1 : 0} perm:{hasPermission ? 1 : 0} can:
              {canRequestPermission ? 1 : 0}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.headingBlock}>
        <Text style={styles.headingBig}>
          {Math.round(heading).toString().padStart(3, '0')}°
        </Text>
        <Text style={styles.headingCardinal}>{cardinal.full}</Text>
      </View>

      {notDenied && (
        <Pressable
          onPress={cycleMode}
          style={styles.debugWrap}
          accessibilityRole="button">
          <Text style={styles.debugText}>
            {previewMode === 'performance' ? 'SURF' : 'TEX'} ·{' '}
            {previewLive ? 'vivo' : 'parado'} · {sessionInfo} ·{' '}
            {viewSize.w}×{viewSize.h}
          </Text>
        </Pressable>
      )}

      {status !== null && !graphical && (
        <View style={styles.statusChip}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}

      {notDenied && (
        <View style={styles.topControls}>
          <Pressable
            onPress={toggleGraphical}
            style={[styles.controlPill, { borderColor: colors.border }]}>
            <Text style={styles.controlPillIcon}>
              {effectiveGraphical ? '📷' : '🗺️'}
            </Text>
            <Text
              style={[styles.controlPillText, { color: colors.primary }]}>
              {effectiveGraphical ? t('cam_retry') : t('cam_graphical')}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.crosshair}>
        <View style={[styles.crossH, { backgroundColor: colors.border }]} />
        <View style={[styles.crossV, { backgroundColor: colors.border }]} />
        <View style={[styles.crossDot, { backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
};

const createStyles = (colors: {
  background: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  primary: string;
  surface: string;
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    cameraLayer: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 1,
    },
    markersLayer: {
      ...StyleSheet.absoluteFill,
      overflow: 'hidden',
      zIndex: 2,
    },
    marker: {
      position: 'absolute',
      alignItems: 'center',
      marginLeft: -30,
      width: 60,
    },
    markerTop: {
      top: '30%',
    },
    markerDim: {
      opacity: 0.35,
    },
    markerCamera: {
      transform: [{ translateY: -34 }],
    },
    markerChip: {
      alignItems: 'center',
      backgroundColor: 'rgba(4,4,10,0.55)',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    markerIcon: {
      fontSize: 26,
    },
    markerLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.text,
      marginTop: 1,
      textShadowColor: '#000',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    markerSub: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.primary,
      textShadowColor: '#000',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    headingBlock: {
      position: 'absolute',
      top: spacing.md,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 6,
    },
    debugWrap: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.sm,
      zIndex: 7,
      backgroundColor: 'rgba(4,4,10,0.78)',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    debugText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
      fontFamily: 'monospace',
    },
    headingBig: {
      fontSize: 44,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: 2,
      textShadowColor: colors.primary,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 16,
    },
    headingCardinal: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.primary,
      marginTop: 2,
      textShadowColor: colors.primary,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    statusChip: {
      position: 'absolute',
      top: 84,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      backgroundColor: 'rgba(4,4,10,0.7)',
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      overflow: 'hidden',
    },
    cardLeft: {
      position: 'absolute',
      top: '14%',
      alignItems: 'center',
      marginLeft: -18,
      width: 36,
    },
    cardText: {
      fontSize: 26,
      fontWeight: '900',
      textShadowColor: '#000',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    fallbackWrap: {
      position: 'absolute',
      bottom: spacing.xl,
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      zIndex: 5,
    },
    fallbackChip: {
      alignItems: 'center',
      backgroundColor: 'rgba(4,4,10,0.78)',
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      width: '100%',
    },
    fallbackTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    fallbackHint: {
      marginTop: 3,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
    },
    fallbackDiag: {
      marginTop: 6,
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
    fallbackRetry: {
      marginTop: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    fallbackRetryText: {
      fontSize: 12,
      fontWeight: '800',
    },
    warmupWrap: {
      position: 'absolute',
      bottom: spacing.xl,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 5,
    },
    warmupChip: {
      backgroundColor: 'rgba(4,4,10,0.7)',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      overflow: 'hidden',
    },
    warmupText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    topControls: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      alignItems: 'flex-end',
      zIndex: 6,
    },
    controlPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(4,4,10,0.72)',
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    controlPillIcon: {
      fontSize: 13,
      marginRight: 4,
    },
    controlPillText: {
      fontSize: 11,
      fontWeight: '800',
    },
    cover: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      backgroundColor: colors.background,
    },
    coverEmoji: {
      fontSize: 40,
      marginBottom: spacing.md,
    },
    coverTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    neonButton: {
      marginTop: spacing.lg,
      borderRadius: radius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
      elevation: 4,
    },
    neonButtonText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },
    crosshair: {
      position: 'absolute',
      top: '48%',
      left: '50%',
      zIndex: 3,
    },
    crossH: {
      width: 26,
      height: 2,
      marginLeft: -13,
    },
    crossV: {
      width: 2,
      height: 26,
      marginTop: -13,
    },
    crossDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      position: 'absolute',
      marginLeft: -4,
      marginTop: -4,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 6,
      elevation: 3,
    },
  });

export default CameraARView;