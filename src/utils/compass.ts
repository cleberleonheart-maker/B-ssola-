export type Vector3 = { x: number; y: number; z: number };

export const normalizeHeading = (deg: number) => {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
};

export const MILS_PER_DEG = 6400 / 360;

/**
 * Formata um azimute em graus (000°–360°) ou milésimos militares
 * ("mils", 6400 no círculo completo).
 */
export const formatAzimuth = (deg: number | null, useMils: boolean): string => {
  if (deg == null || !Number.isFinite(deg)) return '—';
  const value = Math.round(normalizeHeading(deg));
  if (useMils) {
    return `${Math.round(value * MILS_PER_DEG)
      .toString()
      .padStart(4, '0')} mil`;
  }
  return `${value.toString().padStart(3, '0')}°`;
};

/**
 * Heading (azimute) com compensação de inclinação, em graus (0-360).
 * Usa acelerômetro para estimar pitch/roll e corrige o magnetômetro.
 */
export const getHeading = (
  accel: Vector3,
  mag: Vector3,
): number | null => {
  const aNorm = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
  if (aNorm === 0) return null;

  const ax = accel.x / aNorm;
  const ay = accel.y / aNorm;
  const az = accel.z / aNorm;

  const mNorm = Math.sqrt(mag.x ** 2 + mag.y ** 2 + mag.z ** 2);
  if (mNorm < 1e-6) return null;

  const mx = mag.x / mNorm;
  const my = mag.y / mNorm;
  const mz = mag.z / mNorm;

  const pitch = Math.atan2(-ax, Math.sqrt(ay ** 2 + az ** 2));
  const roll = Math.atan2(ay, az);

  const xh = mx * Math.cos(pitch) + mz * Math.sin(pitch);
  const yh =
    mx * Math.sin(roll) * Math.sin(pitch) +
    my * Math.cos(roll) -
    mz * Math.sin(roll) * Math.cos(pitch);

  return normalizeHeading((Math.atan2(-xh, yh) * 180) / Math.PI);
};

export const DIRECTIONS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'] as const;
export const DIRECTION_NAMES = [
  'Norte',
  'Nordeste',
  'Leste',
  'Sudeste',
  'Sul',
  'Sudoeste',
  'Oeste',
  'Noroeste',
] as const;

export const cardinalOf = (heading: number) => {
  const normalized = normalizeHeading(heading);
  const index = Math.round(normalized / 45) % 8;
  return {
    short: DIRECTIONS[index],
    full: DIRECTION_NAMES[index],
  };
};

export const formatCoord = (value: number, isLat: boolean) => {
  const abs = Math.abs(value).toFixed(6);
  const hemi = isLat
    ? value >= 0
      ? 'N'
      : 'S'
    : value >= 0
    ? 'E'
    : 'W';
  return `${abs} ${hemi}`;
};

export const formatTime = (ts: number) => {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};