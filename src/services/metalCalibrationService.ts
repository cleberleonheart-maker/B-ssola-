import AsyncStorage from '@react-native-async-storage/async-storage';

export type MetalCalibration = {
  baseline: number;
  savedAt: number;
};

const STORAGE_KEY = '@bussola/metal_cal';

export const loadMetalCalibration = async (): Promise<MetalCalibration | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MetalCalibration;
    if (typeof parsed.baseline !== 'number' || parsed.baseline <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveMetalCalibration = async (
  cal: MetalCalibration,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cal));
  } catch {
    // persistência é best-effort
  }
};

export const clearMetalCalibration = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};