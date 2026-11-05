import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { BEACON_INTERVAL_OPTIONS } from '../../utils/beacon';
import {
  canSendSmsSilently,
  requestSmsPermission,
  sosSenderSupported,
} from '../../services/sosSender';
import { ChevronRow, GroupCard, SwitchRow } from './primitives';

type Props = {
  beaconEnabled: boolean;
  onToggleBeacon: (enabled: boolean) => void;
  contact: string;
  onEditContact: () => void;
  intervalMinutes: number;
  onChangeInterval: (minutes: number) => void;
  fallEnabled: boolean;
  onToggleFall: (enabled: boolean) => void;
};

/**
 * Secção de SOS: o beacon de emergência e a detecção de queda.
 *
 * O beacon é o aviso periódico por SMS para um contacto guardado (ideia #6) e
 * a detecção de queda é o acelerómetro a chamar o SOS quando o telemóvel
 * leva um embate e fica parado (ideia #7). As duas coisas são o mesmo
 * assunto: o que a app faz quando o telemóvel não pode ser mexido.
 */
const SosSection = ({
  beaconEnabled,
  onToggleBeacon,
  contact,
  onEditContact,
  intervalMinutes,
  onChangeInterval,
  fallEnabled,
  onToggleFall,
}: Props) => {
  const { t } = useLanguage();

  /**
   * Permissão de enviar SMS (ideia #107).
   *
   * Pede-se aqui, com calma, e não a meio de uma agressão: no modo de
   * assalto o aviso tem de sair sem abrir a app de SMS, e um pedido de
   * permissão na cara de quem está a ser assaltado é pior do que o aviso
   * demorar um segundo.
   */
  const [smsOk, setSmsOk] = useState(false);

  useEffect(() => {
    if (!sosSenderSupported) return;
    let alive = true;
    canSendSmsSilently().then(ok => {
      if (alive) setSmsOk(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const askSmsPermission = async () => {
    if (smsOk) return;
    const ok = await requestSmsPermission();
    setSmsOk(ok);
    if (!ok) {
      Alert.alert(t('emerg_sms_permission'), t('emerg_sms_permission_denied'));
    }
  };

  const pickInterval = () => {
    Alert.alert(
      t('emerg_beacon_interval'),
      t('emerg_beacon_interval_hint'),
      BEACON_INTERVAL_OPTIONS.map(minutes => ({
        text: `${minutes} min`,
        onPress: () => onChangeInterval(minutes),
      })),
    );
  };

  return (
    <GroupCard>
      <SwitchRow
        icon="🆘"
        label={t('emerg_beacon')}
        sub={t('emerg_beacon_hint')}
        on={beaconEnabled}
        onPress={() => onToggleBeacon(!beaconEnabled)}
      />
      <ChevronRow
        divider
        icon="📱"
        label={t('emerg_contact')}
        sub={contact || t('emerg_contact_empty')}
        onPress={onEditContact}
      />
      <ChevronRow
        divider
        icon="⏱️"
        label={t('emerg_beacon_interval')}
        sub={`${intervalMinutes} min`}
        onPress={pickInterval}
      />
      {sosSenderSupported && (
        <ChevronRow
          divider
          icon="📨"
          label={t('emerg_sms_permission')}
          sub={smsOk ? t('emerg_sms_permission_ok') : t('emerg_sms_permission_hint')}
          chevronText={smsOk ? t('emerg_sms_permission_ok_short') : undefined}
          onPress={askSmsPermission}
        />
      )}
      <SwitchRow
        divider
        icon="🧍"
        label={t('fall_detect')}
        sub={t('fall_detect_hint')}
        on={fallEnabled}
        onPress={() => onToggleFall(!fallEnabled)}
      />
    </GroupCard>
  );
};

export default SosSection;
