import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { formatDistance } from '../utils/geo';
import { getTotals, type DayTotal } from '../services/odometerService';
import { loadTracks, type RecordedTrack } from '../services/trackService';

const OdometerView = () => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(), []);

  const [history, setHistory] = useState<{
    today: number;
    week: number;
    lastDays: DayTotal[];
  } | null>(null);
  const [tracks, setTracks] = useState<RecordedTrack[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      getTotals()
        .then(value => {
          if (alive) setHistory(value);
        })
        .catch(() => {});
      loadTracks()
        .then(list => {
          if (alive) setTracks(list);
        })
        .catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const longest = useMemo(() => {
    if (tracks.length === 0) return null;
    return tracks.reduce<RecordedTrack>(
      (best, track) => (track.distance > best.distance ? track : best),
      tracks[0],
    );
  }, [tracks]);

  const totalDistance = useMemo(
    () => tracks.reduce((acc, track) => acc + track.distance, 0),
    [tracks],
  );

  const rowDivider: StyleProp<ViewStyle> = {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: colors.text }]}>{t('ui_odo_title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {t('ui_odo_subtitle')}
      </Text>

      <View style={styles.summaryRow}>
        <View style={[styles.card, { borderColor: colors.border }]}>
          <Text style={[styles.cardValue, { color: colors.primary }]}>
            {formatDistance(history?.today ?? 0)}
          </Text>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            {t('ui_odo_today')}
          </Text>
        </View>
        <View style={[styles.card, { borderColor: colors.border }]}>
          <Text style={[styles.cardValue, { color: colors.accent }]}>
            {formatDistance(history?.week ?? 0)}
          </Text>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            {t('ui_odo_week')}
          </Text>
        </View>
      </View>

      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('ui_odo_days')}
      </Text>
      <View style={[styles.listCard, { backgroundColor: colors.surface }]}>
        {(history?.lastDays ?? []).map((entry, i) => (
          <View
            key={entry.day}
            style={[styles.dayRow, i > 0 ? rowDivider : null]}>
            <Text style={[styles.dayLabel, { color: colors.text }]}>
              {entry.day}
            </Text>
            <Text
              style={[
                styles.dayValue,
                {
                  color:
                    entry.meters > 0 ? colors.text : colors.textMuted,
                },
              ]}>
              {entry.meters > 0 ? formatDistance(entry.meters) : '—'}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.section, { color: colors.textMuted }]}>
        {t('ui_odo_tracks')}
      </Text>
      <View style={[styles.listCard, { backgroundColor: colors.surface }]}>
        <View style={styles.dayRow}>
          <Text style={[styles.dayLabel, { color: colors.text }]}>
            {t('ui_odo_total')}
          </Text>
          <Text style={[styles.dayValue, { color: colors.text }]}>
            {tracks.length > 0
              ? `${tracks.length} · ${formatDistance(totalDistance)}`
              : '—'}
          </Text>
        </View>
        <View style={[styles.dayRow, rowDivider]}>
          <Text style={[styles.dayLabel, { color: colors.text }]}>
            {t('ui_odo_longest')}
          </Text>
          <Text
            style={[styles.dayValue, { color: colors.text }]}
            numberOfLines={1}>
            {longest
              ? `${longest.name} · ${formatDistance(longest.distance)}`
              : '—'}
          </Text>
        </View>
      </View>

      {(!history || history.today <= 0) && tracks.length === 0 && (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {t('ui_odo_empty')}
        </Text>
      )}
    </ScrollView>
  );
};

const createStyles = () => StyleSheet.create({
    container: {
      flex: 1,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
    },
    subtitle: {
      fontSize: 13,
      marginTop: 2,
      marginBottom: spacing.md,
    },
    summaryRow: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    card: {
      flex: 1,
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginRight: spacing.md,
    },
    cardValue: {
      fontSize: 24,
      fontWeight: '800',
    },
    cardLabel: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    section: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
      paddingLeft: spacing.xs,
    },
    listCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: '#00000018',
      marginBottom: spacing.md,
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    dayLabel: {
      fontSize: 15,
      fontWeight: '600',
    },
    dayValue: {
      fontSize: 15,
      fontWeight: '800',
      maxWidth: '65%',
    },
    empty: {
      fontSize: 13,
      textAlign: 'center',
      marginTop: spacing.md,
      lineHeight: 18,
    },
  });

export default OdometerView;