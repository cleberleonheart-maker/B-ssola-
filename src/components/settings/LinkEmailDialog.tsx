import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { styles } from './styles';

type Props = {
  value: string;
  onChange: (text: string) => void;
  password: string;
  onChangePassword: (text: string) => void;
  sending: boolean;
  error: string | null;
  onClose: () => void;
  onSend: () => void;
};

/**
 * O pedido de email/senha da ideia #102.
 *
 * É o mesmo formato do ImportDialog (cartão centrado sobre o ecrã): aqui o
 * utilizador não cola um bloco, escreve um email e, se quiser, uma senha. A
 * opcional — vazia, entra-se só pelo link do email; preenchida, grava também
 * credenciais para `signInWithPassword`. O estado de erro fica dentro do
 * cartão em vez de num Alert porque quem erra o email — endereço inválido,
 * Supabase recusado — precisa de ver o que há de errado antes de tentar outra
 * vez, e não de fechar um aviso.
 */
const LinkEmailDialog = ({
  value,
  onChange,
  password,
  onChangePassword,
  sending,
  error,
  onClose,
  onSend,
}: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View style={styles.pinOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.importCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.pinTitle, { color: colors.text }]}>
          {t('account_link_title')}
        </Text>
        <Text style={[styles.pinSub, { color: colors.textMuted }]}>
          {t('account_link_dialog_sub')}
        </Text>
        <TextInput
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!sending}
          value={value}
          onChangeText={onChange}
          style={[styles.linkInput, { borderColor: colors.border, color: colors.text }]}
          placeholder={t('account_link_placeholder')}
          placeholderTextColor={colors.textMuted}
        />
        <Text style={[styles.linkFieldLabel, { color: colors.text }]}>
          {t('account_link_password_title')}
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          editable={!sending}
          value={password}
          onChangeText={onChangePassword}
          style={[
            styles.linkInput,
            { marginTop: 0, borderColor: colors.border, color: colors.text },
          ]}
          placeholder={t('account_link_password_placeholder')}
          placeholderTextColor={colors.textMuted}
        />
        <Text style={[styles.groupSub, { color: colors.textMuted }]}>
          {t('account_link_password_sub')}
        </Text>
        {error ? (
          <Text style={[styles.pinErrorText, { color: colors.danger }]}>{error}</Text>
        ) : null}
        <View style={styles.importActions}>
          <Pressable onPress={onClose} style={styles.pinCancel} disabled={sending}>
            <Text style={[styles.pinCancelText, { color: colors.textMuted }]}>
              {t('account_link_cancel')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            style={[
              styles.restoreButton,
              { backgroundColor: colors.primary, opacity: canSend ? 1 : 0.5 },
            ]}>
            <Text style={styles.restoreButtonText}>
              {sending ? t('account_link_sending') : t('account_link_send')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default LinkEmailDialog;