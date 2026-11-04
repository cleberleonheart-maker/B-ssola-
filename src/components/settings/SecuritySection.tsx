import React from 'react';
import { View } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  ChevronRow,
  GroupCard,
  GroupRow,
  IconChip,
  RowBody,
  SectionLabel,
  Switch,
  SwitchRow,
} from './primitives';
import { styles } from './styles';

export type PinFlowKind =
  | { kind: 'new'; step: 'enter' | 'confirm'; first: string }
  | { kind: 'change'; step: 'current' }
  | { kind: 'change'; step: 'enter' | 'confirm'; first: string }
  | { kind: 'remove'; step: 'current' };

type Props = {
  hasPin: boolean;
  onStartFlow: (flow: PinFlowKind) => void;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  onToggleBiometric: (enabled: boolean) => void;
};

const SecuritySection = ({
  hasPin,
  onStartFlow,
  biometricAvailable,
  biometricEnabled,
  onToggleBiometric,
}: Props) => {
  const { t } = useLanguage();

  return (
    <>
      <SectionLabel label={t('set_section_security')} />
      <GroupCard>
        <GroupRow col>
          <View style={styles.calRow}>
            <IconChip icon="🔐" />
            <RowBody label={t('lock_title')} sub={t('lock_sub')} lines={2} />
            <Switch
              on={hasPin}
              onPress={() =>
                onStartFlow(
                  hasPin
                    ? { kind: 'remove', step: 'current' }
                    : { kind: 'new', step: 'enter', first: '' },
                )
              }
            />
          </View>
        </GroupRow>

        {hasPin && (
          <ChevronRow
            divider
            icon="🔑"
            label={t('lock_change_pin')}
            sub={t('lock_pin_confirm')}
            onPress={() => onStartFlow({ kind: 'change', step: 'current' })}
          />
        )}

        {hasPin && (
          <SwitchRow
            divider
            icon="👆"
            label={t('lock_bio_title')}
            sub={
              biometricAvailable
                ? biometricEnabled
                  ? t('lock_bio_on')
                  : t('lock_bio_off')
                : t('lock_bio_unavailable')
            }
            on={biometricAvailable && biometricEnabled}
            disabled={!biometricAvailable}
            onPress={() => onToggleBiometric(!biometricEnabled)}
          />
        )}
      </GroupCard>
    </>
  );
};

export default SecuritySection;
