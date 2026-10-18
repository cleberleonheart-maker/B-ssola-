const R = 6371000;

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

export const normalizeAzimuth = (deg: number) => {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
};

/**
 * Há posição real? `(0, 0)` é o "null island" — o valor inicial antes do
 * primeiro fix — e nunca é um sítio onde o usuário esteja. Definição única:
 * antes existiam variantes que incluíam `provider`, e a tela principal dizia
 * "tem fix" enquanto os componentes filhos (trilha, SOS, mapa) diziam o
 * contrário para a mesma localização.
 */
export const hasLocationFix = (loc: {
  latitude: number;
  longitude: number;
}): boolean => loc.latitude !== 0 || loc.longitude !== 0;

export const haversine = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};

export const initialBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return normalizeAzimuth(toDeg(Math.atan2(y, x)));
};

// A formatação de distância passa a viver em `units.ts` (ideia #68), que a torna
// sensível ao sistema de unidades (métrico/imperial). Segue reexportada daqui
// para não mexer nos muitos sítios que já a importam de `utils/geo`.
export { formatDistance } from './units';

/**
 * Elevação de um alvo acima do horizonte, em graus, dado o desnível e a
 * distância horizontal (a do haversine, que já é a cateta oposta). Positivo =
 * alvo acima de quem observa. `null` quando a distância não permite ângulo.
 */
export const elevationAngle = (
  deltaAltitude: number,
  horizontalDistance: number,
): number | null => {
  if (!Number.isFinite(deltaAltitude) || !Number.isFinite(horizontalDistance)) {
    return null;
  }
  if (!(horizontalDistance > 0)) {
    return null;
  }
  const degrees = (Math.atan2(deltaAltitude, horizontalDistance) * 180) / Math.PI;
  return Number.isFinite(degrees) ? degrees : null;
};