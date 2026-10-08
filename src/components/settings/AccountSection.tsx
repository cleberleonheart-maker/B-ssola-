import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import {
  currentAccountStatus,
  deleteMyAccount,
  linkEmail,
  takeCloudError,
  type AccountStatus,
} from '../../services/cloud';
import {
  Chevron,
  ChevronRow,
  GroupCard,
  GroupRow,
  IconChip,
  RowBody,
  SectionLabel,
} from './primitives';
import LinkEmailDialog from './LinkEmailDialog';

/**
 * A identidade da conta (#102) e o apagar de dados (#101).
 *
 * As duas são o mesmo assunto: quem é esta conta. Uma linha diz o que ela é
 * agora — anónima, ou ligada a um email já confirmado — e a dela em baixo liga-a
 * a um email sem trocar de utilizador, para que perder o aparelho deixe de
 * perder a nuvem. A última é a saída: apagar a conta e os dados, com a
 * confirmação a dizer o que se perde, porque "apaga tudo" sem dizer o quê é
 * como apagar sem dizer a que custo.
 */
const AccountSection = () => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [apagando, setApagando] = useState(false);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const carregarStatus = () => {
    currentAccountStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  };

  useEffect(() => {
    carregarStatus();
  }, []);

  const apagar = async () => {
    setApagando(true);
    const ok = await deleteMyAccount();
    setApagando(false);
    if (ok) {
      setStatus(null);
      Alert.alert(t('account_delete_done_title'), t('account_delete_done_desc'));
      return;
    }
    Alert.alert(t('account_delete_error'), takeCloudError() ?? '');
  };

  const confirmar = () => {
    if (apagando) return;
    Alert.alert(t('account_delete_confirm_title'), t('account_delete_confirm_desc'), [
      { text: t('account_delete_cancel'), style: 'cancel' },
      {
        text: t('account_delete_do'),
        style: 'destructive',
        onPress: () => {
          void apagar();
        },
      },
    ]);
  };

  const enviarLink = async () => {
    setLinkError(null);
    setEnviando(true);
    const ok = await linkEmail(email, senha || undefined);
    setEnviando(false);
    if (ok) {
      setLinkOpen(false);
      setEmail('');
      setSenha('');
      carregarStatus();
      Alert.alert(t('account_link_done_title'), t('account_link_done_desc'));
      return;
    }
    setLinkError(takeCloudError() ?? t('account_link_error'));
  };

  const statusSub = status?.email
    ? status.confirmed
      ? t('account_email_confirmed')
      : t('account_email_pending')
    : t('account_anonymous_sub');

  return (
    <>
      <SectionLabel label={t('set_section_account')} />
      <GroupCard>
        <GroupRow>
          <IconChip icon="🆔" />
          <RowBody
            label={
              status?.email ? t('account_linked', { email: status.email }) : t('account_anonymous')
            }
            sub={statusSub}
            subColor={colors.textMuted}
            lines={3}
          />
        </GroupRow>
        <ChevronRow
          icon="📧"
          label={t('account_link')}
          sub={t('account_link_sub')}
          onPress={() => setLinkOpen(true)}
          divider
          lines={3}
        />
      </GroupCard>
      <GroupCard>
        <GroupRow onPress={confirmar} disabled={apagando}>
          <IconChip icon={apagando ? '⏳' : '🗑️'} />
          <RowBody
            label={t('account_delete')}
            sub={apagando ? t('account_delete_working') : t('account_delete_sub')}
            subColor={colors.danger}
            lines={3}
          />
          <Chevron text={apagando ? '…' : '›'} />
        </GroupRow>
      </GroupCard>
      {linkOpen ? (
        <LinkEmailDialog
          value={email}
          onChange={setEmail}
          password={senha}
          onChangePassword={setSenha}
          sending={enviando}
          error={linkError}
          onClose={() => setLinkOpen(false)}
          onSend={() => void enviarLink()}
        />
      ) : null}
    </>
  );
};

export default AccountSection;