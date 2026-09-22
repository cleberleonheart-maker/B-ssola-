import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, PermissionsAndroid } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import type { ColorScheme } from '../theme/themes';
import TrendChart from './TrendChart';
import { useRepetitiveBeep, soundAvailable } from '../services/sound';
import {
  startMicLevel,
  stopMicLevel,
  getMicLevel,
  micLevelAvailable,
} from '../services/micLevel';
import {
  DEFAULT_WIND_CAL,
  loadWindCal,
  saveWindCal,
} from '../services/preferencesService';
import type { WindCal } from '../services/preferencesService';

const SAMPLE_INTERVAL = 180;
const FILTER_ALPHA = 0.72;
const HISTORY_MAX = 90;
const LOW_THRESHOLD = 30;
const HIGH_THRESHOLD = 70;

type Props = {
  active: boolean;
};

const WindView = ({ active }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [value, setValue] = useState<number | null>(null);
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [cal, setCal] = useState<WindCal>(DEFAULT_WIND_CAL);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [noSignal, setNoSignal] = useState(false);
  const [noMic, setNoMic] = useState(!micLevelAvailable);
  const [retryCount, setRetryCount] = useState(0);

  const filteredRef = useRef(0);
  const hasReadingRef = useRef(false);
  const minRef = useRef<number | null>(null);
  const maxRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noSignalCountRef = useRef(0);

  useEffect(() => {
    loadWindCal().then(setCal).catch(() => {});
  }, []);

  const clearCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopMicLevel();
    hasReadingRef.current = false;
    filteredRef.current = 0;
    noSignalCountRef.current = 0;
  }, []);

  useEffect(() => {
    if (!active) {
      clearCapture();
      setNoSignal(false);
      return;
    }
    setPermissionDenied(false);
    setNoSignal(false);
    setNoMic(!micLevelAvailable);
    if (!micLevelAvailable) return;

    let cancelled = false;
    const start = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          );
          if (cancelled) return;
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setPermissionDenied(true);
            return;
          }
        } catch {
          if (cancelled) return;
          setPermissionDenied(true);
          return;
        }
      }
      if (cancelled) return;
      startMicLevel();
      intervalRef.current = setInterval(async () => {
        const raw = await getMicLevel();
        if (raw < 0) {
          noSignalCountRef.current += 1;
          setNoSignal(noSignalCountRef.current > 8);
          return;
        }
        noSignalCountRef.current = 0;
        setNoSignal(false);
        const ema = hasReadingRef.current
          ? filteredRef.current * FILTER_ALPHA + raw * (1 - FILTER_ALPHA)
          : raw;
        hasReadingRef.current = true;
        filteredRef.current = ema;
        handleReading(ema);
      }, SAMPLE_INTERVAL);
    };
    start();
    return () => {
      cancelled = true;
      clearCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, retryCount]);

  const handleReading = (ema: number) => {
    setValue(ema);
    historyRef.current = [...historyRef.current.slice(-(HISTORY_MAX - 1)), ema];
    setHistory(historyRef.current);
    minRef.current =
      minRef.current === null ? ema : Math.min(minRef.current, ema);
    maxRef.current =
      maxRef.current === null ? ema : Math.max(maxRef.current, ema);
    setMin(minRef.current);
    setMax(maxRef.current);
  };

  const reset = useCallback(() => {
    minRef.current = null;
    maxRef.current = null;
    setMin(null);
    setMax(null);
    historyRef.current = [];
    setHistory([]);
  }, []);

  const persistWindCal = useCallback((next: WindCal) => {
    setCal(next);
    saveWindCal(next).catch(() => {});
  }, []);

  const captureZero = useCallback(() => {
    if (!hasReadingRef.current) return;
    persistWindCal({ ...cal, zero: filteredRef.current });
  }, [cal, persistWindCal]);

  const captureStrong = useCallback(() => {
    if (!hasReadingRef.current) return;
    persistWindCal({ ...cal, strong: filteredRef.current });
  }, [cal, persistWindCal]);

  const resetWindCal = useCallback(() => {
    persistWindCal(DEFAULT_WIND_CAL);
  }, [persistWindCal]);

  const ratio =
    value === null
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            (value - cal.zero) / Math.max(cal.strong - cal.zero, 0.001),
          ),
        );
  const index = value === null ? null : Math.round(ratio * 100);

  const levelColor =
    index === null
      ? colors.textMuted
      : index >= HIGH_THRESHOLD
        ? colors.danger
        : index >= LOW_THRESHOLD
          ? colors.warning
          : colors.success;
  const levelLabel =
    index === null
      ? t('wind_no_signal')
      : index >= HIGH_THRESHOLD
        ? t('wind_high')
        : index >= LOW_THRESHOLD
          ? t('wind_medium')
          : t('wind_low');

  const beepActive = active && value !== null && ratio > 0.06;
  const beepFreq = 200 + Math.pow(ratio, 1.4) * 720;
  const beepInterval = 760 - Math.pow(ratio, 1.4) * 660;
  useRepetitiveBeep({
    intervalMs: beepInterval,
    frequency: beepFreq,
    enabled: beepActive && soundAvailable,
  });

  const calRounded = (n: number) => Math.round(n * 100);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textMuted }]}>
        {t('wind_title')}
      </Text>

      {permissionDenied ? (
        <>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('wind_denied')}
          </Text>
          <Pressable
            onPress={() => setRetryCount((c) => c + 1)}
            style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonText, { color: colors.background }]}>
              {t('wind_retry')}
            </Text>
          </Pressable>
        </>
      ) : noMic ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('wind_unavailable')}
        </Text>
      ) : (
        <>
          <View style={styles.readout}>
            <Text style={[styles.value, { color: levelColor }]}>
              {index === null ? '---' : index}
            </Text>
            <Text style={[styles.unit, { color: colors.textMuted }]}>%</Text>
          </View>

          <View style={styles.badge}>
            <View style={[styles.dot, { backgroundColor: levelColor }]} />
            <Text style={[styles.badgeText, { color: levelColor }]}>
              {levelLabel}
            </Text>
          </View>

          <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
            <View
              style={[
                styles.fill,
                { width: `${ratio * 100}%`, backgroundColor: levelColor },
              ]}
            />
          </View>

          {noSignal && value === null && (
            <Text style={[styles.noSignal, { color: colors.textMuted }]}>
              {t('wind_unavailable')}
            </Text>
          )}

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('wind_min')}
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {min === null ? '--' : calRounded(min)}
              </Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('wind_max')}
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {max === null ? '--' : calRounded(max)}
              </Text>
            </View>
          </View>

          {history.length >= 2 && (
            <View style={[styles.historyBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.historyLabel, { color: colors.textMuted }]}>
                {t('wind_history')}
              </Text>
              <TrendChart data={history} color={levelColor} height={34} />
            </View>
          )}

          <Text style={[styles.calTitle, { color: colors.textMuted }]}>
            {t('wind_calib_tt')}
          </Text>
          <View style={styles.calRow}>
            <Pressable
              onPress={captureZero}
              disabled={!hasReadingRef.current}
              style={[
                styles.calButton,
                { borderColor: colors.border, opacity: hasReadingRef.current ? 1 : 0.4 },
              ]}>
              <Text style={[styles.calButtonText, { color: colors.text }]}>
                {t('wind_cal_zero')}
              </Text>
              <Text style={[styles.calButtonSub, { color: colors.textMuted }]}>
                {t('wind_cal_zero_hint')} · {calRounded(cal.zero)}%
              </Text>
            </Pressable>
            <Pressable
              onPress={captureStrong}
              disabled={!hasReadingRef.current}
              style={[
                styles.calButton,
                { borderColor: colors.border, opacity: hasReadingRef.current ? 1 : 0.4 },
              ]}>
              <Text style={[styles.calButtonText, { color: colors.text }]}>
                {t('wind_cal_strong')}
              </Text>
              <Text style={[styles.calButtonSub, { color: colors.textMuted }]}>
                {t('wind_cal_strong_hint')} · {calRounded(cal.strong)}%
              </Text>
            </Pressable>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={reset}
              style={[styles.actionButton, { borderColor: colors.border }]}>
              <Text style={[styles.actionText, { color: colors.text }]}>
                {t('wind_reset')}
              </Text>
            </Pressable>
            <Pressable
              onPress={resetWindCal}
              style={[styles.actionButton, { borderColor: colors.border }]}>
              <Text style={[styles.actionText, { color: colors.text }]}>
                {t('wind_cal_reset')}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('wind_hint')}
          </Text>
        </>
      )}
    </View>
  );
};

const createStyles = (_colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    title: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    readout: {
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    value: {
      fontSize: 72,
      fontWeight: '900',
      letterSpacing: 1,
      fontVariant: ['tabular-nums'],
    },
    unit: {
      fontSize: 20,
      fontWeight: '800',
      marginLeft: spacing.sm,
      marginBottom: spacing.md,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    track: {
      width: '100%',
      maxWidth: 320,
      height: 10,
      borderRadius: 5,
      marginTop: spacing.lg,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 5,
    },
    noSignal: {
      fontSize: 12,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    statBox: {
      minWidth: 96,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '900',
      marginTop: spacing.xs,
      fontVariant: ['tabular-nums'],
    },
    historyBox: {
      alignSelf: 'stretch',
      maxWidth: 320,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      marginTop: spacing.lg,
    },
    historyLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    calTitle: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    calRow: {
      flexDirection: 'row',
      gap: spacing.md,
      maxWidth: 340,
    },
    calButton: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
    },
    calButtonText: {
      fontSize: 12,
      fontWeight: '800',
    },
    calButtonSub: {
      fontSize: 10,
      marginTop: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    actionButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    actionText: {
      fontSize: 12,
      fontWeight: '800',
    },
    button: {
      marginTop: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.full,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '800',
    },
    hint: {
      fontSize: 12,
      textAlign: 'center',
      marginTop: spacing.lg,
      lineHeight: 18,
      maxWidth: 320,
    },
  });

export default WindView;