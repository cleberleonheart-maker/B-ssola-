import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'bussola.fov.v1';

export const DEFAULT_FOV = 110;
export const FOV_MIN = 60;
export const FOV_MAX = 140;
export const FOV_STEP = 10;

const clamp = (value: number): number =>
  Math.min(FOV_MAX, Math.max(FOV_MIN, value));

export const loadFov = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= FOV_MIN && parsed <= FOV_MAX) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_FOV;
};

export const saveFov = async (fov: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(clamp(fov)));
  } catch {
    // ignore
  }
};

export const adjustFov = (current: number, delta: number): number =>
  clamp(current + delta);