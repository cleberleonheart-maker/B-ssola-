import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import type { Declination } from '../../utils/declination';
import type { UnitSystem } from '../../utils/units';
import {
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
  mils: boolean;
  onToggleMils: () => void;
  unitSystem: UnitSystem;
  onToggleUnitSystem: () => void;
  arStatus: { supported: boolean; label: string };
};

const round = (value: number) => Math.round(value * 2) / 2;

/**
 * Bússola: a leitura e as unidades em que ela é feita.
 *
 * Antes esta secção era ogressive: calibração, declinação, voz, sons, milés,
 * unidades, tela, waypoints, partilha, AR, atualização e novidades. Ficou só
 * com o que é medida — a leitura está certa? (calibração, declinação), em que
 * unidades se lê? (miles, imperial) e há leitura em AR? (estado do AR).
 */
const CompassSection = (props: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();
  const {
    calibrated,
    onOpenCalibration,
    declination,
    onSetDeclination,
    declinationSuggest,
    mils,
    onToggleMils,
    unitSystem,
    onToggleUnitSystem,
    arStatus,
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
          icon="🎯"
          label={t('set_mils_title')}
          sub={t('set_mils_sub')}
          on={mils}
          onPress={onToggleMils}
        />

        <SwitchRow
          divider
          icon="📏"
          label={t('set_units_title')}
          sub={unitSystem === 'imperial' ? t('set_units_imperial') : t('set_units_metric')}
          on={unitSystem === 'imperial'}
          onPress={onToggleUnitSystem}
        />

        <GroupRow divider>
          <IconChip icon="🕶" />
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
      </GroupCard>
    </>
  );
};

export default CompassSection;
