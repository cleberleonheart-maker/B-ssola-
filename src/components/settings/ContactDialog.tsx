import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { isValidPhone, normalizePhone } from '../../utils/beacon';
import { styles } from './styles';

type Props = {
  value: string;
  onSave: (contact: string) => void;
  onClose: () => void;
};

/**
 * Diálogo do contacto de emergência.
 *
 * O número é normalizado ao guardar (só dígitos, com `+` à frente se o
 * utilizador o escrever), porque o SMS abre com o número tal e qual e um
 * espaço a meio faz o Android recusar o destino.
 */
const ContactDialog = ({ value, onSave, onClose }: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
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
    onSave(normalized);
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
            style={[styles.restoreButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.restoreButtonText}>{t('emerg_contact_save')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default ContactDialog;
