import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { soundAvailable } from '../../services/sound';
import { APP_VERSION, APP_VERSION_CODE } from '../../version.generated';
import type { Declination } from '../../utils/declination';
import {
  ChevronRow,
  GroupCard,
  GroupRow,
  IconChip,
  RowBody,
  SectionLabel,
  StatusDot,
  Switch,
  SwitchRow,
} from './primitives';
import { styles } from './styles';

export type Suggest = { city: string; uf: string; decl: number } | null;

type Props = {
  calibrated: boolean;
  onOpenCalibration: () => void;
  declination: Declination;
  onSetDeclination: (decl: Declination) => void;
  declinationSuggest: Suggest;
  voiceGuide: boolean;
  onToggleVoiceGuide: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  mils: boolean;
  onToggleMils: () => void;
  keepAwake: boolean;
  onToggleKeepAwake: () => void;
  onOpenWaypoints: () => void;
  onShareLocation: () => void;
  arStatus: { supported: boolean; label: string };
  onCheckUpdate: () => void;
  checking: boolean;
  onOpenWhatsNew: () => void;
};

const round = (value: number) => Math.round(value * 2) / 2;

const CompassSection = (props: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const {
    calibrated,
    onOpenCalibration,
    declination,
    onSetDeclination,
    declinationSuggest,
    voiceGuide,
    onToggleVoiceGuide,
    soundOn,
    onToggleSound,
    mils,
    onToggleMils,
    keepAwake,
    onToggleKeepAwake,
    onOpenWaypoints,
    onShareLocation,
    arStatus,
    onCheckUpdate,
    checking,
    onOpenWhatsNew,
  } = props;

  const setDecl = (patch: Partial<Declination>) =>
    onSetDeclination({ ...declination, ...patch });

  return (
    <>
      <SectionLabel label={t('set_section_compass')} />
      <GroupCard>
        <GroupRow
          onPress={onOpenCalibration}
          borderColor={calibrated ? colors.success : colors.border}>
          <IconChip icon="🧭" />
          <RowBody
            label={t('set_cal_title')}
            sub={calibrated ? t('set_cal_applied') : t('set_cal_sub')}
          />
          <StatusDot good={calibrated} />
        </GroupRow>

        <GroupRow divider col>
          <View style={styles.calRow}>
            <IconChip icon="🧲" />
            <RowBody
              label={t('set_decl_title')}
              sub={
                declination.enabled
                  ? t('set_decl_on', {
                      deg: `${declination.degrees > 0 ? '+' : ''}${declination.degrees}°`,
                    })
                  : t('set_decl_off')
              }
              lines={2}
            />
            <Switch
              on={declination.enabled}
              onPress={() => setDecl({ enabled: !declination.enabled })}
            />
          </View>

          {declination.enabled && (
            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => setDecl({ degrees: round(declination.degrees - 0.5) })}
                style={[styles.stepperButton, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.stepperText, { color: colors.text }]}>−</Text>
              </Pressable>
              <Text style={[styles.stepperValue, { color: colors.text }]}>
                {declination.degrees > 0 ? '+' : ''}
                {declination.degrees}°
              </Text>
              <Pressable
                onPress={() => setDecl({ degrees: round(declination.degrees + 0.5) })}
                style={[styles.stepperButton, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.stepperText, { color: colors.text }]}>+</Text>
              </Pressable>
            </View>
          )}

          {declinationSuggest && (
            <Pressable
              onPress={() => setDecl({ enabled: true, degrees: declinationSuggest.decl })}
              style={styles.suggestButton}>
              <Text style={[styles.suggestText, { color: colors.primary }]}>
                {t('set_suggest', {
                  deg: `${declinationSuggest.decl > 0 ? '+' : ''}${declinationSuggest.decl}`,
                  city: declinationSuggest.city,
                  uf: declinationSuggest.uf,
                })}
              </Text>
            </Pressable>
          )}
        </GroupRow>

        <SwitchRow
          divider
          icon="🔊"
          label={t('set_voice_guide_title')}
          sub={voiceGuide ? t('set_voice_guide_on') : t('set_voice_guide_sub')}
          on={voiceGuide}
          onPress={onToggleVoiceGuide}
        />

        <SwitchRow
          divider
          icon="🔊"
          label={t('set_sound_sensors_title')}
          sub={soundOn ? t('set_sound_sensors_sub') : t('set_sound_off')}
          on={soundOn}
          onPress={onToggleSound}
          disabled={!soundAvailable}
        />

        <SwitchRow
          divider
          icon="🎯"
          label={t('set_mils_title')}
          sub={t('set_mils_sub')}
          on={mils}
          onPress={onToggleMils}
        />

        <SwitchRow
          divider
          icon="💡"
          label={t('set_keep_awake_title')}
          sub={keepAwake ? t('set_keep_awake_on') : t('set_keep_awake_sub')}
          on={keepAwake}
          onPress={onToggleKeepAwake}
        />

        <ChevronRow
          divider
          icon="📍"
          label={t('set_wp_title')}
          sub={t('set_wp_sub')}
          onPress={onOpenWaypoints}
        />

        <ChevronRow
          divider
          icon="📤"
          label={t('set_share_title')}
          sub={t('set_share_sub')}
          onPress={onShareLocation}
        />

        <GroupRow divider>
          <IconChip icon="✨" />
          <RowBody
            label={t('set_ar_title')}
            sub={arStatus.label}
            subColor={arStatus.supported ? colors.success : colors.danger}
          />
          <View
            style={[
              styles.statusDot,
              { backgroundColor: arStatus.supported ? colors.success : colors.danger },
            ]}
          />
        </GroupRow>

        <ChevronRow
          divider
          icon="📲"
          label={t('set_check_update')}
          sub={`${t('ui_app_title')} · v${APP_VERSION} (${APP_VERSION_CODE})`}
          onPress={onCheckUpdate}
          disabled={checking}
          chevronText={checking ? '…' : '›'}
        />

        <ChevronRow
          divider
          icon="✨"
          label={t('wn_subtitle')}
          sub={t('wn_title', { version: APP_VERSION })}
          onPress={onOpenWhatsNew}
        />
      </GroupCard>
    </>
  );
};

export default CompassSection;
