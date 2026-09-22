import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { solarPosition, sunEvents } from '../utils/astro';
import { formatTime } from '../utils/compass';
import type { ColorScheme } from '../theme/themes';

type Props = {
  lat: number;
  lon: number;
};

const GAUGE_SIZE = 190;
const ARC_H = GAUGE_SIZE / 2;
const ARC_BORDER = 9;

const SunWatchView = ({ lat, lon }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const noFix = lat === 0 && lon === 0;

  const data = useMemo(() => {
    if (noFix) {
      return null;
    }
    const position = solarPosition(now, lat, lon);
    const events = sunEvents(now, lat, lon);
    return { position, events };
  }, [now, lat, lon, noFix]);

  const status = useMemo(() => {
    if (!data) {
      return { label: '', color: colors.primary, icon: '' };
    }
    const { position, events } = data;
    if (events.polarDay) {
      return {
        label: t('sun_polar_day'),
        color: colors.primary,
        icon: '☀️',
      };
    }
    if (events.polarNight) {
      return {
        label: t('sun_polar_night'),
        color: colors.textMuted,
        icon: '🌑',
      };
    }
    if (position.elevation >= 0) {
      const rising = events.sunrise && now.getTime() < events.sunrise.getTime() + 45 * 60000;
      const setting =
        events.sunset && now.getTime() > events.sunset.getTime() - 45 * 60000;
      return {
        label: rising ? t('sun_status_rising') : setting ? t('sun_status_setting') : t('sun_status_up'),
        color: colors.primary,
        icon: '☀️',
      };
    }
    return {
      label: t('sun_status_down'),
      color: colors.textMuted,
      icon: '🌙',
    };
  }, [data, now, t, colors]);

  const progress = useMemo(() => {
    if (!data || data.events.polarNight || !data.events.sunrise || !data.events.sunset) {
      return 0;
    }
    const t0 = data.events.sunrise.getTime();
    const t1 = data.events.sunset.getTime();
    if (t1 <= t0) {
      return 0.5;
    }
    const p = (now.getTime() - t0) / (t1 - t0);
    if (p < 0) return 0;
    if (p > 1) return 1;
    return p;
  }, [data, now]);

  const daylightHours = data
    ? `${Math.floor(data.events.daylightMinutes / 60)}h${data.events.daylightMinutes % 60 ? ` ${data.events.daylightMinutes % 60}m` : ''}`
    : '--';

  const elevation = data ? Math.round(data.position.elevation * 10) / 10 : null;
  const azimuth = data ? Math.round(data.position.azimuth * 10) / 10 : null;

  const sunDotLeft = GAUGE_SIZE / 2 - 10 + (progress - 0.5) * (GAUGE_SIZE - 40);
  const sunDotBottom = Math.sin(progress * Math.PI) * (ARC_H - ARC_BORDER - 8);

  return (
    <View style={styles.container}>
      {noFix || !data ? (
        <View style={styles.waiting}>
          <Text style={styles.waitingEmoji}>☀️</Text>
          <Text style={[styles.waitingText, { color: colors.textMuted }]}>
            {t('sun_no_data')}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: status.color + '22', borderColor: status.color + '55' },
              ]}>
              <Text style={styles.statusIcon}>{status.icon}</Text>
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>

          <View style={styles.readoutRow}>
            <View style={styles.readoutItem}>
              <Text style={[styles.readoutLabel, { color: colors.textMuted }]}>
                {t('sun_elevation')}
              </Text>
              <Text style={[styles.readoutValue, { color: colors.text }]}>
                {elevation?.toFixed(1)}
                <Text style={styles.readoutUnit}>°</Text>
              </Text>
            </View>
            <View style={[styles.readoutSep, { backgroundColor: colors.border }]} />
            <View style={styles.readoutItem}>
              <Text style={[styles.readoutLabel, { color: colors.textMuted }]}>
                {t('sun_azimuth')}
              </Text>
              <Text style={[styles.readoutValue, { color: colors.text }]}>
                {azimuth?.toFixed(1)}
                <Text style={styles.readoutUnit}>°</Text>
              </Text>
            </View>
          </View>

          <View style={styles.arcContainer}>
            <View style={[styles.arc, { borderColor: colors.border }]} />
            <View
              style={[
                styles.sunDot,
                {
                  position: 'absolute',
                  left: sunDotLeft,
                  bottom: sunDotBottom,
                  borderColor: status.color,
                },
              ]}>
              <View style={[styles.sunCore, { backgroundColor: status.color }]} />
            </View>
          </View>

          <View style={styles.timesRow}>
            <View style={styles.timeCell}>
              <Text style={[styles.timeLabel, { color: colors.textMuted }]}>
                {t('sun_rise')}
              </Text>
              <Text style={[styles.timeValue, { color: colors.text }]}>
                {data.events.sunrise ? formatTime(data.events.sunrise.getTime()) : '—'}
              </Text>
            </View>
            <View style={styles.timeCell}>
              <Text style={[styles.timeLabel, { color: colors.textMuted }]}>
                {t('sun_noon')}
              </Text>
              <Text style={[styles.timeValue, { color: colors.accent }]}>
                {data.events.solarNoon ? formatTime(data.events.solarNoon.getTime()) : '—'}
              </Text>
            </View>
            <View style={styles.timeCell}>
              <Text style={[styles.timeLabel, { color: colors.textMuted }]}>
                {t('sun_set')}
              </Text>
              <Text style={[styles.timeValue, { color: colors.text }]}>
                {data.events.sunset ? formatTime(data.events.sunset.getTime()) : '—'}
              </Text>
            </View>
          </View>

          <View style={[styles.lightBox, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.lightLabel, { color: colors.textMuted }]}>
              {t('sun_best_light')}
            </Text>
            <Text style={[styles.lightValue, { color: colors.text }]}>
              {data.events.bestLightStart && data.events.bestLightEnd
                ? `${formatTime(data.events.bestLightStart.getTime())} – ${formatTime(data.events.bestLightEnd.getTime())}`
                : '—'}
            </Text>
            <Text style={[styles.lightHint, { color: colors.textMuted }]}>
              {t('sun_daylight', { hours: daylightHours })}
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    waiting: {
      alignItems: 'center',
    },
    waitingEmoji: {
      fontSize: 44,
      marginBottom: spacing.md,
    },
    waitingText: {
      fontSize: 13,
      textAlign: 'center',
    },
    statusRow: {
      marginBottom: spacing.sm,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    statusIcon: {
      fontSize: 15,
      marginRight: spacing.sm,
    },
    statusText: {
      fontSize: 13,
      fontWeight: '800',
    },
    readoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      width: '100%',
      maxWidth: 300,
    },
    readoutItem: {
      flex: 1,
      alignItems: 'center',
    },
    readoutSep: {
      width: 1,
      height: 34,
    },
    readoutLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    readoutValue: {
      fontSize: 26,
      fontWeight: '900',
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    readoutUnit: {
      fontSize: 14,
      fontWeight: '700',
    },
    arcContainer: {
      width: GAUGE_SIZE,
      height: ARC_H + 6,
      overflow: 'hidden',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    arc: {
      position: 'absolute',
      top: 0,
      width: GAUGE_SIZE,
      height: GAUGE_SIZE,
      borderRadius: GAUGE_SIZE / 2,
      borderWidth: ARC_BORDER,
      borderBottomWidth: 0,
    },
    sunDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    sunCore: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    timesRow: {
      flexDirection: 'row',
      marginTop: spacing.md,
      width: '100%',
      maxWidth: 300,
    },
    timeCell: {
      flex: 1,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      marginHorizontal: 2,
      backgroundColor: colors.surface,
    },
    timeLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    timeValue: {
      fontSize: 15,
      fontWeight: '900',
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    lightBox: {
      marginTop: spacing.md,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      alignSelf: 'stretch',
      maxWidth: 300,
    },
    lightLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    lightValue: {
      fontSize: 17,
      fontWeight: '900',
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    lightHint: {
      fontSize: 11,
      marginTop: 2,
    },
  });

export default SunWatchView;