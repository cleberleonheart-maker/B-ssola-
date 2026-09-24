import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
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
import { loadLockPin } from '../services/preferencesService';
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
  mils: boolean;
  onToggleMils: () => void;
  onVerifyPin: (pin: string) => Promise<boolean>;
  onSetPin: (pin: string | null) => Promise<void>;
  onExportBackup: () => Promise<void>;
  onApplyBackup: (json: string) => Promise<string | null>;
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
  night: 'ui_theme_night',
};

type PinFlow =
  | { kind: 'new'; step: 'enter' | 'confirm'; first: string }
  | { kind: 'change'; step: 'current' }
  | { kind: 'change'; step: 'enter' | 'confirm'; first: string }
  | { kind: 'remove'; step: 'current' }
  | null;

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
  mils,
  onToggleMils,
  onVerifyPin,
  onSetPin,
  onExportBackup,
  onApplyBackup,
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
  const [pinFlow, setPinFlow] = useState<PinFlow>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [exporting, setExporting] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    if (!visible) return;
    loadLockPin()
      .then(pin => setHasPin(pin != null))
      .catch(() => {});
  }, [visible]);

  const closePinFlow = React.useCallback(() => {
    setPinFlow(null);
    setPinInput('');
    setPinError(null);
  }, []);

  const advancePin = React.useCallback(async () => {
    const digits = pinInput;
    const flow = pinFlow;
    if (!flow || digits.length !== 4) return;

    if (flow.kind === 'new') {
      if (flow.step === 'enter') {
        setPinFlow({ kind: 'new', step: 'confirm', first: digits });
        setPinInput('');
        return;
      }
      if (digits === flow.first) {
        await onSetPin(digits);
        closePinFlow();
        setHasPin(true);
        Alert.alert(t('lock_title'), t('lock_pin_created'));
      } else {
        setPinFlow({ kind: 'new', step: 'enter', first: '' });
        setPinInput('');
        setPinError(t('lock_pin_mismatch'));
      }
      return;
    }

    if (flow.kind === 'change') {
      if (flow.step === 'current') {
        const ok = await onVerifyPin(digits);
        if (ok) {
          setPinFlow({ kind: 'change', step: 'enter', first: '' });
          setPinInput('');
        } else {
          setPinInput('');
          setPinError(t('lock_pin_wrong'));
        }
        return;
      }
      if (flow.step === 'enter') {
        setPinFlow({ kind: 'change', step: 'confirm', first: digits });
        setPinInput('');
        return;
      }
      if (digits === flow.first) {
        await onSetPin(digits);
        closePinFlow();
        Alert.alert(t('lock_title'), t('lock_pin_created'));
      } else {
        setPinFlow({ kind: 'change', step: 'enter', first: '' });
        setPinInput('');
        setPinError(t('lock_pin_mismatch'));
      }
      return;
    }

    const ok = await onVerifyPin(digits);
    if (ok) {
      await onSetPin(null);
      closePinFlow();
      setHasPin(false);
      Alert.alert(t('lock_title'), t('lock_pin_removed'));
    } else {
      setPinInput('');
      setPinError(t('lock_pin_wrong'));
    }
  }, [pinInput, pinFlow, onVerifyPin, onSetPin, t, closePinFlow]);

  useEffect(() => {
    if (pinInput.length === 4) {
      advancePin();
    }
  }, [pinInput, advancePin]);

  const pinTitle = (() => {
    if (!pinFlow) return '';
    if (pinFlow.kind === 'new' || (pinFlow.kind === 'change' && pinFlow.step !== 'current')) {
      return pinFlow.kind === 'change' && pinFlow.step === 'confirm'
        ? t('lock_pin_confirm')
        : pinFlow.kind === 'new' && pinFlow.step === 'confirm'
          ? t('lock_pin_confirm')
          : t('lock_set_pin');
    }
    if (pinFlow.kind === 'change') return t('lock_pin_enter');
    return t('lock_remove_pin');
  })();

  const pinSub = (() => {
    if (!pinFlow) return '';
    if (pinFlow.kind === 'change' && pinFlow.step === 'current') {
      return t('lock_pin_required_off');
    }
    if (pinFlow.kind === 'remove') return t('lock_pin_required_off');
    return '';
  })();

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await onExportBackup();
      Alert.alert(t('set_backup_export'), t('backup_exported'));
    } catch {
      Alert.alert(t('set_backup_export'), t('backup_error', { error: '' }));
    } finally {
      setExporting(false);
    }
  };

  const handleRestore = async () => {
    if (!importText.trim()) return;
    const errorKey = await onApplyBackup(importText);
    if (errorKey == null) {
      setImportVisible(false);
      setImportText('');
      Alert.alert(t('set_backup_import'), t('backup_restored'));
    } else {
      Alert.alert(
        t('set_backup_import'),
        errorKey === 'invalid'
          ? t('backup_invalid')
          : t('backup_error', { error: errorKey }),
      );
    }
  };

  const startPinFlow = (flow: Exclude<PinFlow, null>) => {
    setPinFlow(flow);
    setPinInput('');
    setPinError(null);
  };

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

              <View style={[styles.groupRow, rowDivider]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>🎯</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('set_mils_title')}
                  </Text>
                  <Text style={[styles.groupSub, { color: colors.textMuted }]} numberOfLines={2}>
                    {t('set_mils_sub')}
                  </Text>
                </View>
                <Pressable
                  onPress={onToggleMils}
                  style={[
                    styles.switchTrack,
                    mils ? styles.switchTrackOn : styles.switchTrackOff,
                    {
                      backgroundColor: mils ? colors.primary : colors.surfaceAlt,
                    },
                  ]}>
                  <View
                    style={[
                      styles.switchKnob,
                      {
                        backgroundColor: mils ? colors.background : colors.textMuted,
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

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('set_section_security')}
            </Text>
            <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.groupRow, styles.rowCol]}>
                <View style={styles.calRow}>
                  <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={styles.iconChipText}>🔐</Text>
                  </View>
                  <View style={styles.groupText}>
                    <Text style={[styles.groupLabel, { color: colors.text }]}>
                      {t('lock_title')}
                    </Text>
                    <Text style={[styles.groupSub, { color: colors.textMuted }]} numberOfLines={2}>
                      {t('lock_sub')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      hasPin
                        ? startPinFlow({ kind: 'remove', step: 'current' })
                        : startPinFlow({ kind: 'new', step: 'enter', first: '' })
                    }
                    style={[
                      styles.switchTrack,
                      hasPin ? styles.switchTrackOn : styles.switchTrackOff,
                      {
                        backgroundColor: hasPin ? colors.primary : colors.surfaceAlt,
                      },
                    ]}>
                    <View
                      style={[
                        styles.switchKnob,
                        {
                          backgroundColor: hasPin
                            ? colors.background
                            : colors.textMuted,
                        },
                      ]}
                    />
                  </Pressable>
                </View>
              </View>

              {hasPin && (
                <Pressable
                  onPress={() =>
                    startPinFlow({ kind: 'change', step: 'current' })
                  }
                  style={[styles.groupRow, rowDivider]}>
                  <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={styles.iconChipText}>🔑</Text>
                  </View>
                  <View style={styles.groupText}>
                    <Text style={[styles.groupLabel, { color: colors.text }]}>
                      {t('lock_change_pin')}
                    </Text>
                    <Text style={[styles.groupSub, { color: colors.textMuted }]}>
                      {t('lock_pin_confirm')}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
                </Pressable>
              )}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('set_section_data')}
            </Text>
            <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
              <Pressable
                onPress={handleExport}
                disabled={exporting}
                style={[styles.groupRow]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>💾</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('set_backup_export')}
                  </Text>
                  <Text style={[styles.groupSub, { color: colors.textMuted }]} numberOfLines={3}>
                    {t('backup_notes_hint')}
                  </Text>
                </View>
                {exporting ? (
                  <Text style={[styles.chevron, { color: colors.textMuted }]}>…</Text>
                ) : (
                  <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setImportVisible(true)}
                style={[styles.groupRow, rowDivider]}>
                <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconChipText}>📥</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={[styles.groupLabel, { color: colors.text }]}>
                    {t('set_backup_import')}
                  </Text>
                  <Text style={[styles.groupSub, { color: colors.textMuted }]} numberOfLines={2}>
                    {t('backup_import_sub')}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>

      {pinFlow && (
        <View style={styles.pinOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePinFlow} />
          <View style={[styles.pinCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.pinTitle, { color: colors.text }]}>{pinTitle}</Text>
            <Text style={[styles.pinSub, { color: colors.textMuted }]}>{pinSub}</Text>
            <TextInput
              autoFocus
              keyboardType="number-pad"
              value={pinInput}
              onChangeText={text => {
                const digits = text.replace(/\D/g, '').slice(0, 4);
                setPinInput(digits);
                setPinError(null);
              }}
              maxLength={4}
              secureTextEntry
              style={[
                styles.pinInput,
                { borderColor: colors.border, color: colors.text },
              ]}
              placeholder="••••"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.pinDots}>
              {[0, 1, 2, 3].map(i => (
                <View
                  key={i}
                  style={[
                    styles.pinDot,
                    { backgroundColor: i < pinInput.length ? colors.primary : colors.border },
                  ]}
                />
              ))}
            </View>
            {pinError ? (
              <Text style={[styles.pinErrorText, { color: colors.danger }]}>
                {pinError}
              </Text>
            ) : (
              <View style={styles.pinErrorSpacer} />
            )}
            <Pressable onPress={closePinFlow} style={styles.pinCancel}>
              <Text style={[styles.pinCancelText, { color: colors.textMuted }]}>
                {t('backup_cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {importVisible && (
        <View style={styles.pinOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setImportVisible(false)}
          />
          <View style={[styles.importCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.pinTitle, { color: colors.text }]}>
              {t('backup_import_title')}
            </Text>
            <Text style={[styles.pinSub, { color: colors.textMuted }]}>
              {t('backup_import_sub')}
            </Text>
            <TextInput
              multiline
              autoFocus
              value={importText}
              onChangeText={setImportText}
              style={[
                styles.importInput,
                { borderColor: colors.border, color: colors.text },
              ]}
              placeholder={t('backup_import_placeholder')}
              placeholderTextColor={colors.textMuted}
              textAlignVertical="top"
            />
            <View style={styles.importActions}>
              <Pressable
                onPress={() => setImportVisible(false)}
                style={styles.pinCancel}>
                <Text style={[styles.pinCancelText, { color: colors.textMuted }]}>
                  {t('backup_cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    t('backup_restore_confirm'),
                    t('backup_import_sub'),
                    [
                      { text: t('backup_cancel'), style: 'cancel' },
                      { text: t('backup_restore'), onPress: handleRestore },
                    ],
                  );
                }}
                disabled={!importText.trim()}
                style={[
                  styles.restoreButton,
                  { backgroundColor: colors.primary, opacity: importText.trim() ? 1 : 0.5 },
                ]}>
                <Text style={styles.restoreButtonText}>
                  {t('backup_restore')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

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
    flexWrap: 'wrap',
  },
  gridOption: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
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
  pinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.xl,
  },
  pinCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#00000018',
    padding: spacing.xl,
    alignItems: 'center',
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  pinSub: {
    fontSize: 12,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 16,
  },
  pinInput: {
    width: 160,
    height: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    fontSize: 26,
    letterSpacing: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  pinDots: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 6,
  },
  pinErrorText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  pinErrorSpacer: {
    marginTop: spacing.md,
    height: 16,
  },
  pinCancel: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  pinCancelText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  importCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#00000018',
    padding: spacing.lg,
  },
  importInput: {
    width: '100%',
    height: 140,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 13,
    marginTop: spacing.sm,
    fontFamily: 'monospace',
  },
  importActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  restoreButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginLeft: spacing.sm,
  },
  restoreButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default SettingsModal;