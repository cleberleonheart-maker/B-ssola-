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
import { changelogBetween } from '../services/changelog';

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * Build em que as novidades foram vistas pela última vez. `null` (primeira
   * abertura, ou o botão "novidades" das Configurações) mostra só a versão
   * atual; com um código anterior, acumula as entradas do intervalo.
   */
  lastSeen?: number | null;
};

const WhatsNewModal = ({ visible, onClose, lastSeen = null }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const builds = changelogBetween(lastSeen, APP_VERSION_CODE, t);
  // Uma versão só não ganha cabeçalho: o título já diz de qual versão se trata
  // e o número do build ali seria ruído.
  const since = builds.length > 1 ? lastSeen : null;

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
            {since != null
              ? t('wn_title_since', { code: since })
              : t('wn_title', { version: APP_VERSION })}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {since != null ? t('wn_subtitle_since') : t('wn_subtitle')}
          </Text>

          {builds.length > 0 && (
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}>
              {builds.map((build, buildIndex) => (
                <View key={build.code}>
                  {since != null && (
                    <>
                      {buildIndex > 0 && (
                        <View
                          style={[
                            styles.groupDivider,
                            { backgroundColor: colors.border },
                          ]}
                        />
                      )}
                      <Text
                        style={[styles.buildLabel, { color: colors.textMuted }]}>
                        {t('wn_build_label', { code: build.code })}
                      </Text>
                    </>
                  )}
                  {build.entries.map((feature, i) => (
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
                        style={[
                          styles.iconChip,
                          { backgroundColor: colors.surfaceAlt },
                        ]}>
                        <Text style={styles.iconChipText}>{feature.icon}</Text>
                      </View>
                      <View style={styles.rowText}>
                        <Text style={[styles.rowTitle, { color: colors.text }]}>
                          {feature.title}
                        </Text>
                        <Text
                          style={[styles.rowDesc, { color: colors.textMuted }]}>
                          {feature.desc}
                        </Text>
                      </View>
                    </View>
                  ))}
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
  buildLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
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