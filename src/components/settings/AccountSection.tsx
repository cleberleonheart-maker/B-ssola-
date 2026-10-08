import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import {
  deleteMyAccount,
  takeCloudError,
} from '../../services/cloud';
import {
  Chevron,
  GroupCard,
  GroupRow,
  IconChip,
  RowBody,
  SectionLabel,
} from './primitives';

/**
 * Apagar a minha conta e os dados (ideia #101).
 *
 * Não havia sítio nenhum na app para largar dados: cada aparelho novo e cada
 * execução do verificador criam uma conta anónima que fica para sempre, e a
 * única forma de a tirar era o Table Editor. Esta secção é esse sítio — com a
 * confirmação a dizer o que se perde, porque "apaga tudo" sem dizer o quê é
 * como apagar sem dizer a que custo.
 *
 * A demora até ao fim é propositada: apagar é o único acto sem reversão desta
 * lista, e o próprio `Alert` de confirmação já é a pausa que separa o toque
 * certo do toque que se arrepende.
 */
const AccountSection = () => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const [apagando, setApagando] = useState(false);

  const apagar = async () => {
    setApagando(true);
    const ok = await deleteMyAccount();
    setApagando(false);
    if (ok) {
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

  return (
    <>
      <SectionLabel label={t('set_section_account')} />
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
    </>
  );
};

export default AccountSection;