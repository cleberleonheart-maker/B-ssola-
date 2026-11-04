import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { isValidPhone, normalizePhone } from '../../utils/beacon';
import { toInternationalPhone } from '../../services/phoneNumberService';
import { styles } from './styles';

type Props = {
  value: string;
  onSave: (contact: string) => void;
  onClose: () => void;
};

/**
 * Diálogo do contacto de emergência.
 *
 * O número é guardado no formato internacional ("+5521999990000"): o
 * WhatsApp só encontra um contacto pelo número completo e diz "este número
 * não está no WhatsApp" quando o formato é local — mesmo estando. O Android
 * sabe passar o número local ao formato internacional quando lhe dizem de que
 * país é, por isso o país do telemóvel é usado aqui.
 */
const ContactDialog = ({ value, onSave, onClose }: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const normalized = normalizePhone(text);
    if (normalized.length === 0) {
      onSave('');
      onClose();
      return;
    }
    if (!isValidPhone(normalized)) {
      setError(t('emerg_contact_invalid'));
      return;
    }
    setSaving(true);
    // O país do telemóvel entra aqui: é o que falta para o número local
    // fazer sentido para o WhatsApp e para o SMS.
    const international = await toInternationalPhone(text);
    setSaving(false);
    onSave(international || normalized);
    onClose();
  };

  return (
    <View style={styles.pinOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.pinCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.pinTitle, { color: colors.text }]}>
          {t('emerg_contact')}
        </Text>
        <Text style={[styles.pinSub, { color: colors.textMuted }]}>
          {t('emerg_contact_hint')}
        </Text>
        <TextInput
          autoFocus
          keyboardType="phone-pad"
          value={text}
          onChangeText={next => {
            setText(next);
            setError(null);
          }}
          style={[styles.contactInput, { borderColor: colors.border, color: colors.text }]}
          placeholder="+55 21 99999-0000"
          placeholderTextColor={colors.textMuted}
        />
        {error ? (
          <Text style={[styles.pinErrorText, { color: colors.danger }]}>{error}</Text>
        ) : (
          <View style={styles.pinErrorSpacer} />
        )}
        <View style={styles.importActions}>
          <Pressable onPress={onClose} style={styles.pinCancel}>
            <Text style={[styles.pinCancelText, { color: colors.textMuted }]}>
              {t('backup_cancel')}
            </Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={saving}
            style={[styles.restoreButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.restoreButtonText}>{t('emerg_contact_save')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default ContactDialog;
