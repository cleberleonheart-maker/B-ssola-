import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { APP_VERSION } from '../version.generated';
import type { Translator } from '../i18n/strings';

const FEATURES = (
  t: Translator,
): { icon: string; title: string; desc: string }[] => [
  { icon: '🤖', title: t('wn_feature_redesign_title'), desc: t('wn_feature_redesign_desc') },
  { icon: '🎙️', title: t('wn_feature_voice_title'), desc: t('wn_feature_voice_desc') },
  { icon: '🌐', title: t('wn_feature_i18n_title'), desc: t('wn_feature_i18n_desc') },
  { icon: '📍', title: t('wn_feature_waypoints_title'), desc: t('wn_feature_waypoints_desc') },
  { icon: '🌡️', title: t('wn_feature_baro_title'), desc: t('wn_feature_baro_desc') },
  { icon: '◉', title: t('wn_feature_level_title'), desc: t('wn_feature_level_desc') },
  { icon: '✨', title: t('wn_feature_ar_title'), desc: t('wn_feature_ar_desc') },
  { icon: '🧲', title: t('wn_feature_cal_title'), desc: t('wn_feature_cal_desc') },
  { icon: '🚶', title: t('wn_feature_odo_title'), desc: t('wn_feature_odo_desc') },
  { icon: '☀️', title: t('wn_feature_sun_title'), desc: t('wn_feature_sun_desc') },
  { icon: '🔊', title: t('wn_feature_sound_title'), desc: t('wn_feature_sound_desc') },
  { icon: '📈', title: t('wn_feature_charts_title'), desc: t('wn_feature_charts_desc') },
  { icon: '🌌', title: t('wn_feature_neon_title'), desc: t('wn_feature_neon_desc') },
  { icon: '🍃', title: t('wn_feature_wind_title'), desc: t('wn_feature_wind_desc') },
  { icon: '📌', title: t('wn_feature_vmark_title'), desc: t('wn_feature_vmark_desc') },
  { icon: '🗺️', title: t('wn_feature_track_title'), desc: t('wn_feature_track_desc') },
  { icon: '📓', title: t('wn_feature_notes_title'), desc: t('wn_feature_notes_desc') },
  { icon: '🌙', title: t('wn_feature_night_title'), desc: t('wn_feature_night_desc') },
  { icon: '🧲', title: t('wn_feature_metalcal_title'), desc: t('wn_feature_metalcal_desc') },
  { icon: '🔔', title: t('wn_feature_geofence_title'), desc: t('wn_feature_geofence_desc') },
  { icon: '🗺️', title: t('wn_feature_gpx_title'), desc: t('wn_feature_gpx_desc') },
  { icon: '↩️', title: t('wn_feature_back_title'), desc: t('wn_feature_back_desc') },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

const WhatsNewModal = ({ visible, onClose }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const features = FEATURES(t);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.background }]}
          onPress={() => {}}>
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>✨</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('wn_title', { version: APP_VERSION })}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('wn_subtitle')}
          </Text>

          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}>
            {features.map((feature, i) => (
              <View
                key={i}
                style={[
                  styles.row,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}>
                <View
                  style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>{feature.icon}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>
                    {feature.title}
                  </Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    {feature.desc}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonText, { color: colors.background }]}>
              {t('wn_close')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
  badge: {
    alignSelf: 'center',
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
    marginBottom: spacing.sm,
  },
  list: {
    marginTop: spacing.sm,
    maxHeight: 340,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconChipText: {
    fontSize: 18,
  },
  rowText: {
    flex: 1,
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

export default WhatsNewModal;