import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { LocationMode } from '../services/locationService';
import type { AppMode } from '../services/preferencesService';
import type { Declination } from '../utils/declination';
import type { UnitSystem } from '../utils/units';
import { loadLockPin } from '../services/preferencesService';
import { BACKUP_FILE_VERSION, type BackupMode } from '../services/backupService';
import { APP_VERSION, APP_VERSION_CODE } from '../version.generated';
import { checkForUpdate, type AvailableUpdate } from '../services/versionService';
import { loadSoundPref, saveSoundPref, soundAvailable } from '../services/sound';
import UpdateAvailableModal from './UpdateAvailableModal';
import WhatsNewModal from './WhatsNewModal';
import SettingsIndex from './settings/SettingsIndex';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './settings/sections';
import AppearanceSection from './settings/AppearanceSection';
import UsageSection from './settings/UsageSection';
import CompassSection from './settings/CompassSection';
import VoiceSection from './settings/VoiceSection';
import DataSection from './settings/DataSection';
import CloudSection from './settings/CloudSection';
import ShareHistorySection from './settings/ShareHistorySection';
import AccountSection from './settings/AccountSection';
import SecuritySection, { type PinFlowKind } from './settings/SecuritySection';
import AppSection from './settings/AppSection';
import ImportDialog from './settings/ImportDialog';
import PinDialog from './settings/PinDialog';
import ReportProblemDialog from './settings/ReportProblemDialog';
import { Caption } from './settings/primitives';
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
  unitSystem: UnitSystem;
  onToggleUnitSystem: () => void;
  keepAwake: boolean;
  onToggleKeepAwake: () => void;
  onVerifyPin: (pin: string) => Promise<boolean>;
  onSetPin: (pin: string | null) => Promise<void>;
  onExportBackup: () => Promise<void>;
  onApplyBackup: (json: string, mode: BackupMode) => Promise<string | null>;
};

type PinFlow = PinFlowKind | null;

/** Distância, em píxeis, entre o topo do conteúdo e a secção que se quer ler. */
const SECTION_SLACK = 12;

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
  unitSystem,
  onToggleUnitSystem,
  keepAwake,
  onToggleKeepAwake,
  onVerifyPin,
  onSetPin,
  onExportBackup,
  onApplyBackup,
}: Props) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [checking, setChecking] = useState(false);
  const [whatsNewVisible, setWhatsNewVisible] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [pinFlow, setPinFlow] = useState<PinFlow>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [exporting, setExporting] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  // Onde está cada secção no conteúdo, para o índice saltar para ela.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offsets = useRef<Record<string, number>>({});
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('aparencia');

  const sections = useMemo(
    () =>
      SETTINGS_SECTIONS.map(section => ({
        id: section.id,
        label: t(section.labelKey),
        icon: section.icon,
      })),
    [t],
  );

  const mark = useCallback(
    (id: SettingsSectionId) => (event: LayoutChangeEvent) => {
      offsets.current[id] = event.nativeEvent.layout.y;
    },
    [],
  );

  const jumpTo = useCallback((id: string) => {
    const y = offsets.current[id];
    if (y == null) return;
    setActiveSection(id as SettingsSectionId);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - SECTION_SLACK), animated: true });
  }, []);

  // A ficha marcada é a última secção que já passou do topo do ecrã: é a que
  // está a ser lida. O `setState` devolve o valor antigo quando não mudou, e
  // o React não redesenha por causa disso.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y + SECTION_SLACK * 4;
      let current: SettingsSectionId = 'aparencia';
      for (const section of SETTINGS_SECTIONS) {
        const offset = offsets.current[section.id];
        if (offset != null && offset <= y) current = section.id;
      }
      setActiveSection(prev => (prev === current ? prev : current));
    },
    [],
  );

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
        setHasPin(true);
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

  const handleRestore = async (mode: BackupMode) => {
    if (!importText.trim()) return;
    const errorKey = await onApplyBackup(importText, mode);
    if (errorKey == null) {
      setImportVisible(false);
      setImportText('');
      Alert.alert(t('set_backup_import'), t('backup_restored'));
      return;
    }
    if (errorKey.startsWith('write_failed:')) {
      Alert.alert(
        t('set_backup_import'),
        t('backup_error', { error: errorKey.slice('write_failed:'.length) }),
      );
      return;
    }
    Alert.alert(
      t('set_backup_import'),
      errorKey === 'unsupported_version'
        ? t('backup_unsupported_version', { version: BACKUP_FILE_VERSION })
        : t('backup_invalid'),
    );
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

          <SettingsIndex
            sections={sections}
            active={activeSection}
            onSelect={jumpTo}
          />

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={handleScroll}>
            <View onLayout={mark('aparencia')}>
              <AppearanceSection />
            </View>

            <View onLayout={mark('utilizacao')}>
              <UsageSection
                appMode={appMode}
                onSelectAppMode={onSelectAppMode}
                locationMode={locationMode}
                onSelectMode={onSelectMode}
                keepAwake={keepAwake}
                onToggleKeepAwake={onToggleKeepAwake}
              />
            </View>

            <View onLayout={mark('busola')}>
              <CompassSection
                calibrated={calibrated}
                onOpenCalibration={onOpenCalibration}
                declination={declination}
                onSetDeclination={onSetDeclination}
                declinationSuggest={declinationSuggest}
                mils={mils}
                onToggleMils={onToggleMils}
                unitSystem={unitSystem}
                onToggleUnitSystem={onToggleUnitSystem}
                arStatus={arStatus}
              />
            </View>

            <View onLayout={mark('voz')}>
              <VoiceSection
                voiceGuide={voiceGuide}
                onToggleVoiceGuide={onToggleVoiceGuide}
                soundOn={soundOn}
                onToggleSound={toggleSound}
                soundAvailable={soundAvailable}
              />
            </View>

            <View onLayout={mark('dados')}>
              <DataSection
                exporting={exporting}
                onExport={handleExport}
                onOpenImport={() => setImportVisible(true)}
                onOpenWaypoints={onOpenWaypoints}
                onShareLocation={onShareLocation}
              />
              <Caption label={t('set_section_shares')} />
              <ShareHistorySection showLabel={false} />
            </View>

            <View onLayout={mark('nuvem')}>
              <CloudSection />
            </View>

            <View onLayout={mark('conta')}>
              <AccountSection />
            </View>

            <View onLayout={mark('seguranca')}>
              <SecuritySection hasPin={hasPin} onStartFlow={startPinFlow} />
            </View>

            <View onLayout={mark('app')}>
              <AppSection
                onCheckUpdate={handleCheckUpdate}
                checking={checking}
                onOpenWhatsNew={() => setWhatsNewVisible(true)}
                onOpenReportProblem={() => setReportVisible(true)}
              />
            </View>
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

      {reportVisible && (
        <ReportProblemDialog onClose={() => setReportVisible(false)} />
      )}

      <UpdateAvailableModal
        visible={update !== null}
        versionName={update?.versionName ?? ''}
        updateUrl={update?.updateUrl ?? ''}
        message={update?.message ?? null}
        required={update?.required ?? false}
        apkSha256={update?.apkSha256 ?? null}
        hashConflict={update?.hashConflict ?? false}
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
