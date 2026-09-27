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
};

const SecuritySection = ({ hasPin, onStartFlow }: Props) => {
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
      </GroupCard>
    </>
  );
};

export default SecuritySection;
