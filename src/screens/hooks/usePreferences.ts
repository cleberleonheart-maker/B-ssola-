import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

import {
  loadAppMode,
  loadBeaconEnabled,
  loadBeaconInterval,
  loadDeclination,
  loadDisplayMode,
  loadEmergencyContact,
  loadFallDetectionEnabled,
  loadKeepAwake,
  loadUnitSystem,
  loadUseMils,
  loadVirtualWp,
  loadVoiceGuide,
  saveAppMode,
  saveBeaconEnabled,
  saveBeaconInterval,
  saveDeclination,
  saveDisplayMode,
  saveEmergencyContact,
  saveFallDetectionEnabled,
  saveKeepAwake,
  saveUnitSystem,
  saveUseMils,
  saveVirtualWp,
  saveVoiceGuide,
  type AppMode,
  type DisplayMode,
} from '../../services/preferencesService';
import {
  loadCalibration,
  type MagCalibration,
} from '../../services/calibrationService';
import { clearBeaconLastSent } from '../../services/preferencesService';
import { setKeepScreenOn } from '../../services/keepAwake';
import { setUnitSystem, type UnitSystem } from '../../utils/units';
import type { Declination } from '../../utils/declination';

export type PreferencesState = {
  /** A calibração magnética gravada (state: a interface precisa de rerender). */
  calibration: MagCalibration | null;
  /** O mesmo objeto, por ref: o sensor lê sem reabrir o magnetómetro. */
  calibrationRef: MutableRefObject<MagCalibration | null>;
  calibrated: boolean;
  declination: Declination;
  declinationRef: MutableRefObject<Declination>;
  appMode: AppMode;
  displayMode: DisplayMode;
  voiceGuide: boolean;
  useMils: boolean;
  unitSystem: UnitSystem;
  keepAwake: boolean;
  emergencyContact: string;
  beaconEnabled: boolean;
  beaconIntervalMinutes: number;
  fallDetection: boolean;
  virtualWpId: string | null;

  selectDisplayMode: (mode: DisplayMode) => void;
  selectAppMode: (mode: AppMode) => void;
  setDeclination: (decl: Declination) => void;
  toggleVoiceGuide: () => void;
  toggleMils: () => void;
  toggleUnitSystem: () => void;
  toggleKeepAwake: () => void;
  toggleBeacon: (enabled: boolean) => void;
  changeEmergencyContact: (contact: string) => void;
  changeBeaconInterval: (minutes: number) => void;
  toggleFallDetection: (enabled: boolean) => void;
  selectVirtualWp: (id: string | null) => void;
  saveCalibration: (cal: MagCalibration | null) => void;
  /** Relê do armazenamento — usado depois de restaurar um backup. */
  reload: () => Promise<void>;
};

/**
 * As preferências da app: calibração, declinação, unidades, o compasso
 * falado, o beacon, a detecção de queda e o marco virtual.
 *
 * Todas as escritas são "fire-and-forget": uma preferência que não se
 * gravou não pode travar o ecrã — e o erro é engolido de propósito, porque
 * não há nada a fazer com ele.
 */
export const usePreferences = (): PreferencesState => {
  const [calibration, setCalibration] = useState<MagCalibration | null>(null);
  const calibrationRef = useRef<MagCalibration | null>(null);
  const [calibrated, setCalibrated] = useState(false);
  const [declination, setDeclinationState] = useState<Declination>({
    enabled: false,
    degrees: 0,
  });
  const declinationRef = useRef(declination);
  const [appMode, setAppModeState] = useState<AppMode>('full');
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('compass');
  const [voiceGuide, setVoiceGuide] = useState(false);
  const [useMils, setUseMils] = useState(false);
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric');
  const [keepAwake, setKeepAwake] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [beaconEnabled, setBeaconEnabled] = useState(false);
  const [beaconIntervalMinutes, setBeaconIntervalMinutes] = useState(30);
  const [fallDetection, setFallDetection] = useState(false);
  const [virtualWpId, setVirtualWpId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    await Promise.all([
      loadAppMode().then(setAppModeState).catch(() => {}),
      loadDeclination()
        .then(decl => {
          declinationRef.current = decl;
          setDeclinationState(decl);
        })
        .catch(() => {}),
      loadVoiceGuide().then(setVoiceGuide).catch(() => {}),
      loadVirtualWp().then(setVirtualWpId).catch(() => {}),
      loadUseMils().then(setUseMils).catch(() => {}),
      loadUnitSystem()
        .then(units => {
          setUnitSystem(units);
          setUnitSystemState(units);
        })
        .catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    loadCalibration()
      .then(cal => {
        calibrationRef.current = cal;
        setCalibration(cal);
        setCalibrated(cal !== null);
      })
      .catch(() => {});
    loadDeclination()
      .then(decl => {
        declinationRef.current = decl;
        setDeclinationState(decl);
      })
      .catch(() => {});
    loadAppMode().then(setAppModeState).catch(() => {});
    loadDisplayMode().then(setDisplayModeState).catch(() => {});
    loadVoiceGuide().then(setVoiceGuide).catch(() => {});
    loadVirtualWp()
      .then(id => {
        setVirtualWpId(id);
      })
      .catch(() => {});
    loadUseMils().then(setUseMils).catch(() => {});
    loadUnitSystem()
      .then(units => {
        setUnitSystem(units);
        setUnitSystemState(units);
      })
      .catch(() => {});
    loadKeepAwake().then(setKeepAwake).catch(() => {});
    loadEmergencyContact().then(setEmergencyContact).catch(() => {});
    loadBeaconEnabled().then(setBeaconEnabled).catch(() => {});
    loadBeaconInterval().then(setBeaconIntervalMinutes).catch(() => {});
    loadFallDetectionEnabled().then(setFallDetection).catch(() => {});
  }, []);

  // Tela sempre acesa: aplica na janela da Activity sempre que o toggle (ou a
  // preferência carregada no arranque) mudar
  useEffect(() => {
    setKeepScreenOn(keepAwake);
  }, [keepAwake]);

  const selectDisplayMode = useCallback((mode: DisplayMode) => {
    setDisplayModeState(mode);
    saveDisplayMode(mode).catch(() => {});
  }, []);

  const selectAppMode = useCallback((mode: AppMode) => {
    setAppModeState(mode);
    saveAppMode(mode).catch(() => {});
  }, []);

  const setDeclination = useCallback((decl: Declination) => {
    declinationRef.current = decl;
    setDeclinationState(decl);
    saveDeclination(decl).catch(() => {});
  }, []);

  const toggleVoiceGuide = useCallback(() => {
    setVoiceGuide(prev => {
      const next = !prev;
      saveVoiceGuide(next).catch(() => {});
      return next;
    });
  }, []);

  const toggleMils = useCallback(() => {
    setUseMils(prev => {
      const next = !prev;
      saveUseMils(next).catch(() => {});
      return next;
    });
  }, []);

  const toggleUnitSystem = useCallback(() => {
    setUnitSystemState(prev => {
      const next: UnitSystem = prev === 'imperial' ? 'metric' : 'imperial';
      saveUnitSystem(next).catch(() => {});
      // aplica já na fonte: as formatações leem a escolha viva em `units.ts`
      setUnitSystem(next);
      return next;
    });
  }, []);

  const toggleKeepAwake = useCallback(() => {
    setKeepAwake(prev => {
      const next = !prev;
      saveKeepAwake(next).catch(() => {});
      return next;
    });
  }, []);

  const toggleBeacon = useCallback((enabled: boolean) => {
    setBeaconEnabled(enabled);
    saveBeaconEnabled(enabled).catch(() => {});
    // Ligar o beacon conta como pedir um aviso: o primeiro não espera o
    // intervalo inteiro.
    if (enabled) {
      clearBeaconLastSent().catch(() => {});
    }
  }, []);

  const changeEmergencyContact = useCallback((contact: string) => {
    setEmergencyContact(contact);
    saveEmergencyContact(contact).catch(() => {});
  }, []);

  const changeBeaconInterval = useCallback((minutes: number) => {
    setBeaconIntervalMinutes(minutes);
    saveBeaconInterval(minutes).catch(() => {});
  }, []);

  const toggleFallDetection = useCallback((enabled: boolean) => {
    setFallDetection(enabled);
    saveFallDetectionEnabled(enabled).catch(() => {});
  }, []);

  const selectVirtualWp = useCallback((id: string | null) => {
    setVirtualWpId(id);
    saveVirtualWp(id).catch(() => {});
  }, []);

  const saveCalibrationValue = useCallback((cal: MagCalibration | null) => {
    calibrationRef.current = cal;
    setCalibration(cal);
    setCalibrated(cal !== null);
  }, []);

  return {
    calibration,
    calibrationRef,
    calibrated,
    declination,
    declinationRef,
    appMode,
    displayMode,
    voiceGuide,
    useMils,
    unitSystem,
    keepAwake,
    emergencyContact,
    beaconEnabled,
    beaconIntervalMinutes,
    fallDetection,
    virtualWpId,
    selectDisplayMode,
    selectAppMode,
    setDeclination,
    toggleVoiceGuide,
    toggleMils,
    toggleUnitSystem,
    toggleKeepAwake,
    toggleBeacon,
    changeEmergencyContact,
    changeBeaconInterval,
    toggleFallDetection,
    selectVirtualWp,
    saveCalibration: saveCalibrationValue,
    reload,
  };
};
