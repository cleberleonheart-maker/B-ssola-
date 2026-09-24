import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import {
  haversine,
  initialBearing,
  formatDistance,
} from '../utils/geo';
import { cardinalOf, normalizeHeading, formatAzimuth } from '../utils/compass';
import { carSpotService, type CarSpot } from '../services/carSpotService';

type Props = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number;
  hasFix: boolean;
  mils?: boolean;
};

const ARRIVED_M = 25;

const CarSpotView = ({
  latitude,
  longitude,
  accuracy,
  heading,
  hasFix,
  mils = false,
}: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [car, setCar] = useState<CarSpot | null>(null);

  useEffect(() => {
    carSpotService
      .load()
      .then(spot => setCar(spot))
      .catch(() => {});
  }, []);

  const mark = useCallback(() => {
    if (!hasFix) return;
    const spot: CarSpot = {
      latitude,
      longitude,
      accuracy,
      parkedAt: Date.now(),
    };
    setCar(spot);
    carSpotService.save(spot).catch(() => {});
  }, [hasFix, latitude, longitude, accuracy]);

  const clear = useCallback(() => {
    setCar(null);
    carSpotService.clear().catch(() => {});
  }, []);

  if (!hasFix) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textMuted }]}>
          {t('car_title')}
        </Text>
        <Text style={[styles.emoji, styles.emojiMid]}>🚗</Text>
        <Text style={[styles.noFix, { color: colors.textMuted }]}>
          {t('car_no_fix')}
        </Text>
      </View>
    );
  }

  if (!car) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textMuted }]}>
          {t('car_title')}
        </Text>
        <Text style={[styles.emoji, styles.emojiBig]}>🅿️</Text>
        <Text style={[styles.hintText, { color: colors.textMuted }]}>
          {t('car_mark_hint')}
        </Text>
        <Pressable
          onPress={mark}
          style={[styles.mainButton, { backgroundColor: colors.primary }]}>
          <Text style={[styles.mainButtonText, { color: colors.background }]}>
            {t('car_mark')}
          </Text>
        </Pressable>
      </View>
    );
  }

  const distance = hasFix
    ? haversine(latitude, longitude, car.latitude, car.longitude)
    : null;
  const bearingTo = hasFix
    ? initialBearing(latitude, longitude, car.latitude, car.longitude)
    : 0;
  const relAngle = normalizeHeading(bearingTo - heading);
  const arrived = distance !== null && distance <= ARRIVED_M;
  const cardinal = cardinalOf(bearingTo);
  const parkedTime = new Date(car.parkedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const arrowColor = arrived ? colors.success : colors.accent;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textMuted }]}>
        {t('car_title')}
      </Text>

      <View style={[styles.ring, { borderColor: colors.border }]}>
        <View style={[styles.ringInner, { borderColor: colors.border }]}>
          <Text
            style={[
              styles.arrow,
              {
                color: arrowColor,
                transform: [{ rotate: `${relAngle}deg` }],
              },
            ]}>
            ▲
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.distance,
          { color: arrived ? colors.success : colors.text },
        ]}>
        {arrived ? t('car_arrived') : distance !== null ? formatDistance(distance) : '—'}
      </Text>
      <Text style={[styles.carSub, { color: colors.textMuted }]}>
        {arrived ? `🚙 ${formatDistance(distance ?? 0)}` : `${cardinal.full} · ${formatAzimuth(bearingTo, mils)}`}
      </Text>
      <Text style={[styles.time, { color: colors.textMuted }]}>
        {t('car_parked_at', { time: parkedTime })}
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={clear}
          style={[styles.actionButton, { borderColor: colors.border }]}>
          <Text style={[styles.actionText, { color: colors.text }]}>
            {t('car_clear')}
          </Text>
        </Pressable>
        <Pressable
          onPress={mark}
          style={[styles.actionButton, { borderColor: colors.primary }]}>
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {t('car_remark')}
          </Text>
        </Pressable>
      </View>

      {car.accuracy != null && (
        <Text style={[styles.time, { color: colors.textMuted }]}>
          ±{Math.round(car.accuracy)} m
        </Text>
      )}
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
  success: string;
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
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    emoji: {
      textAlign: 'center',
    },
    emojiMid: {
      fontSize: 44,
    },
    emojiBig: {
      fontSize: 60,
    },
    hintText: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      maxWidth: 300,
      marginVertical: spacing.lg,
    },
    noFix: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      maxWidth: 300,
      marginTop: spacing.lg,
    },
    mainButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.full,
    },
    mainButtonText: {
      fontSize: 15,
      fontWeight: '800',
    },
    ring: {
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringInner: {
      width: 124,
      height: 124,
      borderRadius: 62,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrow: {
      fontSize: 40,
      fontWeight: '900',
    },
    distance: {
      fontSize: 40,
      fontWeight: '900',
      marginTop: spacing.lg,
      fontVariant: ['tabular-nums'],
    },
    carSub: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: spacing.xs,
    },
    time: {
      fontSize: 11,
      marginTop: spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
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
  });

export default CarSpotView;