import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { formatDistance } from '../utils/geo';

type Props = {
  accel: { x: number; y: number; z: number };
  targetDistance: number | null;
};

const DIST_STEPS = [5, 1, 0.1];

// Elevação do aparelho em relação ao horizonte, em graus. Positivo = apontando
// para cima, negativo = apontando para baixo.
//
// Deliberadamente NÃO divide por G: com atan2(lateral, normal) a norma se
// cancela, então o resultado é idêntico se o sensor entregar m/s² (Android) ou
// g (iOS, CMAccelerometerData.acceleration). Também fica correto com o
// aparelho em movimento, não só em repouso.
//
// O eixo depende da orientação: em retrato, elevar o topo gira em torno de X
// (usa Y); deitado, elevar gira em torno de Y (usa X). Ler um eixo fixo — o
// bug original — devolvia sempre 0 em retrato, porque accel.x não varia quando
// o aparelho é inclinado para cima nessa orientação.
export const verticalAngle = (
  accel: { x: number; y: number; z: number },
  landscape: boolean,
): number => {
  const { x, y, z } = accel;
  if (![x, y, z].every(Number.isFinite)) {
    return 0;
  }
  const lateral = landscape ? x : y;
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (!(mag > 0)) {
    // vetor nulo (sensor ainda não calibrado): reporta 0 em vez de NaN
    return 0;
  }
  // componente perpendicular ao eixo de elevação: resto da norma. O sinal é
  // negativo em ambas as orientações: com o aparelho retido (z > 0), elevar o
  // topo joga a componente lateral para valor negativo.
  const rest = Math.sqrt(Math.max(0, mag * mag - lateral * lateral));
  const raw = (Math.atan2(-lateral, rest) * 180) / Math.PI;
  return Number.isFinite(raw) ? raw : 0;
};

const HeightView = ({ accel, targetDistance }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [top, setTop] = useState<number | null>(null);
  const [base, setBase] = useState<number | null>(null);
  const [distance, setDistance] = useState(10);
  const manualRef = useRef(false);
  const [landscape, setLandscape] = useState(
    (() => {
      const { width, height } = Dimensions.get('window');
      return width > height;
    })(),
  );

  useEffect(() => {
    const sub = Dimensions.addEventListener(
      'change',
      ({ window }: { window: { width: number; height: number } }) => {
        setLandscape(window.width > window.height);
      },
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (targetDistance != null && targetDistance > 0 && !manualRef.current) {
      setDistance(targetDistance);
    }
  }, [targetDistance]);

  const live = verticalAngle(accel, landscape);

  const capture = (which: 'top' | 'base') => {
    if (which === 'top') setTop(live);
    else setBase(live);
  };

  const clear = () => {
    setTop(null);
    setBase(null);
  };

  const useTargetDistance = () => {
    if (targetDistance != null && targetDistance > 0) {
      manualRef.current = false;
      setDistance(targetDistance);
    }
  };

  const usingTarget = targetDistance != null && targetDistance > 0;

  const height =
    top !== null && base !== null && distance > 0
      ? distance *
        (Math.tan(((top ?? 0) * Math.PI) / 180) -
          Math.tan(((base ?? 0) * Math.PI) / 180))
      : null;
  const validHeight = height !== null && height >= 0;
  const displayHeight = validHeight ? height : null;

  const adjustDist = (delta: number) => {
    manualRef.current = true;
    setDistance(prev => Math.max(0.5, Math.min(500, prev + delta)));
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textMuted }]}>
        {t('ht_title')}
      </Text>

      <View style={[styles.liveBox, { borderColor: colors.border }]}>
        <Text style={[styles.liveAngle, { color: colors.text }]}>
          {live.toFixed(1)}°
        </Text>
        <Text style={[styles.liveLabel, { color: colors.textMuted }]}>
          {t('ht_live')} {live > 0.5 ? '▲' : live < -0.5 ? '▼' : '●'}
        </Text>
      </View>

      <Text style={[styles.result, { color: colors.accent }]}>
        {displayHeight !== null ? formatDistance(displayHeight) : '—'}
      </Text>
      <Text style={[styles.resultLabel, { color: colors.textMuted }]}>
        {t('ht_result')}
      </Text>

      {top !== null && base !== null && !validHeight && height !== null && (
        <Text style={[styles.inverted, { color: colors.warning }]}>
          {t('ht_inverted')}
        </Text>
      )}

      <View style={styles.captureRow}>
        <Pressable
          onPress={() => capture('base')}
          style={[
            styles.captureButton,
            { borderColor: colors.border, backgroundColor: base !== null ? colors.primary + '22' : colors.surfaceAlt },
          ]}>
          <Text style={[styles.captureEmoji, { color: colors.warning }]}>▼</Text>
          <Text style={[styles.captureText, { color: colors.text }]}>
            {t('ht_base')}
          </Text>
          <Text style={[styles.captureValue, { color: colors.textMuted }]}>
            {base === null ? '—' : `${base.toFixed(1)}°`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => capture('top')}
          style={[
            styles.captureButton,
            { borderColor: colors.border, backgroundColor: top !== null ? colors.primary + '22' : colors.surfaceAlt },
          ]}>
          <Text style={[styles.captureEmoji, { color: colors.accent }]}>▲</Text>
          <Text style={[styles.captureText, { color: colors.text }]}>
            {t('ht_top')}
          </Text>
          <Text style={[styles.captureValue, { color: colors.textMuted }]}>
            {top === null ? '—' : `${top.toFixed(1)}°`}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.distBox, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={[styles.distLabel, { color: colors.textMuted }]}>
          {t('ht_distance')}
        </Text>
        <View style={styles.distRow}>
          <Pressable
            onPress={() => adjustDist(-0.1)}
            style={[styles.distBtn, { borderColor: colors.border }]}>
            <Text style={[styles.distBtnText, { color: colors.primary }]}>−</Text>
          </Pressable>
          <Text style={[styles.distValue, { color: colors.text }]}>
            {distance.toFixed(distance % 1 !== 0 ? 1 : 0)} m
          </Text>
          <Pressable
            onPress={() => adjustDist(0.1)}
            style={[styles.distBtn, { borderColor: colors.border }]}>
            <Text style={[styles.distBtnText, { color: colors.primary }]}>+</Text>
          </Pressable>
          {usingTarget && (
            <Pressable
              onPress={useTargetDistance}
              style={[styles.targetChip, { borderColor: colors.accent + '66' }]}>
              <Text style={[styles.targetChipText, { color: colors.accent }]}>
                {t('ht_use_target', {
                  d: formatDistance(targetDistance!),
                })}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.distSteps}>
          {DIST_STEPS.map(step => (
            <Pressable
              key={step}
              onPress={() => adjustDist(step)}
              style={[styles.distStepBtn, { borderColor: colors.border }]}>
              <Text style={[styles.distStepText, { color: colors.textMuted }]}>
                +{step} m
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        {(top !== null || base !== null) && (
          <Pressable
            onPress={clear}
            style={[styles.actionButton, { borderColor: colors.border }]}>
            <Text style={[styles.actionText, { color: colors.text }]}>
              {t('ht_clear')}
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('ht_hint')}
      </Text>
    </View>
  );
};

const createStyles = (_colors: {
  background: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  primary: string;
  warning: string;
  surfaceAlt: string;
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    title: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    liveBox: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      alignItems: 'center',
    },
    liveAngle: {
      fontSize: 40,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    liveLabel: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    result: {
      fontSize: 52,
      fontWeight: '900',
      marginTop: spacing.lg,
      fontVariant: ['tabular-nums'],
    },
    resultLabel: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    inverted: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    captureRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
      maxWidth: 340,
    },
    captureButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    captureEmoji: {
      fontSize: 20,
      fontWeight: '900',
    },
    captureText: {
      fontSize: 13,
      fontWeight: '800',
      marginTop: 2,
    },
    captureValue: {
      fontSize: 12,
      marginTop: 2,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    distBox: {
      alignSelf: 'stretch',
      maxWidth: 340,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    distLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    distRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    distBtn: {
      width: 34,
      height: 30,
      borderRadius: radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    distBtnText: {
      fontSize: 18,
      fontWeight: '900',
    },
    distValue: {
      fontSize: 20,
      fontWeight: '900',
      minWidth: 64,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    targetChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.full,
      borderWidth: 1,
      marginLeft: spacing.sm,
    },
    targetChipText: {
      fontSize: 11,
      fontWeight: '800',
    },
    distSteps: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    distStepBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    distStepText: {
      fontSize: 11,
      fontWeight: '700',
    },
    actions: {
      flexDirection: 'row',
      marginTop: spacing.md,
      maxWidth: 340,
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
    hint: {
      fontSize: 12,
      textAlign: 'center',
      marginTop: spacing.lg,
      lineHeight: 18,
      maxWidth: 320,
    },
  });

export default HeightView;