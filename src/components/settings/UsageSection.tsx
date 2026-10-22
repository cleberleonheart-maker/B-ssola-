import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { Translator } from '../../i18n/strings';
import type { LocationMode } from '../../services/locationService';
import type { AppMode } from '../../services/preferencesService';
import {
  Caption,
  GroupCard,
  RadioRow,
  SectionLabel,
  SwitchRow,
} from './primitives';

const LOCATION_MODES = (
  t: Translator,
): { key: LocationMode; label: string; sub: string; icon: string }[] => [
  { key: 'satellite', label: t('set_loc_satellite'), sub: t('set_loc_satellite_sub'), icon: '🛰' },
  { key: 'network', label: t('set_loc_network'), sub: t('set_loc_network_sub'), icon: '📶' },
  { key: 'tower', label: t('set_loc_tower'), sub: t('set_loc_tower_sub'), icon: '📡' },
];

const APP_MODES = (
  t: Translator,
): { key: AppMode; label: string; sub: string; icon: string }[] => [
  { key: 'full', label: t('set_mode_full'), sub: t('set_mode_full_sub'), icon: '🧭' },
  { key: 'minimal', label: t('set_mode_minimal'), sub: t('set_mode_minimal_sub'), icon: '◐' },
  { key: 'adventure', label: t('set_mode_adventure'), sub: t('set_mode_adventure_sub'), icon: '⛰' },
];

type Props = {
  appMode: AppMode;
  onSelectAppMode: (mode: AppMode) => void;
  locationMode: LocationMode;
  onSelectMode: (mode: LocationMode) => void;
  keepAwake: boolean;
  onToggleKeepAwake: () => void;
};

/**
 * Utilização: quanto o app mostra e de onde ele tira a posição.
 *
 * O modo da aplicação e o modo de localização são a mesma escolha vista de dois
 * lados — o que está no ecrã e o que está por baixo — e por isso ficam juntos.
 * A tela sempre acesa é o que permite ler a bússola sem lhe tocar.
 */
const UsageSection = ({
  appMode,
  onSelectAppMode,
  locationMode,
  onSelectMode,
  keepAwake,
  onToggleKeepAwake,
}: Props) => {
  const { t } = useLanguage();
  const locationModes = LOCATION_MODES(t);
  const appModes = APP_MODES(t);

  return (
    <>
      <SectionLabel label={t('set_section_usage')} />

      <Caption label={t('set_section_mode')} />
      <GroupCard>
        {appModes.map((mode, i) => (
          <RadioRow
            key={mode.key}
            divider={i > 0}
            icon={mode.icon}
            label={mode.label}
            sub={mode.sub}
            selected={appMode === mode.key}
            onPress={() => onSelectAppMode(mode.key)}
          />
        ))}
      </GroupCard>

      <Caption label={t('set_section_loc')} />
      <GroupCard>
        {locationModes.map((mode, i) => (
          <RadioRow
            key={mode.key}
            divider={i > 0}
            icon={mode.icon}
            label={mode.label}
            sub={mode.sub}
            selected={locationMode === mode.key}
            onPress={() => onSelectMode(mode.key)}
          />
        ))}
      </GroupCard>

      <Caption label={t('set_caption_screen')} />
      <GroupCard>
        <SwitchRow
          icon="💡"
          label={t('set_keep_awake_title')}
          sub={keepAwake ? t('set_keep_awake_on') : t('set_keep_awake_sub')}
          on={keepAwake}
          onPress={onToggleKeepAwake}
        />
      </GroupCard>
    </>
  );
};

export default UsageSection;
