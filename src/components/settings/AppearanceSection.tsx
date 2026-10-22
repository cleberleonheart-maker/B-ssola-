import React from 'react';
import { Text, View } from 'react-native';
import { useTheme, useThemeColors } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { LANGS } from '../../i18n/strings';
import type { ThemeName } from '../../theme/themes';
import { THEME_AUTO_MODES, type ThemeAutoMode } from '../../theme/themeAuto';
import {
  Caption,
  GridOption,
  GroupCard,
  RadioRow,
  SectionLabel,
} from './primitives';
import { styles } from './styles';

const THEME_LABEL_KEYS: Record<string, string> = {
  light: 'ui_theme_light',
  sun: 'ui_theme_sun',
  dark: 'ui_theme_dark',
  space: 'ui_theme_space',
  minimal: 'ui_theme_minimal',
  adventure: 'ui_theme_adventure',
  neon: 'ui_theme_neon',
  night: 'ui_theme_night',
};

// As três estratégias do tema automático (ideia #15).
const THEME_AUTO_LABEL: Record<ThemeAutoMode, string> = {
  scheduleLight: 'theme_auto_sched_light',
  scheduleSun: 'theme_auto_sched_sun',
  sunReal: 'theme_auto_sunreal',
};
const THEME_AUTO_SUB: Record<ThemeAutoMode, string> = {
  scheduleLight: 'theme_auto_sched_light_sub',
  scheduleSun: 'theme_auto_sched_sun_sub',
  sunReal: 'theme_auto_sunreal_sub',
};

/**
 * Aparência: como o app se vê e em que língua fala.
 *
 * Tema e idioma ficam juntos porque são a mesma pergunta — "como isto se
 * apresenta" — e nenhum dos dois é uma medida: o que se mede está mais abaixo,
 * na secção da bússola.
 */
const AppearanceSection = () => {
  const { preference, autoMode, setTheme, setAutoMode, themeOptions } = useTheme();
  const colors = useThemeColors();
  const { t, lang, setLang } = useLanguage();

  const autoModes = THEME_AUTO_MODES.map(key => ({
    key,
    icon: key === 'scheduleSun' ? '🔆' : key === 'sunReal' ? '🌅' : '☀️',
    label: t(THEME_AUTO_LABEL[key]),
    sub: t(THEME_AUTO_SUB[key]),
  }));

  return (
    <>
      <SectionLabel label={t('set_section_appearance')} />

      <Caption label={t('set_section_theme')} />
      <View style={styles.gridRow}>
        <GridOption
          selected={preference === 'auto'}
          onPress={() => setTheme('auto')}
          label={t('ui_theme_auto')}
        />
        {themeOptions.map(option => (
          <GridOption
            key={option.key}
            selected={preference === option.key}
            onPress={() => setTheme(option.key as ThemeName)}
            swatch
            label={t(THEME_LABEL_KEYS[option.key] ?? 'ui_theme_dark')}
          />
        ))}
      </View>

      {preference === 'auto' && (
        <>
          <Text style={[styles.autoHint, { color: colors.textMuted }]}>
            {t('set_theme_auto_hint')}
          </Text>
          <GroupCard>
            {autoModes.map((mode, i) => (
              <RadioRow
                key={mode.key}
                divider={i > 0}
                icon={mode.icon}
                label={mode.label}
                sub={mode.sub}
                selected={autoMode === mode.key}
                onPress={() => setAutoMode(mode.key)}
              />
            ))}
          </GroupCard>
        </>
      )}

      <Caption label={t('set_section_lang')} />
      <View style={styles.gridRow}>
        {LANGS.map(langOption => (
          <GridOption
            key={langOption.key}
            selected={lang === langOption.key}
            onPress={() => setLang(langOption.key)}
            label={langOption.label}
          />
        ))}
      </View>
    </>
  );
};

export default AppearanceSection;
