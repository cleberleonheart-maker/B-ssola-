import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { DIRECTIONS } from '../utils/compass';

type Props = {
  rotation: number;
  size?: number;
  sun?: { azimuth: number; elevation: number; visible: boolean } | null;
  moon?: { azimuth: number; elevation: number; visible: boolean } | null;
  moonIcon?: string;
  target?: { bearing: number; name: string } | null;
};

type ExtraMarker = {
  key: string;
  icon: string;
  angle: number;
  label: string;
  sub: string;
  dim: boolean;
};

const NUMERAL_ANGLES = [30, 60, 120, 150, 210, 240, 300, 330];

const CompassDial = ({
  rotation,
  size = 280,
  sun,
  moon,
  moonIcon = '🌙',
  target,
}: Props) => {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const radius = size / 2;

  const animatedRotation = useRef(new Animated.Value(rotation)).current;

  const ticks = useMemo(() => {
    const list: { angle: number; tier: 'major' | 'medium' | 'minor' }[] = [];
    for (let angle = 0; angle < 360; angle += 15) {
      const tier =
        angle % 45 === 0 ? 'major' : angle % 30 === 0 ? 'medium' : 'minor';
      list.push({ angle, tier });
    }
    return list;
  }, []);

  useEffect(() => {
    const animation = Animated.timing(animatedRotation, {
      toValue: rotation,
      duration: 120,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [rotation, animatedRotation]);

  const labelRadius = radius * 0.75;
  const numberRadius = radius * 0.5;
  const tickOuter = radius - 5;
  const tickInner = radius - size * 0.105;
  const ringSize = (tickInner - 3) * 2;
  const ringOuter = radius * 0.63;
  const celestialRadius = radius * 0.92;

  const extraMarkers = useMemo<ExtraMarker[]>(() => {
    const list: ExtraMarker[] = [];
    if (sun) {
      list.push({
        key: 'sun',
        icon: '☀️',
        angle: sun.azimuth,
        label: `${sun.elevation >= 0 ? '' : '↓'}${Math.round(sun.elevation)}°`,
        sub: 'Sol',
        dim: !sun.visible,
      });
    }
    if (moon) {
      list.push({
        key: 'moon',
        icon: moonIcon,
        angle: moon.azimuth,
        label: `${moon.elevation >= 0 ? '' : '↓'}${Math.round(moon.elevation)}°`,
        sub: 'Lua',
        dim: !moon.visible,
      });
    }
    if (target) {
      list.push({
        key: 'target',
        icon: '📍',
        angle: target.bearing,
        label: target.name,
        sub: 'Destino',
        dim: false,
      });
    }
    return list;
  }, [sun, moon, moonIcon, target]);

  const plateRotate = animatedRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <View
        style={[
          styles.dial,
          { borderRadius: radius },
          styles.dialGlow,
        ]}
        accessible
        accessibilityLabel={`Bússola ${rotation.toFixed(0)} graus`}>
        <Animated.View
          style={[
            styles.plate,
            { borderRadius: radius },
            { transform: [{ rotate: plateRotate }] },
          ]}>
          {ticks.map(tick => {
            const isNorth = tick.angle === 0 || tick.angle === 360;
            return (
              <View
                key={tick.angle}
                style={[
                  styles.tick,
                  styles[`tick_${tick.tier}`],
                  isNorth ? styles.tickNorth : null,
                  {
                    height: tickOuter - tickInner,
                    transform: [
                      { rotate: `${tick.angle}deg` },
                      { translateY: -(tickOuter + tickInner) / 2 },
                      { rotate: `-${tick.angle}deg` },
                    ],
                  },
                ]}
              />
            );
          })}

          <View
            style={[
              styles.innerRing,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
              },
            ]}
          />

          <View
            style={[
              styles.secondRing,
              {
                width: ringOuter * 2,
                height: ringOuter * 2,
                borderRadius: ringOuter,
              },
            ]}
          />

          {NUMERAL_ANGLES.map(angle => (
            <View
              key={angle}
              style={[
                styles.numberMarker,
                {
                  transform: [
                    { rotate: `${angle}deg` },
                    { translateY: -numberRadius },
                    { rotate: `-${angle}deg` },
                  ],
                },
              ]}>
              <Text style={styles.numberText}>{angle}</Text>
            </View>
          ))}

          {DIRECTIONS.map((dir, index) => {
            const angle = index * 45;
            const isNorth = dir === 'N';
            return (
              <View
                key={dir}
                style={[
                  styles.marker,
                  {
                    transform: [
                      { rotate: `${angle}deg` },
                      { translateY: -labelRadius },
                      { rotate: `-${angle}deg` },
                    ],
                  },
                ]}>
                <View
                  style={[
                    styles.markerPill,
                    isNorth ? styles.markerPillNorth : styles.markerPillOther,
                  ]}>
                  <Text
                    style={[
                      styles.markerText,
                      isNorth ? styles.markerNorth : styles.markerOther,
                    ]}>
                    {dir}
                  </Text>
                </View>
              </View>
            );
          })}

          {extraMarkers.map(marker => (
            <View
              key={marker.key}
              style={[
                styles.celestial,
                {
                  transform: [
                    { rotate: `${marker.angle}deg` },
                    { translateY: -celestialRadius },
                    { rotate: `-${marker.angle}deg` },
                  ],
                },
              ]}>
              <Text
                style={[
                  styles.celestialIcon,
                  marker.dim && styles.celestialDim,
                  marker.key === 'target' && styles.targetIcon,
                ]}>
                {marker.icon}
              </Text>
              <Text
                style={[
                  styles.celestialLabel,
                  marker.dim && styles.celestialDim,
                  marker.sub === 'Sol' && styles.sunLabel,
                  marker.sub === 'Lua' && styles.moonLabel,
                  marker.key === 'target' && styles.targetLabel,
                ]}>
                {marker.label}
              </Text>
            </View>
          ))}
        </Animated.View>

        <View style={styles.needle}>
          <View style={styles.needleArm}>
            <View style={[styles.northTip, { borderTopColor: colors.north }]} />
            <View
              style={[
                styles.southTip,
                { borderBottomColor: colors.textMuted },
              ]}
            />
          </View>
          <View style={styles.centerRing} />
          <View style={styles.centerCap} />
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  north: string;
  accent: string;
  primary: string;
}) =>
  StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    dial: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.primary + '66',
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 10,
    },
    dialGlow: {
      shadowColor: colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 26,
    },
    plate: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tick: {
      position: 'absolute',
      alignSelf: 'center',
    },
    tick_major: {
      width: 3.5,
      borderRadius: 2,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 4,
      elevation: 2,
    },
    tick_medium: {
      width: 2,
      borderRadius: 1,
      backgroundColor: colors.textMuted,
      opacity: 0.6,
    },
    tick_minor: {
      width: 1.5,
      backgroundColor: colors.border,
    },
    tickNorth: {
      backgroundColor: colors.north,
      width: 4.5,
      shadowColor: colors.north,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 5,
      elevation: 2,
    },
    innerRing: {
      position: 'absolute',
      alignSelf: 'center',
      borderWidth: 1.5,
      borderColor: colors.primary + '99',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
    },
    secondRing: {
      position: 'absolute',
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      opacity: 0.9,
    },
    numberMarker: {
      position: 'absolute',
      alignSelf: 'center',
      width: 48,
      alignItems: 'center',
    },
    numberText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      opacity: 0.9,
      textShadowColor: colors.primary + '55',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 6,
    },
    marker: {
      position: 'absolute',
      alignSelf: 'center',
      width: 38,
      alignItems: 'center',
    },
    markerPill: {
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
    },
    markerPillNorth: {
      borderColor: colors.north,
      backgroundColor: colors.north,
      shadowColor: colors.north,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 12,
      elevation: 5,
    },
    markerPillOther: {
      borderColor: colors.border,
      backgroundColor: colors.surface + 'CC',
    },
    markerText: {
      fontSize: 18,
      fontWeight: '900',
    },
    markerNorth: {
      color: colors.background,
    },
    markerOther: {
      color: colors.text,
      textShadowColor: colors.primary + '66',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    celestial: {
      position: 'absolute',
      alignSelf: 'center',
      width: 64,
      alignItems: 'center',
    },
    celestialIcon: {
      fontSize: 16,
    },
    targetIcon: {
      fontSize: 19,
    },
    celestialLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.textMuted,
      marginTop: 1,
      maxWidth: 64,
      textAlign: 'center',
    },
    sunLabel: {
      color: colors.accent,
    },
    moonLabel: {
      color: colors.primary,
    },
    targetLabel: {
      color: colors.north,
      fontSize: 10,
    },
    celestialDim: {
      opacity: 0.45,
    },
    needle: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    needleArm: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    northTip: {
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderTopWidth: 58,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      shadowColor: colors.north,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 6,
    },
    southTip: {
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderBottomWidth: 58,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      marginTop: -16,
    },
    centerRing: {
      position: 'absolute',
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.accent + '88',
    },
    centerCap: {
      position: 'absolute',
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.accent,
      borderWidth: 3,
      borderColor: colors.surface,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 8,
      elevation: 4,
    },
  });

export default CompassDial;