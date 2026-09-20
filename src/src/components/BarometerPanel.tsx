import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import TrendChart from './TrendChart';

type Props = {
  pressure: number | null;
  altitude: number | null;
  baseline: number | null;
  onSetBaseline: () => void;
  onResetBaseline: () => void;
  available: boolean;
};

const HISTORY_KEY = '@bussola/baroHistory';
const SAMPLE_INTERVAL_MS = 10000;
const SAVE_INTERVAL_MS = 90000;
const LIVE_MAX = 120;
const PERSIST_MAX = 140;

type Entry = { ts: number; p: number };

const BarometerPanel = ({
  pressure,
  altitude,
  baseline,
  onSetBaseline,
  onResetBaseline,
  available,
}: Props) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [history, setHistory] = useState<Entry[]>([]);
  const liveRef = useRef<Entry[]>([]);
  const lastSampleRef = useRef(0);
  const lastSaveRef = useRef(0);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(HISTORY_KEY)
      .then(raw => {
        if (!raw || !alive) return;
        try {
          const arr = JSON.parse(raw) as unknown;
          if (!Array.isArray(arr)) return;
          const entries = arr
            .filter(
              (e): e is Entry =>
                !!e && typeof e.ts === 'number' && typeof e.p === 'number',
            )
            .slice(-PERSIST_MAX);
          const now = Date.now();
          liveRef.current = entries.filter(e => now - e.ts < 30 * 60 * 1000);
          setHistory(liveRef.current);
        } catch {
          // ignore bad data
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (pressure == null || !available) return;
    const now = Date.now();
    if (now - lastSampleRef.current < SAMPLE_INTERVAL_MS) return;
    lastSampleRef.current = now;
    const next: Entry[] = [...liveRef.current.slice(-(LIVE_MAX - 1)), { ts: now, p: pressure }];
    liveRef.current = next;
    setHistory(next);
    if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
      lastSaveRef.current = now;
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(-PERSIST_MAX))).catch(
        () => {},
      );
    }
  }, [pressure, available]);

  const trend = useMemo(() => {
    const h = liveRef.current;
    if (h.length < 10) return null;
    const spanHours = (h[h.length - 1].ts - h[0].ts) / 3600000;
    const mid = Math.floor(h.length / 2);
    const avg = (a: Entry[]) => a.reduce((s, e) => s + e.p, 0) / a.length;
    const rate = spanHours > 0 ? (avg(h.slice(mid)) - avg(h.slice(0, mid))) / spanHours : 0;
    if (rate > 0.7) return 'up' as const;
    if (rate < -0.7) return 'down' as const;
    return 'flat' as const;
  }, [history]);

  const trendMeta = useMemo(() => {
    if (trend === 'up') {
      return { color: colors.success, label: t('baro_trend_up') };
    }
    if (trend === 'down') {
      return { color: colors.warning, label: t('baro_trend_down') };
    }
    return { color: colors.textMuted, label: t('baro_trend_flat') };
  }, [trend, colors, t]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('ui_baro_title')}
        </Text>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: available
                ? pressure != null
                  ? colors.success
                  : colors.accent
                : colors.danger,
            },
          ]}
        />
      </View>

      {!available ? (
        <Text style={[styles.unavailable, { color: colors.danger }]}>
          {t('ui_baro_unavailable')}
        </Text>
      ) : pressure == null ? (
        <View style={styles.waiting}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.waitingText, { color: colors.textMuted }]}>
            {t('ui_baro_waiting')}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <View style={styles.item}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('ui_baro_pressure')}</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {Math.round(pressure)}{' '}
                <Text style={[styles.unit, { color: colors.textMuted }]}>hPa</Text>
              </Text>
            </View>
            <View style={styles.item}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('ui_baro_altitude')}</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {altitude != null ? (
                  <>
                    {altitude >= 0 ? '+' : ''}
                    {Math.round(altitude)}{' '}
                    <Text style={[styles.unit, { color: colors.textMuted }]}>m</Text>
                  </>
                ) : (
                  <Text style={[styles.none, { color: colors.textMuted }]}>—</Text>
                )}
              </Text>
            </View>
          </View>

          {history.length >= 6 && (
            <View style={[styles.historyBox, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.historyLabel, { color: colors.textMuted }]}>
                {t('ui_baro_history')}
              </Text>
              <TrendChart
                data={history.map(e => e.p)}
                color={trendMeta.color}
                height={34}
              />
              <View style={styles.trendRow}>
                <View style={[styles.trendDot, { backgroundColor: trendMeta.color }]} />
                <Text style={[styles.trendText, { color: trendMeta.color }]}>
                  {trendMeta.label}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.actions}>
            {baseline == null ? (
              <Pressable onPress={onSetBaseline} style={[styles.button, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.buttonText, { color: colors.primary }]}>
                  {t('ui_baro_set_ref')}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={onResetBaseline} style={[styles.button, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.buttonText, { color: colors.textMuted }]}>
                  {t('ui_baro_reset_ref')}
                </Text>
              </Pressable>
            )}
            {baseline != null && (
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                {t('ui_baro_base_hint', { hpa: Math.round(baseline) })}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
};

const createStyles = (colors: {
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  success: string;
  accent: string;
  danger: string;
}) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    row: {
      flexDirection: 'row',
    },
    item: {
      flex: 1,
    },
    label: {
      fontSize: 12,
    },
    value: {
      fontSize: 22,
      fontWeight: '800',
      marginTop: 2,
    },
    unit: {
      fontSize: 13,
      fontWeight: '600',
    },
    none: {
      fontSize: 16,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    historyBox: {
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    historyLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    trendDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      marginRight: spacing.sm,
    },
    trendText: {
      fontSize: 11,
      fontWeight: '700',
    },
    button: {
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '800',
    },
    hint: {
      fontSize: 12,
    },
    unavailable: {
      fontSize: 13,
    },
    waiting: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    waitingText: {
      marginLeft: spacing.sm,
      fontSize: 13,
    },
  });

export default BarometerPanel;