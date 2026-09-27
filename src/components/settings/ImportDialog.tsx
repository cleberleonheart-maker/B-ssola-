import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { styles } from './styles';

type Props = {
  value: string;
  onChange: (text: string) => void;
  onClose: () => void;
  onRestore: () => void;
};

const ImportDialog = ({ value, onChange, onClose, onRestore }: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const canRestore = value.trim().length > 0;

  return (
    <View style={styles.pinOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.importCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.pinTitle, { color: colors.text }]}>
          {t('backup_import_title')}
        </Text>
        <Text style={[styles.pinSub, { color: colors.textMuted }]}>
          {t('backup_import_sub')}
        </Text>
        <TextInput
          multiline
          autoFocus
          value={value}
          onChangeText={onChange}
          style={[styles.importInput, { borderColor: colors.border, color: colors.text }]}
          placeholder={t('backup_import_placeholder')}
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
        <View style={styles.importActions}>
          <Pressable onPress={onClose} style={styles.pinCancel}>
            <Text style={[styles.pinCancelText, { color: colors.textMuted }]}>
              {t('backup_cancel')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert(t('backup_restore_confirm'), t('backup_import_sub'), [
                { text: t('backup_cancel'), style: 'cancel' },
                { text: t('backup_restore'), onPress: onRestore },
              ])
            }
            disabled={!canRestore}
            style={[
              styles.restoreButton,
              { backgroundColor: colors.primary, opacity: canRestore ? 1 : 0.5 },
            ]}>
            <Text style={styles.restoreButtonText}>{t('backup_restore')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default ImportDialog;
