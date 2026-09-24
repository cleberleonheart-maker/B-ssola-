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
import { APP_VERSION, APP_VERSION_CODE } from '../version.generated';
import type { Translator } from '../i18n/strings';

type Entry = { icon: string; title: string; desc: string };

const CHANGELOG: Record<number, (t: Translator) => Entry[]> = {
  147: t => [
    { icon: '📡', title: t('wn_emf_title'), desc: t('wn_emf_desc') },
  ],
  146: t => [
    { icon: '📐', title: t('wn_tri_title'), desc: t('wn_tri_desc') },
  ],
  145: t => [
    { icon: '☀️', title: t('wn_sun_title'), desc: t('wn_sun_desc') },
  ],
  144: t => [
    { icon: '⚡', title: t('wn_short_title'), desc: t('wn_short_desc') },
  ],
  143: t => [
    { icon: '↩️', title: t('wn_return_title'), desc: t('wn_return_desc') },
  ],
  142: t => [
    { icon: '🧭', title: t('wn_steady_title'), desc: t('wn_steady_desc') },
    { icon: '📷', title: t('wn_campro_title'), desc: t('wn_campro_desc') },
    { icon: '🗺️', title: t('wn_gpx_title'), desc: t('wn_gpx_desc') },
  ],
  141: t => [
    { icon: '⌖', title: t('wn_height_title'), desc: t('wn_height_desc') },
    { icon: '🚗', title: t('wn_car_title'), desc: t('wn_car_desc') },
  ],
  140: t => [
    { icon: '🧭', title: t('wn_arflat_title'), desc: t('wn_arflat_desc') },
    { icon: '🔋', title: t('wn_bat_title'), desc: t('wn_bat_desc') },
    { icon: '🎥', title: t('wn_fov_title'), desc: t('wn_fov_desc') },
  ],
  139: t => [
    { icon: '📷', title: t('wn_cam2_title'), desc: t('wn_cam2_desc') },
  ],
  138: t => [
    { icon: '📷', title: t('wn_cam2_title'), desc: t('wn_cam2_desc') },
  ],
  137: t => [
    { icon: '📷', title: t('wn_cam2_title'), desc: t('wn_cam2_desc') },
  ],
  136: t => [
    { icon: '📷', title: t('wn_cam2_title'), desc: t('wn_cam2_desc') },
  ],
  135: t => [
    { icon: '📷', title: t('wn_cam_title'), desc: t('wn_cam_desc') },
    { icon: '↩️', title: t('wn_back_title'), desc: t('wn_back_desc') },
    { icon: '🚨', title: t('wn_inmet_title'), desc: t('wn_inmet_desc') },
    { icon: '🔔', title: t('wn_notify_title'), desc: t('wn_notify_desc') },
  ],
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

const WhatsNewModal = ({ visible, onClose }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const build = CHANGELOG[APP_VERSION_CODE];
  const features = build ? build(t) : [];

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

          {features.length > 0 && (
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
          )}

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