import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import {
  magnetometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import type { ColorScheme } from '../theme/themes';
import TrendChart from './TrendChart';
import { useRepetitiveBeep, soundAvailable } from '../services/sound';

const SAMPLE_INTERVAL = 200;
const FILTER_ALPHA = 0.82;
const SCALE_MAX = 200;
const LOW_THRESHOLD = 40;
const HIGH_THRESHOLD = 90;
const HISTORY_MAX = 90;

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Props = {
  active: boolean;
};

const EmfReaderView = ({ active }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [value, setValue] = useState(0);
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState<number[]>([]);

  const filteredRef = useRef(0);
  const subRef = useRef<ReturnType<typeof magnetometer.subscribe> | null>(null);
  const minRef = useRef<number | null>(null);
  const maxRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if (!active) {
      subRef.current?.unsubscribe();
      subRef.current = null;
      return;
    }
    setError(false);
    filteredRef.current = 0;
    setUpdateIntervalForType(SensorTypes.magnetometer, SAMPLE_INTERVAL);
    subRef.current = magnetometer.subscribe({
      next: ({ x, y, z }: { x: number; y: number; z: number }) => {
        const raw = Math.sqrt(x * x + y * y + z * z);
        const ema =
          filteredRef.current === 0
            ? raw
            : filteredRef.current * FILTER_ALPHA + raw * (1 - FILTER_ALPHA);
        filteredRef.current = ema;
        const rounded = Math.round(ema * 10) / 10;
        setValue(rounded);
        historyRef.current = [...historyRef.current.slice(-(HISTORY_MAX - 1)), rounded];
        setHistory(historyRef.current);
        minRef.current =
          minRef.current === null ? rounded : Math.min(minRef.current, rounded);
        maxRef.current =
          maxRef.current === null ? rounded : Math.max(maxRef.current, rounded);
        setMin(minRef.current);
        setMax(maxRef.current);
      },
      error: () => setError(true),
    });
    return () => {
      subRef.current?.unsubscribe();
      subRef.current = null;
    };
  }, [active]);

  const reset = useCallback(() => {
    minRef.current = null;
    maxRef.current = null;
    setMin(null);
    setMax(null);
    historyRef.current = [];
    setHistory([]);
  }, []);

  const ratio = Math.max(0, Math.min(1, value / SCALE_MAX));
  const levelColor =
    value >= HIGH_THRESHOLD
      ? colors.danger
      : value >= LOW_THRESHOLD
        ? colors.warning
        : colors.success;
  const levelLabel =
    value >= HIGH_THRESHOLD
      ? t('emf_high')
      : value >= LOW_THRESHOLD
        ? t('emf_medium')
        : t('emf_low');

  const beepActive = active && ratio > 0.08;
  const beepFreq = 240 + Math.pow(ratio, 1.4) * 660;
  const beepInterval = 720 - Math.pow(ratio, 1.4) * 620;
  useRepetitiveBeep({
    intervalMs: beepInterval,
    frequency: beepFreq,
    enabled: beepActive && soundAvailable,
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textMuted }]}>
        {t('emf_title')}
      </Text>

      {error ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('emf_unavailable')}
        </Text>
      ) : (
        <>
          <View style={styles.readout}>
            <Text style={[styles.value, { color: levelColor }]}>
              {value.toFixed(1)}
            </Text>
            <Text style={[styles.unit, { color: colors.textMuted }]}>µT</Text>
          </View>

          <View style={styles.badge}>
            <View style={[styles.dot, { backgroundColor: levelColor }]} />
            <Text style={[styles.badgeText, { color: levelColor }]}>
              {levelLabel}
            </Text>
          </View>

          <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
            <View
              style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: levelColor }]}
            />
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('emf_min')}
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {min === null ? '--' : min.toFixed(1)}
              </Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('emf_max')}
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {max === null ? '--' : max.toFixed(1)}
              </Text>
            </View>
          </View>

          {history.length >= 2 && (
            <View style={[styles.historyBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.historyLabel, { color: colors.textMuted }]}>
                {t('emf_history')}
              </Text>
              <TrendChart
                data={history}
                color={levelColor}
                height={34}
              />
            </View>
          )}

          <Pressable
            onPress={reset}
            style={[styles.resetButton, { borderColor: colors.border }]}>
            <Text style={[styles.resetText, { color: colors.text }]}>
              {t('emf_reset')}
            </Text>
          </Pressable>

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('emf_hint')}
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
      fontFamily: MONO,
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
    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
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
    resetButton: {
      marginTop: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    resetText: {
      fontSize: 13,
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

export default EmfReaderView;
