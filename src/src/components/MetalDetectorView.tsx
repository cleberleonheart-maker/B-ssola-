import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Vibration,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {
  magnetometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { useRepetitiveBeep, soundAvailable } from '../services/sound';

const CAL_SAMPLES = 32;
const CAL_INTERVAL = 160;
const FILTER_ALPHA = 0.85;
const NEEDLE_ALPHA = 0.92;
const DETECT_THRESHOLD = 50;
const SENSITIVITY = 300;
const BASELINE_ADAPT = 0.025;

type GuideState = 'guide' | 'calibrating' | 'ready' | 'running';

type Props = {
  active: boolean;
};

const MetalDetectorView = ({ active }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [guideState, setGuideState] = useState<GuideState>('guide');
  const [progress, setProgress] = useState(0);
  const [baseline, setBaseline] = useState(0);
  const [deviation, setDeviation] = useState(0);
  const [µT, setµT] = useState(0);
  const [detected, setDetected] = useState(false);

  const beepEnabled = active && guideState === 'running' && soundAvailable;
  const beepStrength = detected ? 1 : Math.max(0, (deviation - DETECT_THRESHOLD * 0.3) / 100);
  const beepFreq = 280 + Math.pow(Math.min(1, beepStrength), 1.5) * 680;
  const beepInterval = Math.max(30, 900 - Math.pow(Math.min(1, beepStrength), 1.5) * 850);
  useRepetitiveBeep({
    intervalMs: beepInterval,
    frequency: beepFreq,
    durationMs: 28,
    enabled: beepEnabled && beepStrength > 0,
  });

  const needleAnim = useRef(new Animated.Value(0)).current;
  const filteredRef = useRef(0);
  const baselineRef = useRef(0);
  const needleSmoothedRef = useRef(0);
  const detectorSubRef = useRef<ReturnType<typeof magnetometer.subscribe> | null>(null);
  const calSubRef = useRef<ReturnType<typeof magnetometer.subscribe> | null>(null);
  const calCountRef = useRef(0);
  const calSumRef = useRef(0);
  const prevDetectedRef = useRef(false);

  useEffect(() => {
    return () => {
      detectorSubRef.current?.unsubscribe();
      calSubRef.current?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    needleAnim.setValue(0);
    Animated.timing(needleAnim, {
      toValue: Math.min(1, Math.max(0, deviation / 100)),
      duration: 140,
      useNativeDriver: false,
    }).start();
  }, [deviation, needleAnim]);

  const startCalibration = useCallback(() => {
    setGuideState('calibrating');
    setProgress(0);
    calCountRef.current = 0;
    calSumRef.current = 0;
    setUpdateIntervalForType(SensorTypes.magnetometer, CAL_INTERVAL);

    calSubRef.current = magnetometer.subscribe({
      next: ({ x, y, z }: { x: number; y: number; z: number }) => {
        const mag = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
        calSumRef.current += mag;
        calCountRef.current += 1;
        const p = Math.min(1, calCountRef.current / CAL_SAMPLES);
        if (calCountRef.current % 4 === 0) setProgress(p);
        if (calCountRef.current >= CAL_SAMPLES) {
          const avg = calSumRef.current / CAL_SAMPLES;
          baselineRef.current = avg;
          setBaseline(avg);
          calSubRef.current?.unsubscribe();
          setProgress(1);
          setGuideState('ready');
          setUpdateIntervalForType(SensorTypes.magnetometer, 100);
        }
      },
      error: () => {},
    });
  }, []);

  const beginDetection = useCallback(() => {
    filteredRef.current = baselineRef.current;
    needleSmoothedRef.current = 0;
    prevDetectedRef.current = false;
    setGuideState('running');
  }, []);

  useEffect(() => {
    if (!active || guideState !== 'running') return;

    detectorSubRef.current = magnetometer.subscribe({
      next: ({ x, y, z }: { x: number; y: number; z: number }) => {
        const raw = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
        const ema = filteredRef.current * FILTER_ALPHA + raw * (1 - FILTER_ALPHA);
        filteredRef.current = ema;

        const devRaw = Math.max(
          0,
          ((ema - baselineRef.current) / Math.max(baselineRef.current, 1)) * SENSITIVITY,
        );
        const devClamped = Math.min(100, devRaw);
        needleSmoothedRef.current =
          needleSmoothedRef.current * NEEDLE_ALPHA +
          devClamped * (1 - NEEDLE_ALPHA);

        const isDetected = devClamped >= DETECT_THRESHOLD;
        if (isDetected && !prevDetectedRef.current) {
          Vibration.vibrate(120);
        }
        prevDetectedRef.current = isDetected;
        setDetected(isDetected);

        if (!isDetected && devClamped < DETECT_THRESHOLD * 0.6) {
          baselineRef.current += (ema - baselineRef.current) * BASELINE_ADAPT;
        }

        setµT(Math.round(ema * 10) / 10);
        setDeviation(Math.round(needleSmoothedRef.current * 10) / 10);
      },
      error: () => {},
    });

    return () => {
      detectorSubRef.current?.unsubscribe();
    };
  }, [active, guideState]);

  useEffect(() => {
    if (!active) {
      detectorSubRef.current?.unsubscribe();
      calSubRef.current?.unsubscribe();
      prevDetectedRef.current = false;
      if (guideState === 'running') setGuideState('guide');
      needleAnim.setValue(0);
      setDeviation(0);
      setDetected(false);
    }
  }, [active, guideState, needleAnim]);

  const needleDeg = needleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '90deg'],
  });

  const statusLabel = !active
    ? ''
    : detected
      ? t('md_detected')
      : guideState === 'running'
        ? t('md_clear')
        : '';

  const statusColor = detected ? colors.north : colors.success;

  return (
    <View style={styles.container}>
      {guideState !== 'running' ? (
        <View style={styles.guideWrap}>
          {guideState === 'guide' && (
            <>
              <Text style={styles.guideEmoji}>🧲</Text>
              <Text style={[styles.guideTitle, { color: colors.text }]}>
                {t('md_cal_title')}
              </Text>
              <Text style={[styles.guideHint, { color: colors.textMuted }]}>
                {t('md_cal_step1_hint')}
              </Text>
              <Pressable
                onPress={startCalibration}
                style={[styles.guideButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.guideButtonText, { color: colors.background }]}>
                  {t('md_cal_start')}
                </Text>
              </Pressable>
            </>
          )}

          {guideState === 'calibrating' && (
            <>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[styles.guideTitle, { color: colors.text, marginTop: spacing.md }]}>
                {t('md_cal_measuring')}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
              <Text style={[styles.guideHint, { color: colors.textMuted }]}>
                {Math.round(progress * 100)}%
              </Text>
            </>
          )}

          {guideState === 'ready' && (
            <>
              <Text style={styles.guideEmoji}>✅</Text>
              <Text style={[styles.guideTitle, { color: colors.text }]}>
                {t('md_cal_done')}
              </Text>
              <View style={[styles.baselineBox, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.baselineLabel, { color: colors.textMuted }]}>
                  {t('md_baseline')}
                </Text>
                <Text style={[styles.baselineValue, { color: colors.text }]}>
                  {baseline.toFixed(1)} µT
                </Text>
              </View>
              <Pressable
                onPress={beginDetection}
                style={[styles.guideButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.guideButtonText, { color: colors.background }]}>
                  {t('md_cal_start_detection')}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <View style={styles.gaugeWrap}>
          <View style={styles.arcContainer}>
            <View style={[styles.arc, { borderColor: colors.border }]} />
            <Animated.View
              style={[
                styles.needle,
                { transform: [{ rotate: needleDeg }] },
              ]}
            />
            <View style={[styles.pivot, { backgroundColor: colors.accent }]} />
          </View>

          <View style={styles.valueRow}>
            <Text style={[styles.valueText, { color: colors.text }]}>
              {µT.toFixed(1)}
            </Text>
            <Text style={[styles.valueUnit, { color: colors.textMuted }]}>µT</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>

          <View style={styles.devBar}>
            <View
              style={[
                styles.devFill,
                {
                  width: `${Math.min(100, deviation)}%`,
                  backgroundColor: statusColor,
                },
              ]}
            />
          </View>

          <Text style={[styles.autoText, { color: colors.textMuted }]}>
            ⟳ {t('md_auto')}
          </Text>

          <Pressable
            onPress={startCalibration}
            style={[styles.recalButton, { borderColor: colors.border }]}>
            <Text style={[styles.recalText, { color: colors.text }]}>
              {t('md_recal')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const GAUGE_SIZE = 220;
const ARC_H = GAUGE_SIZE / 2;
const ARC_BORDER = 10;

const createStyles = (_colors: {
  background: string;
  border: string;
  text: string;
  textMuted: string;
  north: string;
  accent: string;
  primary: string;
  surfaceAlt: string;
  success: string;
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    guideWrap: {
      alignItems: 'center',
      maxWidth: 320,
    },
    guideEmoji: {
      fontSize: 44,
      marginBottom: spacing.md,
    },
    guideTitle: {
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    guideHint: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.sm,
    },
    guideButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.full,
    },
    guideButtonText: {
      fontSize: 15,
      fontWeight: '800',
    },
    progressBar: {
      width: 200,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.08)',
      marginTop: spacing.md,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    baselineBox: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    baselineLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    baselineValue: {
      fontSize: 28,
      fontWeight: '900',
      marginTop: spacing.xs,
    },
    gaugeWrap: {
      alignItems: 'center',
      width: GAUGE_SIZE,
    },
    arcContainer: {
      width: GAUGE_SIZE,
      height: ARC_H + 4,
      overflow: 'hidden',
      alignItems: 'center',
    },
    arc: {
      position: 'absolute',
      top: 0,
      width: GAUGE_SIZE,
      height: GAUGE_SIZE,
      borderRadius: GAUGE_SIZE / 2,
      borderWidth: ARC_BORDER,
      borderBottomWidth: 0,
    },
    needle: {
      position: 'absolute',
      bottom: 0,
      left: GAUGE_SIZE / 2 - 1.5,
      width: 3,
      height: ARC_H - 20,
      backgroundColor: '#EF4444',
      borderRadius: 1.5,
      transformOrigin: 'bottom',
    },
    pivot: {
      position: 'absolute',
      bottom: -5,
      left: GAUGE_SIZE / 2 - 7,
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: spacing.md,
    },
    valueText: {
      fontSize: 34,
      fontWeight: '900',
    },
    valueUnit: {
      fontSize: 14,
      fontWeight: '700',
      marginLeft: spacing.xs,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      marginTop: spacing.sm,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    statusText: {
      fontSize: 13,
      fontWeight: '800',
    },
    devBar: {
      width: GAUGE_SIZE,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.08)',
      marginTop: spacing.md,
      overflow: 'hidden',
    },
    devFill: {
      height: '100%',
      borderRadius: 3,
    },
    autoText: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: spacing.sm,
    },
    recalButton: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    recalText: {
      fontSize: 13,
      fontWeight: '800',
    },
  });

export default MetalDetectorView;