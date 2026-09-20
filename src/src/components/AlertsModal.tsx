import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { formatTime } from '../utils/compass';
import {
  fetchCivilAlerts,
  type CivilAlerts,
  type WeatherAlert,
} from '../services/alertsService';

type Props = {
  visible: boolean;
  latitude: number;
  longitude: number;
  onClose: () => void;
};

const AlertsModal = ({ visible, latitude, longitude, onClose }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<CivilAlerts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    if (latitude === 0 && longitude === 0) {
      setAlerts({ weather: [], quakes: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const result = await fetchCivilAlerts(latitude, longitude);
      setAlerts(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setAlerts(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, latitude, longitude]);

  const hasAlerts = alerts
    ? alerts.weather.length > 0 || alerts.quakes.length > 0
    : false;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={() => {}}>
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: colors.warning }]}>
              <Text style={styles.badgeText}>🚨</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('al_title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('al_subtitle')}
            </Text>
          </View>

          {loading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.centerText, { color: colors.textMuted }]}>
                {t('al_loading')}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centerWrap}>
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {t('al_error')}
              </Text>
              <Pressable
                onPress={load}
                style={[
                  styles.retryButton,
                  { backgroundColor: colors.primary },
                ]}>
                <Text style={[styles.retryText, { color: colors.background }]}>
                  {t('al_retry')}
                </Text>
              </Pressable>
            </View>
          ) : alerts && !hasAlerts ? (
            <View style={styles.centerWrap}>
              <Text style={styles.okEmoji}>✅</Text>
              <Text style={[styles.centerText, { color: colors.textMuted }]}>
                {t('al_none')}
              </Text>
            </View>
          ) : alerts ? (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {alerts.weather.length > 0 && (
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  {t('al_section_weather')}
                </Text>
              )}
              {alerts.weather.map((alert, i) => (
                <WeatherRow key={`w${i}`} alert={alert} />
              ))}

              {alerts.quakes.length > 0 && (
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  {t('al_section_quakes')}
                </Text>
              )}
              {alerts.quakes.map(quake => (
                <View
                  key={quake.time}
                  style={[styles.row, { backgroundColor: colors.surfaceAlt }]}>
                  <View
                    style={[
                      styles.severityBar,
                      {
                        backgroundColor:
                          quake.mag >= 6
                            ? colors.danger
                            : quake.mag >= 5
                            ? colors.accent
                            : colors.warning,
                      },
                    ]}
                  />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {t('al_mag', { mag: quake.mag.toFixed(1) })}
                      {quake.distanceKm !== null
                        ? ` · ${Math.round(quake.distanceKm)} km`
                        : ''}
                    </Text>
                    <Text
                      style={[styles.rowDesc, { color: colors.textMuted }]}
                      numberOfLines={2}>
                      {quake.place}
                    </Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                      {formatTime(quake.time)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <Pressable
            onPress={onClose}
            style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonText, { color: colors.background }]}>
              {t('al_close')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const WeatherRow = ({ alert }: { alert: WeatherAlert }) => {
  const colors = useThemeColors();
  const { t } = useLanguage();

  const severityColor =
    alert.severity === 'red'
      ? colors.danger
      : alert.severity === 'orange'
      ? colors.warning
      : alert.severity === 'yellow'
      ? colors.accent
      : colors.success;

  return (
    <View style={[styles.row, { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.severityBar, { backgroundColor: severityColor }]} />
      <View style={styles.rowText}>
        <Text style={[styles.severityTag, { color: severityColor }]}>
          {alert.severity.toUpperCase()}
          {alert.awareness_type ? ` · ${alert.awareness_type}` : ''}
        </Text>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {alert.event}
        </Text>
        {alert.description ? (
          <Text
            style={[styles.rowDesc, { color: colors.textMuted }]}
            numberOfLines={4}>
            {alert.description}
          </Text>
        ) : null}
        {alert.expires ? (
          <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
            {t('al_until', { time: formatTime(alert.expires) })}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badgeText: {
    fontSize: 26,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  centerWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  centerText: {
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  okEmoji: {
    fontSize: 34,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.md,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  list: {
    maxHeight: 380,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  severityBar: {
    width: 5,
    borderRadius: 3,
    marginRight: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  severityTag: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  rowMeta: {
    fontSize: 11,
    marginTop: 4,
  },
  button: {
    marginTop: spacing.md,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
  },
});

export default AlertsModal;