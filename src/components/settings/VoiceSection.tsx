import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  GroupCard,
  SectionLabel,
  SwitchRow,
} from './primitives';

type Props = {
  voiceGuide: boolean;
  onToggleVoiceGuide: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  soundAvailable: boolean;
};

/**
 * Voz e som: o que o app diz e o que se ouve.
 *
 * A Kefera a anunciar o rumo e os bipes dos sensores são a mesma coisa vista
 * por dois lados — por isso vivem juntos, e não um com a bússola e o outro com
 * o resto.
 */
const VoiceSection = ({
  voiceGuide,
  onToggleVoiceGuide,
  soundOn,
  onToggleSound,
  soundAvailable,
}: Props) => {
  const { t } = useLanguage();

  return (
    <>
      <SectionLabel label={t('set_section_voice')} />
      <GroupCard>
        <SwitchRow
          icon="🗣"
          label={t('set_voice_guide_title')}
          sub={voiceGuide ? t('set_voice_guide_on') : t('set_voice_guide_sub')}
          on={voiceGuide}
          onPress={onToggleVoiceGuide}
        />
        <SwitchRow
          divider
          icon="🔔"
          label={t('set_sound_sensors_title')}
          sub={soundOn ? t('set_sound_sensors_sub') : t('set_sound_off')}
          on={soundOn}
          onPress={onToggleSound}
          disabled={!soundAvailable}
        />
      </GroupCard>
    </>
  );
};

export default VoiceSection;
