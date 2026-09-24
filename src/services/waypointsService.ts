import AsyncStorage from '@react-native-async-storage/async-storage';

export type Waypoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  createdAt: number;
};

const STORAGE_KEY = '@bussola/waypoints';

export const loadWaypoints = async (): Promise<Waypoint[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Waypoint[]) : [];
  } catch {
    return [];
  }
};

export const saveWaypoint = async (wp: Waypoint) => {
  const list = await loadWaypoints();
  const next = [...list, wp];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const removeWaypoint = async (id: string) => {
  const list = await loadWaypoints();
  const next = list.filter(w => w.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const replaceWaypoints = async (list: Waypoint[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
};

export const createWaypointId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;