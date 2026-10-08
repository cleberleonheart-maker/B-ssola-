import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_DECLINATION, type Declination } from '../utils/declination';

export type AppMode = 'full' | 'minimal' | 'adventure';
export type DisplayMode =
  | 'compass'
  | 'level'
  | 'ar'
  | 'camera'
  | 'metal'
  | 'theodolite'
  | 'emf'
  | 'sun'
  | 'wind'
  | 'track'
  | 'map'
  | 'notes'
  | 'height'
  | 'car'
  | 'tri'
  | 'odometer'
  | 'selftest'
  | 'cadence';

export type WindCal = { zero: number; strong: number };

const DECLINATION_KEY = '@bussola/declination';
const APP_MODE_KEY = '@bussola/appMode';
const DISPLAY_MODE_KEY = '@bussola/displayMode';
const VOICE_GUIDE_KEY = '@bussola/voiceGuide';
const WIND_CAL_KEY = '@bussola/windCal';
const VIRTUAL_WP_KEY = '@bussola/virtualWp';
const USE_MILS_KEY = '@bussola/useMils';
const CADENCE_BPM_KEY = '@bussola/cadenceBpm';
const CADENCE_MODE_KEY = '@bussola/cadenceMode';
const KEEP_AWAKE_KEY = '@bussola/keepAwake';

export const CADENCE_BPM = { min: 90, max: 160, step: 5, fallback: 120 } as const;

export type CadenceMode = 'timer' | 'step';

export const CADENCE_MODE = { fallback: 'timer' } as const;

export const clampBpm = (value: number) =>
  Math.min(
    CADENCE_BPM.max,
    Math.max(CADENCE_BPM.min, Math.round(value / CADENCE_BPM.step) * CADENCE_BPM.step),
  );

export const DEFAULT_WIND_CAL: WindCal = { zero: 0.015, strong: 0.22 };

export const loadDeclination = async (): Promise<Declination> => {
  try {
    const raw = await AsyncStorage.getItem(DECLINATION_KEY);
    if (!raw) return DEFAULT_DECLINATION;
    const parsed = JSON.parse(raw) as Partial<Declination>;
    return {
      enabled: parsed.enabled ?? DEFAULT_DECLINATION.enabled,
      degrees: Number(parsed.degrees ?? DEFAULT_DECLINATION.degrees),
    };
  } catch {
    return DEFAULT_DECLINATION;
  }
};

export const saveDeclination = async (decl: Declination) => {
  await AsyncStorage.setItem(DECLINATION_KEY, JSON.stringify(decl));
};

export const loadAppMode = async (): Promise<AppMode> => {
  try {
    const raw = await AsyncStorage.getItem(APP_MODE_KEY);
    return raw === 'minimal' || raw === 'adventure' ? raw : 'full';
  } catch {
    return 'full';
  }
};

export const saveAppMode = async (mode: AppMode) => {
  await AsyncStorage.setItem(APP_MODE_KEY, mode);
};

export const loadDisplayMode = async (): Promise<DisplayMode> => {
  try {
    const raw = await AsyncStorage.getItem(DISPLAY_MODE_KEY);
    const modes: DisplayMode[] = [
      'compass',
      'level',
      'ar',
      'camera',
      'metal',
      'theodolite',
      'emf',
      'sun',
      'wind',
      'track',
      'map',
      'notes',
      'height',
      'car',
      'tri',
      'odometer',
      'selftest',
      'cadence',
    ];
    return modes.includes(raw as DisplayMode) ? (raw as DisplayMode) : 'compass';
  } catch {
    return 'compass';
  }
};

export const saveDisplayMode = async (mode: DisplayMode) => {
  await AsyncStorage.setItem(DISPLAY_MODE_KEY, mode);
};

export const loadCadenceBpm = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(CADENCE_BPM_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampBpm(parsed) : CADENCE_BPM.fallback;
  } catch {
    return CADENCE_BPM.fallback;
  }
};

export const saveCadenceBpm = async (bpm: number) => {
  await AsyncStorage.setItem(CADENCE_BPM_KEY, String(clampBpm(bpm)));
};

export const loadCadenceMode = async (): Promise<CadenceMode> => {
  try {
    const raw = await AsyncStorage.getItem(CADENCE_MODE_KEY);
    return raw === 'step' || raw === 'timer' ? raw : CADENCE_MODE.fallback;
  } catch {
    return CADENCE_MODE.fallback;
  }
};

export const saveCadenceMode = async (mode: CadenceMode) => {
  await AsyncStorage.setItem(CADENCE_MODE_KEY, mode);
};

export const loadVoiceGuide = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(VOICE_GUIDE_KEY)) === '1';
  } catch {
    return false;
  }
};

export const saveVoiceGuide = async (enabled: boolean) => {
  await AsyncStorage.setItem(VOICE_GUIDE_KEY, enabled ? '1' : '0');
};

export const loadWindCal = async (): Promise<WindCal> => {
  try {
    const raw = await AsyncStorage.getItem(WIND_CAL_KEY);
    if (!raw) return DEFAULT_WIND_CAL;
    const parsed = JSON.parse(raw) as Partial<WindCal>;
    return {
      zero: Number(parsed.zero ?? DEFAULT_WIND_CAL.zero),
      strong: Number(parsed.strong ?? DEFAULT_WIND_CAL.strong),
    };
  } catch {
    return DEFAULT_WIND_CAL;
  }
};

export const saveWindCal = async (cal: WindCal) => {
  await AsyncStorage.setItem(WIND_CAL_KEY, JSON.stringify(cal));
};

export const loadVirtualWp = async (): Promise<string | null> => {
  try {
    const raw = await AsyncStorage.getItem(VIRTUAL_WP_KEY);
    return raw || null;
  } catch {
    return null;
  }
};

export const saveVirtualWp = async (id: string | null) => {
  if (id == null) {
    await AsyncStorage.removeItem(VIRTUAL_WP_KEY);
  } else {
    await AsyncStorage.setItem(VIRTUAL_WP_KEY, id);
  }
};

export const loadUseMils = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(USE_MILS_KEY)) === '1';
  } catch {
    return false;
  }
};

export const saveUseMils = async (enabled: boolean) => {
  await AsyncStorage.setItem(USE_MILS_KEY, enabled ? '1' : '0');
};

export const loadKeepAwake = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(KEEP_AWAKE_KEY)) === '1';
  } catch {
    return false;
  }
};

export const saveKeepAwake = async (enabled: boolean) => {
  await AsyncStorage.setItem(KEEP_AWAKE_KEY, enabled ? '1' : '0');
};

const LIVE_DURATION_KEY = '@bussola/liveDuration';

/**
 * Opções de duração do rastreio ao vivo, em minutos.
 *
 * O rastreio era fixo em 30 min. Uma trilha longa precisa de mais, e um recado
 * rápido não precisa de manter a posição exposta meia hora. O mínimo é o que
 * `startLiveShare` já aceita (`Math.max(5, minutes)`).
 */
export const LIVE_DURATION_OPTIONS = [15, 30, 60, 120] as const;
export type LiveDuration = (typeof LIVE_DURATION_OPTIONS)[number];
export const DEFAULT_LIVE_DURATION: LiveDuration = 30;

const isLiveDuration = (v: number): v is LiveDuration =>
  (LIVE_DURATION_OPTIONS as readonly number[]).includes(v);

export const loadLiveDuration = async (): Promise<LiveDuration> => {
  try {
    const raw = Number(await AsyncStorage.getItem(LIVE_DURATION_KEY));
    return isLiveDuration(raw) ? raw : DEFAULT_LIVE_DURATION;
  } catch {
    return DEFAULT_LIVE_DURATION;
  }
};

export const saveLiveDuration = async (minutes: LiveDuration) => {
  await AsyncStorage.setItem(LIVE_DURATION_KEY, String(minutes));
};

const LOCK_PIN_KEY = '@bussola/lockPin';

export const loadLockPin = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(LOCK_PIN_KEY);
  } catch {
    return null;
  }
};

export const saveLockPin = async (pin: string) => {
  await AsyncStorage.setItem(LOCK_PIN_KEY, pin);
};

export const clearLockPin = async () => {
  await AsyncStorage.removeItem(LOCK_PIN_KEY);
};