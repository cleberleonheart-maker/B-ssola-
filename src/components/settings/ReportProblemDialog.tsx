import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { reportProblem } from '../../services/crashReporter';
import { sensorSampleCount } from '../../services/sensorLogService';
import { styles } from './styles';

type Props = {
  onClose: () => void;
};

/**
 * Relato de problema (ideia #63).
 *
 * O texto vai para a mesma tabela dos crashes, com o log de sensores ao lado —
 * e sem coordenadas nenhumas, que é a promessa que a linha de privacidade no
 * fundo faz e que o `sensorLogService` cumpre não as guardando.
 */
const ReportProblemDialog = ({ onClose }: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const samples = sensorSampleCount();
  const canSend = text.trim().length > 0 && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    const result = await reportProblem(text);
    setSending(false);
    onClose();
    if (result === 'sent') {
      Alert.alert(t('report_sent_title'), t('report_sent_body'));
    } else if (result === 'offline') {
      Alert.alert(t('report_failed_title'), t('report_offline'));
    } else {
      Alert.alert(t('report_failed_title'), t('report_failed_body'));
    }
  };

  return (
    <View style={styles.pinOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.importCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.pinTitle, { color: colors.text }]}>
          {t('report_title')}
        </Text>
        <Text style={[styles.pinSub, { color: colors.textMuted }]}>
          {samples > 0
            ? t('report_sub_samples', { n: samples })
            : t('report_sub_default')}
        </Text>
        <TextInput
          multiline
          autoFocus
          value={text}
          onChangeText={setText}
          style={[styles.importInput, { borderColor: colors.border, color: colors.text }]}
          placeholder={t('report_placeholder')}
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />
        <Text style={[styles.reportPrivacy, { color: colors.textMuted }]}>
          {t('report_privacy')}
        </Text>
        <View style={styles.importActions}>
          <Pressable onPress={onClose} style={styles.pinCancel}>
            <Text style={[styles.pinCancelText, { color: colors.textMuted }]}>
              {t('backup_cancel')}
            </Text>
          </Pressable>
          <Pressable
            onPress={send}
            disabled={!canSend}
            style={[
              styles.restoreButton,
              { backgroundColor: colors.primary, opacity: canSend ? 1 : 0.5 },
            ]}>
            <Text style={styles.restoreButtonText}>
              {sending ? '…' : t('report_send')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default ReportProblemDialog;
