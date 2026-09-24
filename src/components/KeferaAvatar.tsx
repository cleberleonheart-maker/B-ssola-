import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';

type KeferaAvatarProps = {
  size: number;
  listening?: boolean;
  dim?: boolean;
};

const KeferaAvatar = ({ size, listening = false, dim = false }: KeferaAvatarProps) => {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    root: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  const glow = listening ? colors.danger : colors.primary;
  const needle = listening ? colors.danger : colors.accent;

  const pulse = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const settle = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 3800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: 0,
          duration: 3800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    settle.start();
    return () => {
      loop.stop();
      settle.stop();
    };
  }, [pulse, sway]);

  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.9],
  });
  const needleRotate = sway.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '10deg'],
  });

  const ticks = Array.from({ length: 12 });
  const sat = Array.from({ length: 2 });

  return (
    <View style={[styles.root, dim && { opacity: 0.55 }]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size * 0.86,
          height: size * 0.86,
          borderRadius: (size * 0.86) / 2,
          backgroundColor: glow + '2E',
          transform: [{ scale: haloScale }],
          opacity: haloOpacity,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.7,
          height: size * 0.7,
          borderRadius: (size * 0.7) / 2,
          borderWidth: 1.5,
          borderColor: glow,
          opacity: 0.55,
        }}
      />
      {ticks.map((_, i) => {
        const major = i % 3 === 0;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: major ? 2.5 : 1.5,
              height: major ? size * 0.07 : size * 0.045,
              borderRadius: 1,
              backgroundColor: major ? glow : colors.textMuted + '66',
              top: size / 2 - (major ? size * 0.035 : size * 0.0225),
              left: size / 2 - (major ? 1.25 : 0.75),
              transform: [
                { rotate: `${i * 30}deg` },
                { translateY: -size * 0.26 },
              ],
            }}
          />
        );
      })}
      {sat.map((_, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size * 0.045,
            height: size * 0.045,
            borderRadius: (size * 0.045) / 2,
            backgroundColor: i === 0 ? colors.primary : colors.accent,
            opacity: 0.9,
            top: size / 2 - (size * 0.045) / 2,
            left: size / 2 - (size * 0.045) / 2,
            transform: [
              { rotate: i === 0 ? '35deg' : '215deg' },
              { translateY: -size * 0.33 },
            ],
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          width: size * 0.52,
          height: size * 0.52,
          borderRadius: (size * 0.52) / 2,
          backgroundColor: colors.surface + 'F2',
          borderWidth: 1.5,
          borderColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: glow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: size * 0.12,
          elevation: 4,
        }}>
        <View
          style={{
            position: 'absolute',
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: (size * 0.4) / 2,
            backgroundColor: colors.primary + '18',
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate: needleRotate }],
          }}>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: size * 0.045,
              borderRightWidth: size * 0.045,
              borderBottomWidth: size * 0.14,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: colors.primary,
            }}
          />
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: size * 0.045,
              borderRightWidth: size * 0.045,
              borderTopWidth: size * 0.14,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: needle,
            }}
          />
        </Animated.View>
        <View
          style={{
            position: 'absolute',
            width: size * 0.07,
            height: size * 0.07,
            borderRadius: (size * 0.07) / 2,
            backgroundColor: colors.background,
            borderWidth: 1.5,
            borderColor: glow,
          }}
        />
      </View>
    </View>
  );
};

export default KeferaAvatar;