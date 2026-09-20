import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing } from '../theme/colors';

type Props = {
  x: number;
  y: number;
  z: number;
  size?: number;
};

const LEVEL_TOLERANCE = 0.5;

const BubbleLevel = ({ x, y, z, size = 260 }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const radius = size / 2;

  const g = Math.sqrt(x * x + y * y + z * z) || 1;
  const tiltX = x / g;
  const tiltY = -y / g;
  const level = Math.max(0, 1 - Math.sqrt(tiltX * tiltX + tiltY * tiltY));
  const leveled = level >= 1 - LEVEL_TOLERANCE / 100;

  const bubbleMax = radius * 0.55;
  const bubbleOffset = Math.min(1, Math.sqrt(tiltX * tiltX + tiltY * tiltY)) * bubbleMax;
  const angle = Math.atan2(tiltY, tiltX);
  const bx = Math.cos(angle) * bubbleOffset;
  const by = Math.sin(angle) * bubbleOffset;

  return (
    <View
      style={[
        styles.panel,
        { width: size, height: size, borderRadius: radius },
        leveled && {
          borderColor: colors.accent,
          shadowColor: colors.success,
          shadowOpacity: 0.7,
          shadowRadius: 20,
          elevation: 14,
        },
      ]}>
      <View style={styles.reticleLines}>
        <View style={[styles.hLine, { backgroundColor: colors.border }]} />
        <View style={[styles.vLine, { backgroundColor: colors.border }]} />
      </View>

      <View
        style={[
          styles.bubble,
          leveled && { backgroundColor: colors.success, borderColor: colors.success },
          { transform: [{ translateX: bx }, { translateY: by }] },
        ]}
      />
      <View style={[styles.centerDot, { backgroundColor: colors.accent }]} />

      <View style={styles.readout}>
        <Text style={styles.levelLabel}>
          {leveled ? t('level_ok') : `${(level * 100).toFixed(0)}%`}
        </Text>
        <Text style={styles.coords}>
          X {tiltX.toFixed(2)} · Y {tiltY.toFixed(2)}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (colors: {
  surface: string;
  border: string;
  textMuted: string;
  text: string;
  accent: string;
  success: string;
}) =>
  StyleSheet.create({
    panel: {
      backgroundColor: colors.surface,
      borderWidth: 3,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    reticleLines: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hLine: {
      position: 'absolute',
      left: '14%',
      right: '14%',
      height: StyleSheet.hairlineWidth,
    },
    vLine: {
      position: 'absolute',
      top: '14%',
      bottom: '14%',
      width: StyleSheet.hairlineWidth,
    },
    bubble: {
      position: 'absolute',
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 3,
      borderColor: colors.accent,
      backgroundColor: colors.accent,
      opacity: 0.85,
    },
    centerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    readout: {
      position: 'absolute',
      bottom: spacing.sm,
      alignItems: 'center',
    },
    levelLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    coords: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
  });

export default BubbleLevel;