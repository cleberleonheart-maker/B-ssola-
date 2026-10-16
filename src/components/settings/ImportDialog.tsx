import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { BACKUP_FILE_VERSION } from '../../services/backupService';
import {
  inspectBackup,
  type BackupMode,
  type BackupSummary,
} from '../../services/backupService';
import { styles } from './styles';

type Props = {
  value: string;
  onChange: (text: string) => void;
  onClose: () => void;
  onRestore: (mode: BackupMode) => void;
};

/**
 * A importação tem dois passos (ideia #70). O primeiro é colar o JSON; o
 * segundo mostra o que vem lá dentro — quantos pontos, trilhas e anotações —
 * e pergunta se é para **substituir** o que cá está ou **juntar** sem apagar
 * nada. Antes, o botão Restaurar aplicava logo por cima, e um arquivo trocado
 * apagava dados bons sem dar por isso.
 */
const ImportDialog = ({ value, onChange, onClose, onRestore }: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const canRestore = value.trim().length > 0;

  const handleInspect = () => {
    const result = inspectBackup(value);
    if (!result.ok) {
      Alert.alert(
        t('backup_import_title'),
        result.error === 'unsupported_version'
          ? t('backup_unsupported_version', { version: BACKUP_FILE_VERSION })
          : t('backup_invalid'),
      );
      return;
    }
    setSummary(result.summary);
  };

  const confirm = (mode: BackupMode) => {
    const label = mode === 'merge' ? t('backup_merge') : t('backup_replace');
    Alert.alert(label, mode === 'merge' ? t('backup_merge_confirm') : t('backup_restore_confirm'), [
      { text: t('backup_cancel'), style: 'cancel' },
      { text: label, onPress: () => onRestore(mode) },
    ]);
  };

  return (
    <View style={styles.pinOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.importCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.pinTitle, { color: colors.text }]}>
          {t('backup_import_title')}
        </Text>
        {summary == null ? (
          <>
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
                onPress={handleInspect}
                disabled={!canRestore}
                style={[
                  styles.restoreButton,
                  { backgroundColor: colors.primary, opacity: canRestore ? 1 : 0.5 },
                ]}>
                <Text style={styles.restoreButtonText}>{t('backup_restore')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.pinSub, { color: colors.textMuted }]}>
              {t('backup_preview_title')}
            </Text>
            <View style={[styles.previewBox, { borderColor: colors.border }]}>
              <PreviewRow
                icon="📍"
                label={t('backup_preview_waypoints', { n: summary.waypoints })}
                color={colors.text}
              />
              <PreviewRow
                icon="🥾"
                label={t('backup_preview_tracks', { n: summary.tracks })}
                color={colors.text}
              />
              <PreviewRow
                icon="📝"
                label={t('backup_preview_notes', { n: summary.notes })}
                color={colors.text}
              />
            </View>
            <Text style={[styles.previewHint, { color: colors.textMuted }]}>
              {t('backup_preview_settings')}
            </Text>
            <Text style={[styles.previewHint, { color: colors.textMuted }]}>
              {t('backup_notes_hint')}
            </Text>
            <View style={styles.importActions}>
              <Pressable onPress={() => confirm('merge')} style={[styles.mergeButton, { borderColor: colors.border }]}>
                <Text style={[styles.mergeButtonText, { color: colors.text }]}>
                  {t('backup_merge')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => confirm('replace')}
                style={[styles.restoreButton, { backgroundColor: colors.primary }]}>
                <Text style={styles.restoreButtonText}>{t('backup_replace')}</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setSummary(null)} style={styles.backButton}>
              <Text style={[styles.backButtonText, { color: colors.textMuted }]}>
                ‹ {t('backup_back')}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
};

const PreviewRow = ({
  icon,
  label,
  color,
}: {
  icon: string;
  label: string;
  color: string;
}) => (
  <View style={styles.previewRow}>
    <Text style={styles.previewIcon}>{icon}</Text>
    <Text style={[styles.previewLabel, { color }]}>{label}</Text>
  </View>
);

export default ImportDialog;
