import AsyncStorage from '@react-native-async-storage/async-storage';

export type CarSpot = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  parkedAt: number;
};

const STORAGE_KEY = '@bussola/carSpot';

export const carSpotService = {
  async load(): Promise<CarSpot | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CarSpot;
      if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  },
  async save(spot: CarSpot): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(spot));
    } catch {
      // ignore
    }
  },
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};