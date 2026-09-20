import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGS } from '../i18n/strings';
import type { Translator } from '../i18n/strings';
import { spacing, radius } from '../theme/colors';
import type { ThemeName } from '../theme/themes';
import type { LocationMode } from '../services/locationService';
import type { AppMode } from '../services/preferencesService';
import type { Declination } from '../utils/declination';
import { APP_VERSION, APP_VERSION_CODE } from '../version.generated';
import { checkForUpdate, type AvailableUpdate } from '../services/versionService';
import { soundAvailable, loadSoundPref, saveSoundPref } from '../services/sound';
import UpdateAvailableModal from './UpdateAvailableModal';
import WhatsNewModal from './WhatsNewModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  locationMode: LocationMode;
  onSelectMode: (mode: LocationMode) => void;
  calibrated: boolean;
  onOpenCalibration: () => void;
  appMode: AppMode;
  onSelectAppMode: (mode: AppMode) => void;
  declination: Declination;
  onSetDeclination: (decl: Declination) => void;
  declinationSuggest: { city: string; uf: string; decl: number } | null;
  onOpenWaypoints: () => void;
  onShareLocation: () => void;
  arStatus: { supported: boolean; label: string };
  voiceGuide: boolean;
  onToggleVoiceGuide: () => void;
};

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

const THEME_LABEL_KEYS: Record<string, string> = {
  light: 'ui_theme_light',
  dark: 'ui_theme_dark',
  minimal: 'ui_theme_minimal',
  adventure: 'ui_theme_adventure',
  neon: 'ui_theme_neon',
};

const SettingsModal = ({
  visible,
  onClose,
  locationMode,
  onSelectMode,
  calibrated,
  onOpenCalibration,
  appMode,
  onSelectAppMode,
  declination,
  onSetDeclination,
  declinationSuggest,
  onOpenWaypoints,
  onShareLocation,
  arStatus,
  voiceGuide,
  onToggleVoiceGuide,
}: Props) => {
  const { colors, theme, setTheme, themeOptions } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const locationModes = LOCATION_MODES(t);
  const appModes = APP_MODES(t);

  const setDecl = (patch: Partial<Declination>) =>
    onSetDeclination({ ...declination, ...patch });

  const rowDivider: StyleProp<ViewStyle> = {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  };

  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [checking, setChecking] = useState(false);
  const [whatsNewVisible, setWhatsNewVisible] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    loadSoundPref()
      .then(setSoundOn)
      .catch(() => {});
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    saveSoundPref(next).catch(() => {});
  };

  const handleCheckUpdate = async () => {
    if (checking) {
      return;
    }
    setChecking(true);
    const found = await checkForUpdate({ ignoreOffered: true });
    if (found) {
      setUpdate(found);
    } else {
      Alert.alert(t('set_check_update'), t('set_up_to_date'), [
        { text: 'OK', onPress: () => {} },
      ]);
    }
    setChecking(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.background }]}
          onPress={() => {}}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('ui_settings_title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('ui_app_title')} · v{APP_VERSION} ({APP_VERSION_CODE})
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('set_section_theme')}
            </Text>
            <View style={styles.gridRow}>
              {themeOptions.map(option => {
                const selected = theme === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setTheme(option.key as ThemeName)}
                    style={[
                      styles.gridOption,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.surfaceAlt : colors.surface,
                      },
                    ]}>
                    <View
                      style={[
                        styles.themeSwatch,
                        { backgroundColor: selected ? colors.primary : colors.surfaceAlt },
                      ]}>
                      <View
                        style={[
                          styles.themeSwatchDot,
                          {
                            backgroundColor: selected ? colors.surface : colors.textMuted,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.gridLabel,
                        { color: selected ? colors.text : colors.textMuted },
                      ]}>
                      {t(THEME_LABEL_KEYS[option.key] ?? 'ui_theme_dark')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('set_section_lang')}
            </Text>
            <View style={styles.gridRow}>
              {LANGS.map(langOption => {
                const selected = lang === langOption.key;
                return (
                  <Pressable
                    key={langOption.key}
                    onPress={() => setLang(langOption.key)}
                    style={[
                      styles.gridOption,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.surfaceAlt : colors.surface,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.gridLabel,
                        { color: selected ? colors.text : colors.textMuted },
                      ]}>
                      {langOption.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('set_section_mode')}
            </Text>
            <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
              {appModes.map((mode, i) => {
                const selected = appMode === mode.key;
                return (
                  <Pressable
                    key={mode.key}
                    onPress={() => onSelectAppMode(mode.key)}
                    style={[styles.groupRow, i > 0 && rowDivider]}>
                    <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                      <Text style={styles.iconChipText}>{mode.icon}</Text>
                    </View>
                    <View style={styles.groupText}>
                      <Text style={[styles.groupLabel, { color: selected ? colors.text : colors.textMuted }]}>
                        {mode.label}
                      </Text>
                      <Text style={[styles.groupSub, { color: colors.textMuted }]} numberOfLines={2}>
                        {mode.sub}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        { borderColor: selected ? colors.primary : colors.border },
                      ]}>
                      {selected && (
                        <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('set_section_loc')}
            </Text>
            <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
              {locationModes.map((mode, i) => {
                const selected = locationMode === mode.key;
                return (
                  <Pressable
                    key={mode.key}
                    onPress={() => onSelectMode(mode.key)}
                    style={[styles.groupRow, i > 0 && rowDivider]}>
                    <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                      <Text style={styles.iconChipText}>{mode.icon}</Text>
                    </View>
                    <View style={styles.groupText}>
                      <Text style={[styles.groupLabel, { color: selected ? colors.text : colors.textMuted }]}>
                        {mode.label}
                      </Text>
                      <Text style={[styles.groupSub, { color: colors.textMuted }]} numberOfLines={2}>
                        {mode.sub}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        { borderColor: selected ? colors.primary : colors.border },
                      ]}>
                      {selected && (
                        <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('set_section_compass')}
            </Text>
            <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
              <Pressable
                onPress={onOpenCalibration}
                style={[
                  styles.groupRow,
                  {
                    borderColor: calibrated ? colors.success : colors.border,
                  },
                ]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>🧭</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('set_cal_title')}
                  </Text>
                  <Text style={[styles.groupSub, { color: colors.textMuted }]}>
                    {calibrated ? t('set_cal_applied') : t('set_cal_sub')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: calibrated ? colors.success : colors.textMuted },
                  ]}
                />
              </Pressable>

              <View style={[styles.groupRow, styles.rowCol, rowDivider]}>
                <View style={styles.calRow}>
                  <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={styles.iconChipText}>🧲</Text>
                  </View>
                  <View style={styles.groupText}>
                    <Text style={[styles.groupLabel, { color: colors.text }]}>
                      {t('set_decl_title')}
                    </Text>
                    <Text style={[styles.groupSub, { color: colors.textMuted }]} numberOfLines={2}>
                      {declination.enabled
                        ? t('set_decl_on', {
                            deg: `${declination.degrees > 0 ? '+' : ''}${declination.degrees}°`,
                          })
                        : t('set_decl_off')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setDecl({ enabled: !declination.enabled })}
                    style={[
                      styles.switchTrack,
                      declination.enabled
                        ? styles.switchTrackOn
                        : styles.switchTrackOff,
                      {
                        backgroundColor: declination.enabled ? colors.primary : colors.surfaceAlt,
                      },
                    ]}>
                    <View
                      style={[
                        styles.switchKnob,
                        {
                          backgroundColor: declination.enabled ? colors.background : colors.textMuted,
                        },
                      ]}
                    />
                  </Pressable>
                </View>

                {declination.enabled && (
                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => setDecl({ degrees: Math.round((declination.degrees - 0.5) * 2) / 2 })}
                      style={[styles.stepperButton, { backgroundColor: colors.surfaceAlt }]}>
                      <Text style={[styles.stepperText, { color: colors.text }]}>−</Text>
                    </Pressable>
                    <Text style={[styles.stepperValue, { color: colors.text }]}>
                      {declination.degrees > 0 ? '+' : ''}
                      {declination.degrees}°
                    </Text>
                    <Pressable
                      onPress={() => setDecl({ degrees: Math.round((declination.degrees + 0.5) * 2) / 2 })}
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
              </View>

              <View style={[styles.groupRow, rowDivider]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>🔊</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('set_voice_guide_title')}
                  </Text>
                  <Text style={[styles.groupSub, { color: colors.textMuted }]} numberOfLines={2}>
                    {voiceGuide
                      ? t('set_voice_guide_on')
                      : t('set_voice_guide_sub')}
                  </Text>
                </View>
                <Pressable
                  onPress={onToggleVoiceGuide}
                  style={[
                    styles.switchTrack,
                    voiceGuide ? styles.switchTrackOn : styles.switchTrackOff,
                    {
                      backgroundColor: voiceGuide ? colors.primary : colors.surfaceAlt,
                    },
                  ]}>
                  <View
                    style={[
                      styles.switchKnob,
                      {
                        backgroundColor: voiceGuide
                          ? colors.background
                          : colors.textMuted,
                      },
                    ]}
                  />
                </Pressable>
              </View>

              <View style={[styles.groupRow, rowDivider]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>🔊</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('set_sound_sensors_title')}
                  </Text>
                  <Text style={[styles.groupSub, { color: colors.textMuted }]} numberOfLines={2}>
                    {soundOn
                      ? t('set_sound_sensors_sub')
                      : t('set_sound_off')}
                  </Text>
                </View>
                <Pressable
                  disabled={!soundAvailable}
                  onPress={toggleSound}
                  style={[
                    styles.switchTrack,
                    soundOn ? styles.switchTrackOn : styles.switchTrackOff,
                    {
                      backgroundColor: soundOn ? colors.primary : colors.surfaceAlt,
                    },
                  ]}>
                  <View
                    style={[
                      styles.switchKnob,
                      {
                        backgroundColor: soundOn ? colors.background : colors.textMuted,
                      },
                    ]}
                  />
                </Pressable>
              </View>

              <Pressable onPress={onOpenWaypoints} style={[styles.groupRow, rowDivider]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>📍</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('set_wp_title')}
                  </Text>
                  <Text style={[styles.groupSub, { color: colors.textMuted }]}>
                    {t('set_wp_sub')}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
              </Pressable>

              <Pressable onPress={onShareLocation} style={[styles.groupRow, rowDivider]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>📤</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('set_share_title')}
                  </Text>
                  <Text style={[styles.groupSub, { color: colors.textMuted }]}>
                    {t('set_share_sub')}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
              </Pressable>

              <View style={[styles.groupRow, rowDivider]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>✨</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('set_ar_title')}
                  </Text>
                  <Text
                    style={[
                      styles.groupSub,
                      { color: arStatus.supported ? colors.success : colors.danger },
                    ]}>
                    {arStatus.label}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: arStatus.supported ? colors.success : colors.danger },
                  ]}
                />
              </View>

              <Pressable
                onPress={handleCheckUpdate}
                disabled={checking}
                style={[styles.groupRow, rowDivider]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>📲</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('set_check_update')}
                  </Text>
                  <Text style={[styles.groupSub, { color: colors.textMuted }]}>
                    {checking
                      ? '…'
                      : `${t('ui_app_title')} · v${APP_VERSION} (${APP_VERSION_CODE})`}
                  </Text>
                </View>
                {checking ? (
                  <Text style={[styles.chevron, { color: colors.textMuted }]}>…</Text>
                ) : (
                  <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setWhatsNewVisible(true)}
                style={[styles.groupRow, rowDivider]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>✨</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('wn_subtitle')}
                  </Text>
                  <Text style={[styles.groupSub, { color: colors.textMuted }]}>
                    {t('wn_title', { version: APP_VERSION })}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>

      <UpdateAvailableModal
        visible={update !== null}
        versionName={update?.versionName ?? ''}
        updateUrl={update?.updateUrl ?? ''}
        message={update?.message ?? null}
        required={update?.required ?? false}
        onClose={() => setUpdate(null)}
      />
      <WhatsNewModal
        visible={whatsNewVisible}
        onClose={() => setWhatsNewVisible(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00000022',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridOption: {
    flex: 1,
    marginRight: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSwatch: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs + 2,
  },
  themeSwatchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  groupCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#00000018',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowCol: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconChipText: {
    fontSize: 18,
  },
  groupText: {
    flex: 1,
  },
  groupLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  groupSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: spacing.sm,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  switchTrackOn: {
    justifyContent: 'flex-end',
  },
  switchTrackOff: {
    justifyContent: 'flex-start',
  },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: 20,
    fontWeight: '800',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '800',
    marginHorizontal: spacing.md,
    minWidth: 64,
    textAlign: 'center',
  },
  suggestButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  suggestText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
});

export default SettingsModal;