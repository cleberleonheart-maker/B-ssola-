import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGS } from '../i18n/strings';
import type { Translator } from '../i18n/strings';
import type { ThemeName } from '../theme/themes';
import type { LocationMode } from '../services/locationService';
import type { AppMode } from '../services/preferencesService';
import type { Declination } from '../utils/declination';
import { loadLockPin } from '../services/preferencesService';
import { APP_VERSION, APP_VERSION_CODE } from '../version.generated';
import { checkForUpdate, type AvailableUpdate } from '../services/versionService';
import { loadSoundPref, saveSoundPref } from '../services/sound';
import UpdateAvailableModal from './UpdateAvailableModal';
import WhatsNewModal from './WhatsNewModal';
import CompassSection from './settings/CompassSection';
import DataSection from './settings/DataSection';
import ImportDialog from './settings/ImportDialog';
import PinDialog from './settings/PinDialog';
import SecuritySection, { type PinFlowKind } from './settings/SecuritySection';
import {
  GridOption,
  GroupCard,
  RadioRow,
  SectionLabel,
} from './settings/primitives';
import { styles } from './settings/styles';

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
  space: 'ui_theme_space',
  minimal: 'ui_theme_minimal',
  adventure: 'ui_theme_adventure',
  neon: 'ui_theme_neon',
  night: 'ui_theme_night',
};

type PinFlow = PinFlowKind | null;

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
            <SectionLabel label={t('set_section_theme')} />
            <View style={styles.gridRow}>
              {themeOptions.map(option => (
                <GridOption
                  key={option.key}
                  selected={theme === option.key}
                  onPress={() => setTheme(option.key as ThemeName)}
                  swatch
                  label={t(THEME_LABEL_KEYS[option.key] ?? 'ui_theme_dark')}
                />
              ))}
            </View>

            <SectionLabel label={t('set_section_lang')} />
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

            <SectionLabel label={t('set_section_mode')} />
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

            <SectionLabel label={t('set_section_loc')} />
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

            <CompassSection
              calibrated={calibrated}
              onOpenCalibration={onOpenCalibration}
              declination={declination}
              onSetDeclination={onSetDeclination}
              declinationSuggest={declinationSuggest}
              voiceGuide={voiceGuide}
              onToggleVoiceGuide={onToggleVoiceGuide}
              soundOn={soundOn}
              onToggleSound={toggleSound}
              mils={mils}
              onToggleMils={onToggleMils}
              onOpenWaypoints={onOpenWaypoints}
              onShareLocation={onShareLocation}
              arStatus={arStatus}
              onCheckUpdate={handleCheckUpdate}
              checking={checking}
              onOpenWhatsNew={() => setWhatsNewVisible(true)}
            />

            <SecuritySection hasPin={hasPin} onStartFlow={startPinFlow} />

            <DataSection
              exporting={exporting}
              onExport={handleExport}
              onOpenImport={() => setImportVisible(true)}
            />
          </ScrollView>
        </Pressable>
      </Pressable>

      {pinFlow && (
        <PinDialog
          title={pinTitle}
          sub={pinSub}
          value={pinInput}
          error={pinError}
          onChange={text => {
            setPinInput(text.replace(/\D/g, '').slice(0, 4));
            setPinError(null);
          }}
          onClose={closePinFlow}
        />
      )}

      {importVisible && (
        <ImportDialog
          value={importText}
          onChange={setImportText}
          onClose={() => setImportVisible(false)}
          onRestore={handleRestore}
        />
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

export default SettingsModal;
