import React from 'react';
import { Alert } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { BEACON_INTERVAL_OPTIONS } from '../../utils/beacon';
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
