import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Vibration } from 'react-native';
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
} from '../services/preferencesService';

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

const CadenceView = () => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bpm, setBpm] = useState<number>(BPM_DEFAULT);
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
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
    tick();
  }, [running, tick]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, Math.round(60000 / bpm));
    return () => clearInterval(id);
  }, [running, bpm, tick]);

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

  const toggle = useCallback(() => {
    // a contagem acumula: parar e voltar a andar não perde o que já foi
    // caminhado (só sair do modo dá sessão nova)
    setRunning(prev => !prev);
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
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('cad_hint')}
      </Text>
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
    pulseWrap: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    pulse: {
      width: 74,
      height: 74,
      borderRadius: 37,
    },
    bpmRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
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
      marginTop: spacing.lg,
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
      marginTop: spacing.lg,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 320,
    },
  });

export default CadenceView;
