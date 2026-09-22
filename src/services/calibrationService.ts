import AsyncStorage from '@react-native-async-storage/async-storage';

export type Vector3 = { x: number; y: number; z: number };

export type MagCalibration = {
  offsets: Vector3;
  scales: Vector3;
  samples: number;
};

const STORAGE_KEY = '@bussola/magCal';

export type Collector = {
  min: Vector3;
  max: Vector3;
  count: number;
  push: (v: Vector3) => void;
  range: () => Vector3;
  coverage: (reference: number) => number;
};

export const createCollector = (): Collector => {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  let count = 0;

  const range = () => ({
    x: Math.max(max.x - min.x, 0),
    y: Math.max(max.y - min.y, 0),
    z: Math.max(max.z - min.z, 0),
  });

  return {
    min,
    max,
    get count() {
      return count;
    },
    push(v) {
      count += 1;
      if (v.x < min.x) min.x = v.x;
      if (v.y < min.y) min.y = v.y;
      if (v.z < min.z) min.z = v.z;
      if (v.x > max.x) max.x = v.x;
      if (v.y > max.y) max.y = v.y;
      if (v.z > max.z) max.z = v.z;
    },
    range,
    coverage(reference) {
      const r = range();
      const total =
        (Math.min(r.x, reference) +
          Math.min(r.y, reference) +
          Math.min(r.z, reference)) /
        (3 * reference);
      return Math.min(1, Math.max(0, total));
    },
  };
};

export const computeCalibration = (c: Collector): MagCalibration => {
  const r = c.range();
  const base = Math.max(r.x, r.y, r.z);
  if (base <= 1e-9) {
    return {
      offsets: { x: 0, y: 0, z: 0 },
      scales: { x: 1, y: 1, z: 1 },
      samples: c.count,
    };
  }
  return {
    offsets: {
      x: (c.max.x + c.min.x) / 2,
      y: (c.max.y + c.min.y) / 2,
      z: (c.max.z + c.min.z) / 2,
    },
    scales: {
      x: r.x > 1e-9 ? base / r.x : 1,
      y: r.y > 1e-9 ? base / r.y : 1,
      z: r.z > 1e-9 ? base / r.z : 1,
    },
    samples: c.count,
  };
};

export const applyCalibration = (
  raw: Vector3,
  cal: MagCalibration | null,
): Vector3 => {
  if (!cal) return raw;
  return {
    x: (raw.x - cal.offsets.x) * cal.scales.x,
    y: (raw.y - cal.offsets.y) * cal.scales.y,
    z: (raw.z - cal.offsets.z) * cal.scales.z,
  };
};

export const saveCalibration = async (cal: MagCalibration) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cal));
};

export const loadCalibration = async (): Promise<MagCalibration | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MagCalibration) : null;
  } catch {
    return null;
  }
};

export const resetCalibration = async () => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};