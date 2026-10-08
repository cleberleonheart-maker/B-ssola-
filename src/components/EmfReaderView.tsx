import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Vibration } from 'react-native';
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
import { dominantAxis, type AxisValues } from '../utils/emf';

const SAMPLE_INTERVAL = 200;
const FILTER_ALPHA = 0.82;
const SCALE_MAX = 200;
// limiares de severidade como fração do desvio do ambiente (ratio 0..1)
const LOW_THRESHOLD = 0.45;
const HIGH_THRESHOLD = 0.75;
const HISTORY_MAX = 90;

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

type Props = {
  active: boolean;
  hasFix: boolean;
  onAdd: (name: string) => void;
};

const EmfReaderView = ({ active, hasFix, onAdd }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [value, setValue] = useState(0);
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [ambient, setAmbient] = useState<number | null>(null);
  const [axes, setAxes] = useState<AxisValues | null>(null);
  const [ambientAxes, setAmbientAxes] = useState<AxisValues | null>(null);
  // congelado = a leitura parou de andar: ecrã, barra, histórico, bipes e
  // vibração ficam no último valor, para marcar o pico sem olhar o número o
  // tempo todo. `frozenRef` espelha `frozen` porque o subscribe captura o
  // closure de quando foi feito (o efeito só depende de `active`).
  const [frozen, setFrozen] = useState(false);

  const filteredRef = useRef(0);
  const hasSampleRef = useRef(false);
  const subRef = useRef<ReturnType<typeof magnetometer.subscribe> | null>(null);
  const minRef = useRef<number | null>(null);
  const maxRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);
  const axesRef = useRef({ x: 0, y: 0, z: 0, init: false });
  const frozenRef = useRef(false);

  useEffect(() => {
    frozenRef.current = false;
    setFrozen(false);
    if (!active) {
      subRef.current?.unsubscribe();
      subRef.current = null;
      return;
    }
    setError(false);
    filteredRef.current = 0;
    hasSampleRef.current = false;
    axesRef.current.init = false;
    setValue(0);
    setAxes(null);
    setUpdateIntervalForType(SensorTypes.magnetometer, SAMPLE_INTERVAL);
    subRef.current = magnetometer.subscribe({
      next: ({ x, y, z }: { x: number; y: number; z: number }) => {
        if (frozenRef.current) return;
        const raw = Math.sqrt(x * x + y * y + z * z);
        const ema =
          filteredRef.current === 0
            ? raw
            : filteredRef.current * FILTER_ALPHA + raw * (1 - FILTER_ALPHA);
        filteredRef.current = ema;
        hasSampleRef.current = true;
        const axesEma = axesRef.current;
        if (!axesEma.init) {
          axesEma.x = x;
          axesEma.y = y;
          axesEma.z = z;
          axesEma.init = true;
        } else {
          axesEma.x = axesEma.x * FILTER_ALPHA + x * (1 - FILTER_ALPHA);
          axesEma.y = axesEma.y * FILTER_ALPHA + y * (1 - FILTER_ALPHA);
          axesEma.z = axesEma.z * FILTER_ALPHA + z * (1 - FILTER_ALPHA);
        }
        setAxes({
          x: Math.round(axesEma.x * 10) / 10,
          y: Math.round(axesEma.y * 10) / 10,
          z: Math.round(axesEma.z * 10) / 10,
        });
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
    setAmbient(null);
    setAmbientAxes(null);
    historyRef.current = [];
    setHistory([]);
  }, []);

  const captureAmbient = useCallback(() => {
    // sem amostra real, filteredRef ainda é 0 e gravar isso travaria a escala
    // em 100%; espera a primeira leitura do magnetômetro. Congelado também não
    // pode gravar: a leitura em ecrã não é mais o ambiente.
    if (!hasSampleRef.current || frozenRef.current) {
      return;
    }
    setAmbient(Math.round(filteredRef.current * 10) / 10);
    const axesEma = axesRef.current;
    if (axesEma.init) {
      setAmbientAxes({
        x: Math.round(axesEma.x * 10) / 10,
        y: Math.round(axesEma.y * 10) / 10,
        z: Math.round(axesEma.z * 10) / 10,
      });
    }
  }, []);

  const toggleFreeze = useCallback(() => {
    frozenRef.current = !frozenRef.current;
    setFrozen(frozenRef.current);
  }, []);

  const markHotspot = useCallback(() => {
    if (!hasFix) return;
    onAdd(`⚡ ${value.toFixed(1)}µT`);
  }, [hasFix, onAdd, value]);

  const delta = ambient === null || min === null ? 0 : Math.max(0, value - ambient);
  const span =
    ambient === null || max === null ? SCALE_MAX : Math.max(max - ambient, 8);
  const ratio =
    ambient === null
      ? Math.max(0, Math.min(1, value / SCALE_MAX))
      : Math.max(0, Math.min(1, delta / span));
  // nível baseado no desvio do ambiente (mesma medida da barra, do bipe e da
  // vibração): comparar o valor absoluto com 40/90 µT marca "alto" o tempo
  // inteiro em regiões de campo magnético alto e nunca reage a anomalias reais
  const levelColor =
    ratio >= HIGH_THRESHOLD
      ? colors.danger
      : ratio >= LOW_THRESHOLD
        ? colors.warning
        : colors.success;
  const levelLabel =
    ratio >= HIGH_THRESHOLD
      ? t('emf_high')
      : ratio >= LOW_THRESHOLD
        ? t('emf_medium')
        : t('emf_low');
  const axis = axes === null ? null : dominantAxis(axes, ambientAxes);

  const beepActive = active && !frozen && ratio > 0.08;
  const beepFreq = 240 + Math.pow(ratio, 1.4) * 660;
  const beepInterval = 720 - Math.pow(ratio, 1.4) * 620;
  useRepetitiveBeep({
    intervalMs: beepInterval,
    frequency: beepFreq,
    enabled: beepActive && soundAvailable,
  });

  useEffect(() => {
    if (!active || !beepActive) return;
    const id = setInterval(() => Vibration.vibrate(45), 420);
    return () => clearInterval(id);
  }, [active, beepActive]);

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
            <Pressable
              onPress={toggleFreeze}
              style={[
                styles.freezeChip,
                {
                  borderColor: frozen ? colors.accent : colors.border,
                  backgroundColor: frozen ? colors.surfaceAlt : 'transparent',
                },
              ]}>
              <Text
                style={[
                  styles.freezeChipText,
                  { color: frozen ? colors.accent : colors.textMuted },
                ]}>
                {frozen ? t('emf_unfreeze') : t('emf_freeze')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.badge}>
            <View style={[styles.dot, { backgroundColor: levelColor }]} />
            <Text style={[styles.badgeText, { color: levelColor }]}>
              {levelLabel}
            </Text>
          </View>

          {frozen && (
            <Text style={[styles.frozenText, { color: colors.accent }]}>
              {t('emf_frozen')}
            </Text>
          )}

          {ambient !== null && (
            <View style={styles.deltaRow}>
              <Text style={[styles.deltaText, { color: levelColor }]}>
                +{delta.toFixed(1)} µT · {t('emf_delta')}
              </Text>
            </View>
          )}

          {axes !== null && (
            <>
              <View style={styles.axisRow}>
                {(['x', 'y', 'z'] as const).map((key) => {
                  const dominant = axis === key;
                  return (
                    <View
                      key={key}
                      style={[
                        styles.axisChip,
                        {
                          backgroundColor: colors.surfaceAlt,
                          borderColor: dominant ? levelColor : colors.border,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.axisChipText,
                          { color: dominant ? levelColor : colors.textMuted },
                        ]}>
                        {key.toUpperCase()} {axes[key].toFixed(1)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.axisLegend, { color: colors.textMuted }]}>
                {t('emf_axis_dominant', { axis: axis ? axis.toUpperCase() : '--' })}
              </Text>
            </>
          )}

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

          <View style={styles.actionRow}>
            <Pressable
              onPress={captureAmbient}
              disabled={frozen}
              style={[styles.resetButton, { borderColor: colors.border }]}>
              <Text
                style={[styles.resetText, { color: frozen ? colors.textMuted : colors.text }]}>
                {t('emf_ambient')}
              </Text>
            </Pressable>

            <Pressable
              onPress={markHotspot}
              disabled={!hasFix}
              style={[
                styles.resetButton,
                { borderColor: hasFix ? colors.primary : colors.border },
              ]}>
              <Text
                style={[styles.resetText, { color: hasFix ? colors.primary : colors.textMuted }]}>
                {t('emf_hotspot')}
              </Text>
            </Pressable>

            <Pressable
              onPress={reset}
              style={[styles.resetButton, { borderColor: colors.border }]}>
              <Text style={[styles.resetText, { color: colors.text }]}>
                {t('emf_reset')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.hintRow}>
            {!hasFix && (
              <Text style={[styles.hintSmall, { color: colors.warning }]}>
                {t('emf_hotspot_nofix')}
              </Text>
            )}
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('emf_hint')}
            </Text>
          </View>
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
    freezeChip: {
      marginLeft: spacing.sm,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radius.full,
      borderWidth: 1,
      maxWidth: 140,
    },
    freezeChipText: {
      fontSize: 12,
      fontWeight: '800',
    },
    frozenText: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xs,
    },
    axisRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    axisChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    axisChipText: {
      fontSize: 13,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    axisLegend: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: spacing.xs,
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
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    resetText: {
      fontSize: 13,
      fontWeight: '800',
    },
    deltaRow: {
      marginTop: spacing.xs,
    },
    deltaText: {
      fontSize: 13,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    hintRow: {
      alignItems: 'center',
    },
    hintSmall: {
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: spacing.sm,
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
