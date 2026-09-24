import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@bussola/odometerDaily';

type DayMap = Record<string, number>;

export type DayTotal = { day: string; meters: number };

export const dayKey = (at: number): string => {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

let cache: DayMap | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingDirty = false;

const loadCache = async (): Promise<DayMap> => {
  if (cache) {
    return cache;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as DayMap) : {};
    cache = {};
    for (const key of Object.keys(parsed)) {
      const value = parsed[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        cache[key] = value;
      }
    }
  } catch {
    cache = {};
  }
  return cache;
};

const persist = async (): Promise<void> => {
  pendingDirty = false;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!cache) {
    return;
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
};

const schedulePersist = (): void => {
  pendingDirty = true;
  if (persistTimer) {
    return;
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persist().catch(() => {});
  }, 1500);
};

/** Acumula metros percorridos no dia atual (persistência com debounce). */
export const addDistance = async (meters: number): Promise<void> => {
  if (!Number.isFinite(meters) || meters <= 0) {
    return;
  }
  const map = await loadCache();
  const key = dayKey(Date.now());
  map[key] = (map[key] ?? 0) + meters;
  schedulePersist();
};

export const flushOdometer = async (): Promise<void> => {
  if (pendingDirty) {
    await persist();
  }
};

export const getTotals = async (): Promise<{
  today: number;
  week: number;
  lastDays: DayTotal[];
}> => {
  const map = await loadCache();
  const now = new Date();
  const todayKey = dayKey(now.getTime());
  const today = map[todayKey] ?? 0;

  let week = 0;
  const start = new Date(now);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  const startKey = dayKey(start.getTime());
  for (const key of Object.keys(map)) {
    if (key >= startKey) {
      week += map[key];
    }
  }

  const lastDays: DayTotal[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    lastDays.push({ day: dayKey(d.getTime()), meters: map[dayKey(d.getTime())] ?? 0 });
  }
  return { today, week, lastDays };
};

/** Substitui o mapa diário (usado na restauração de backup). */
export const setTotals = async (map: DayMap): Promise<void> => {
  cache = {};
  for (const key of Object.keys(map)) {
    const value = map[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      cache[key] = Math.round(value);
    }
  }
  await persist();
};