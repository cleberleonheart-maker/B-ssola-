import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing } from '../theme/colors';
import { cardinalOf } from '../utils/compass';
import { formatDistance } from '../utils/geo';
import type { CelestialPoint } from '../utils/astro';

type Props = {
  heading: number;
  rotation: number;
  size: number;
  sun: CelestialPoint | null;
  moon: CelestialPoint | null;
  moonIcon: string;
  target: { name: string; bearing: number; distance: number } | null;
  virtual: { name: string; bearing: number; distance: number } | null;
  blocked: string | null;
};

type Marker = {
  key: string;
  icon: string;
  angle: number;
  label: string;
  sub?: string;
  dim?: boolean;
  emph?: boolean;
};

const AROverlay = ({
  heading,
  rotation,
  size,
  sun,
  moon,
  moonIcon,
  target,
  virtual,
  blocked,
}: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const radius = size / 2;
  const markerRadius = radius * 0.92;

  const animatedRotation = useRef(new Animated.Value(rotation)).current;
  useEffect(() => {
    const animation = Animated.timing(animatedRotation, {
      toValue: rotation,
      duration: 120,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [rotation, animatedRotation]);

  const roll = animatedRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '-360deg'],
  });

  const markers: Marker[] = [];
  if (sun) {
    markers.push({
      key: 'sun',
      icon: '☀️',
      angle: sun.azimuth,
      label: `${sun.elevation >= 0 ? '' : '↓ '}${Math.round(sun.elevation)}°`,
      sub: t('ui_sun_short'),
      dim: !sun.visible,
    });
  }
  if (moon) {
    markers.push({
      key: 'moon',
      icon: moonIcon,
      angle: moon.azimuth,
      label: `${moon.elevation >= 0 ? '' : '↓ '}${Math.round(moon.elevation)}°`,
      sub: t('ui_moon_short'),
      dim: !moon.visible,
    });
  }
  if (target) {
    markers.push({
      key: 'target',
      icon: '📍',
      angle: target.bearing,
      label: formatDistance(target.distance),
      sub: target.name,
    });
  }
  if (virtual) {
    markers.push({
      key: 'vmark',
      icon: '◆',
      angle: virtual.bearing,
      label: formatDistance(virtual.distance),
      sub: virtual.name,
    });
  }
  markers.push(
    ...[
      { key: 'N', icon: t('ui_dir_n'), angle: 0, label: '', sub: '', emph: true },
      { key: 'S', icon: t('ui_dir_s'), angle: 180, label: '', sub: '' },
      { key: 'E', icon: t('ui_dir_e'), angle: 90, label: '', sub: '' },
      { key: 'W', icon: t('ui_dir_w'), angle: 270, label: '', sub: '' },
    ],
  );

  const cardinal = cardinalOf(heading);

  return (
    <View
      style={[
        styles.overlay,
        { width: size, height: size, borderRadius: radius },
      ]}>
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          { width: size * 0.78, height: size * 0.78, borderRadius: size * 0.39 },
        ]}
      />
      <Animated.View
        style={[styles.ring, { borderRadius: radius }, { transform: [{ rotate: roll }] }]}>
        {markers.map(marker => (
          <View
            key={marker.key}
            style={[
              styles.marker,
              {
                transform: [
                  { rotate: `${marker.angle}deg` },
                  { translateY: -markerRadius },
                  { rotate: `-${marker.angle}deg` },
                ],
              },
            ]}>
            <Text
              style={[
                styles.markerIcon,
                marker.emph ? styles.cardinalEmph : marker.dim ? styles.markerDim : null,
              ]}>
              {marker.icon}
            </Text>
            {!!marker.label && (
              <Text style={[styles.markerLabel, marker.dim && styles.markerDimLabel]}>
                {marker.label}
              </Text>
            )}
            {!!marker.sub && (
              <Text style={[styles.markerSub, marker.dim && styles.markerDimLabel]}>
                {marker.sub}
              </Text>
            )}
          </View>
        ))}
      </Animated.View>

      <View style={styles.centerCross}>
        <View style={[styles.crossH, { backgroundColor: colors.border }]} />
        <View style={[styles.crossV, { backgroundColor: colors.border }]} />
        <View style={[styles.crossDot, { backgroundColor: colors.accent }]} />
      </View>

      <View style={styles.topBar}>
        <Text style={styles.topHeading}>{Math.round(heading).toString().padStart(3, '0')}°</Text>
        <Text style={styles.topCardinal}>{cardinal.full}</Text>
      </View>

      {blocked && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>{blocked}</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: {
  background: string;
  border: string;
  text: string;
  textMuted: string;
  north: string;
  accent: string;
  primary: string;
  surface: string;
  surfaceAlt: string;
}) =>
  StyleSheet.create({
    overlay: {
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: colors.border,
    },
    glow: {
      position: 'absolute',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    ring: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    marker: {
      position: 'absolute',
      alignSelf: 'center',
      width: 64,
      alignItems: 'center',
    },
    markerIcon: {
      fontSize: 22,
    },
    cardinalEmph: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.north,
    },
    markerDim: {
      opacity: 0.4,
    },
    markerLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
      marginTop: 1,
    },
    markerSub: {
      fontSize: 9,
      color: colors.textMuted,
      maxWidth: 64,
      textAlign: 'center',
    },
    markerDimLabel: {
      opacity: 0.5,
    },
    centerCross: {
      position: 'absolute',
      top: '50%',
      left: '50%',
    },
    crossH: {
      width: 24,
      height: 1.5,
      marginLeft: -12,
    },
    crossV: {
      width: 1.5,
      height: 24,
      marginTop: -12,
    },
    crossDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      position: 'absolute',
      marginLeft: -4,
      marginTop: -4,
    },
    topBar: {
      position: 'absolute',
      top: spacing.lg,
      alignItems: 'center',
    },
    topHeading: {
      fontSize: 34,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: 2,
    },
    topCardinal: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
      marginTop: 2,
    },
    warning: {
      position: 'absolute',
      bottom: spacing.md,
      left: spacing.md,
      right: spacing.md,
      backgroundColor: colors.surface,
      borderColor: colors.north,
      borderWidth: 1,
      borderRadius: 12,
      padding: spacing.sm,
    },
    warningText: {
      color: colors.north,
      textAlign: 'center',
      fontSize: 12,
    },
  });

export default AROverlay;