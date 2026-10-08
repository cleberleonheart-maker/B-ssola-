import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Vibration } from 'react-native';
import {
  accelerometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import type { ColorScheme } from '../theme/themes';
import { beep } from '../services/sound';
import {
  CADENCE_BPM,
  clampBpm,
  loadCadenceBpm,
  saveCadenceBpm,
  loadCadenceMode,
  saveCadenceMode,
  type CadenceMode,
} from '../services/preferencesService';
import { createStepDetector } from '../utils/stepDetector';

const BPM_MIN = CADENCE_BPM.min;
const BPM_MAX = CADENCE_BPM.max;
const BPM_STEP = CADENCE_BPM.step;
const BPM_DEFAULT = CADENCE_BPM.fallback;
// tick curto e agudo: distingue-se do bipe do detector de metais (que varia a
// frequência com a leitura) e não cansa a cada 500 ms
const TICK_FREQ = 1200;
const TICK_MS = 40;
const VIBRATE_MS = 20;
const FLASH_MS = 130;
// amostras a 50 Hz para apanhar a passada; volta ao ritmo habitual ao sair
const STEP_SAMPLE_MS = 20;
const SENSOR_DEFAULT_RATE = 200;

type Props = {
  active?: boolean;
};

const CadenceView = ({ active = false }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bpm, setBpm] = useState<number>(BPM_DEFAULT);
  const [mode, setMode] = useState<CadenceMode>('timer');
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    loadCadenceBpm()
      .then(saved => {
        if (mounted) setBpm(saved);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    loadCadenceMode()
      .then(saved => {
        if (mounted) setMode(saved);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // o som vive dentro do intervalo (não em callback do render), mas o efeito
  // precisa de `tick` estável para não recriar o timer a cada contagem
  const tick = useCallback(() => {
    beep(TICK_FREQ, TICK_MS);
    Vibration.vibrate(VIBRATE_MS);
    setCount(prev => prev + 1);
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), FLASH_MS);
  }, []);

  useEffect(() => {
    if (!running) return;
    if (mode === 'timer') tick();
  }, [running, mode, tick]);

  useEffect(() => {
    if (mode === 'timer' && running) {
      const id = setInterval(tick, Math.round(60000 / bpm));
      return () => clearInterval(id);
    }
  }, [running, bpm, mode, tick]);

  // modo "no seu passo": o bipe segue a passada real, lida pelo acelerómetro
  useEffect(() => {
    if (!active || !running || mode !== 'step') return;
    setUpdateIntervalForType(SensorTypes.accelerometer, STEP_SAMPLE_MS);
    const detector = createStepDetector();
    const sub = accelerometer.subscribe({
      next: ({ x, y, z }) => {
        if (detector.push(Date.now(), x, y, z)) tick();
      },
      error: () => {
        setError(true);
        setRunning(false);
      },
    });
    return () => {
      sub.unsubscribe();
      setUpdateIntervalForType(SensorTypes.accelerometer, SENSOR_DEFAULT_RATE);
    };
  }, [active, running, mode, tick]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const changeBpm = useCallback((next: number) => {
    const value = clampBpm(next);
    setBpm(value);
    saveCadenceBpm(value).catch(() => {});
  }, []);

  const changeMode = useCallback((next: CadenceMode) => {
    setMode(next);
    setRunning(false);
    setError(false);
    saveCadenceMode(next).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    // a contagem acumula: parar e voltar a andar não perde o que já foi
    // caminhado (só sair do modo dá sessão nova)
    setRunning(prev => {
      if (!prev) setError(false);
      return !prev;
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textMuted }]}>
        {t('cad_title')}
      </Text>

      <View
        style={[
          styles.pulseWrap,
          {
            borderColor: flash ? colors.primary : colors.border,
            backgroundColor: flash ? colors.surfaceAlt : colors.surface,
          },
        ]}>
        <View
          style={[
            styles.pulse,
            {
              backgroundColor: running ? colors.primary : colors.border,
              transform: [{ scale: flash ? 1 : 0.55 }],
            },
          ]}
        />
      </View>

      <View style={styles.modeRow}>
        <Pressable
          onPress={() => changeMode('timer')}
          style={[
            styles.modeChip,
            {
              borderColor: mode === 'timer' ? colors.primary : colors.border,
              backgroundColor:
                mode === 'timer' ? colors.surfaceAlt : 'transparent',
            },
          ]}>
          <Text
            style={[
              styles.modeText,
              {
                color: mode === 'timer' ? colors.primary : colors.textMuted,
              },
            ]}>
            {t('cad_mode_timer')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => changeMode('step')}
          style={[
            styles.modeChip,
            {
              borderColor: mode === 'step' ? colors.primary : colors.border,
              backgroundColor:
                mode === 'step' ? colors.surfaceAlt : 'transparent',
            },
          ]}>
          <Text
            style={[
              styles.modeText,
              {
                color: mode === 'step' ? colors.primary : colors.textMuted,
              },
            ]}>
            {t('cad_mode_step')}
          </Text>
        </Pressable>
      </View>

      {mode === 'timer' ? (
        <View style={styles.bpmRow}>
          <Pressable
            onPress={() => changeBpm(bpm - BPM_STEP)}
            disabled={bpm <= BPM_MIN}
            hitSlop={8}
            style={[
              styles.stepButton,
              {
                borderColor: bpm <= BPM_MIN ? colors.border : colors.primary,
              },
            ]}>
            <Text
              style={[
                styles.stepButtonText,
                { color: bpm <= BPM_MIN ? colors.textMuted : colors.primary },
              ]}>
              −
            </Text>
          </Pressable>

          <View style={styles.bpmBlock}>
            <Text style={[styles.bpmValue, { color: colors.text }]}>{bpm}</Text>
            <Text style={[styles.bpmUnit, { color: colors.textMuted }]}>
              {t('cad_unit')}
            </Text>
          </View>

          <Pressable
            onPress={() => changeBpm(bpm + BPM_STEP)}
            disabled={bpm >= BPM_MAX}
            hitSlop={8}
            style={[
              styles.stepButton,
              {
                borderColor: bpm >= BPM_MAX ? colors.border : colors.primary,
              },
            ]}>
            <Text
              style={[
                styles.stepButtonText,
                { color: bpm >= BPM_MAX ? colors.textMuted : colors.primary },
              ]}>
              +
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={toggle}
        style={[
          styles.startButton,
          {
            borderColor: running ? colors.danger : colors.primary,
            backgroundColor: running ? colors.danger : 'transparent',
          },
        ]}>
        <Text
          style={[
            styles.startText,
            { color: running ? colors.background : colors.primary },
          ]}>
          {running ? t('cad_stop') : t('cad_start')}
        </Text>
      </Pressable>

      <Text style={[styles.count, { color: colors.text }]}>
        {t('cad_count', { n: String(count) })}
      </Text>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>
          {t('cad_sensor_error')}
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {mode === 'timer' ? t('cad_hint') : t('cad_hint_step')}
        </Text>
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
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    pulseWrap: {
      width: 90,
      height: 90,
      borderRadius: 45,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    pulse: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    modeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    modeChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      borderWidth: 2,
    },
    modeText: {
      fontSize: 14,
      fontWeight: '800',
    },
    bpmRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginBottom: spacing.lg,
    },
    stepButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepButtonText: {
      fontSize: 26,
      fontWeight: '900',
      lineHeight: 30,
    },
    bpmBlock: {
      alignItems: 'center',
      minWidth: 130,
    },
    bpmValue: {
      fontSize: 64,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
      lineHeight: 68,
    },
    bpmUnit: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    startButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.full,
      borderWidth: 2,
    },
    startText: {
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 1,
    },
    count: {
      marginTop: spacing.lg,
      fontSize: 20,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    hint: {
      marginTop: spacing.md,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 320,
    },
    error: {
      marginTop: spacing.md,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 320,
    },
  });

export default CadenceView;