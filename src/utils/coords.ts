import { Linking } from 'react-native';
import { toRad } from './geo';

export const toDMS = (value: number, isLat: boolean): string => {
  const hemi = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  // A conta é feita em décimos de segundo, de uma vez só. Antes era em
  // segundos (com uma casa) e o arredondamento do `toFixed` produzia
  // "59'60.0\"" — uma coordenada que não existe, e que quem copia para o
  // mapa não percebe. Em décimos, o acerto do minuto e do grau acontece
  // sempre, porque é a mesma divisão.
  const decimos = Math.round((abs - deg) * 60 * 600);
  let min = Math.floor(decimos / 600);
  let degFinal = deg;
  if (min >= 60) {
    degFinal += 1;
    min -= 60;
  }
  const resto = decimos % 600;
  const seg = Math.floor(resto / 10);
  const decima = resto % 10;
  const segTexto = decima > 0 ? `${seg}.${decima}` : `${seg}`;
  return `${degFinal}°${String(min).padStart(2, '0')}'${segTexto}" ${hemi}`;
};

const UTM_HEMI = 'CDEFGHJKLMNPQRSTUVWX';

export type UTM = {
  zone: number;
  letter: string;
  easting: number;
  northing: number;
};

export const toUTM = (lat: number, lon: number): UTM | null => {
  if (lat < -80 || lat > 84) {
    return null;
  }
  const a = 6378137;
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const zone = Math.floor((lon + 180) / 6) + 1;
  const lonOrigin = toRad((zone - 1) * 6 - 180 + 3);
  const latR = toRad(lat);
  const k0 = 0.9996;
  const e2Sq = e2 / (1 - e2);
  const N = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2);
  const T = Math.tan(latR) ** 2;
  const C = e2Sq * Math.cos(latR) ** 2;
  const A = Math.cos(latR) * (toRad(lon) - lonOrigin);
  const M =
    a *
    ((1 -
      e2 / 4 -
      (3 * e2 ** 2) / 64 -
      (5 * e2 ** 3) / 256) *
      latR -
      ((3 * e2) / 8 +
        (3 * e2 ** 2) / 32 +
        (45 * e2 ** 3) / 1024) *
        Math.sin(2 * latR) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) *
        Math.sin(4 * latR) -
      (35 * e2 ** 3) / 3072 * Math.sin(6 * latR));
  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * e2Sq) * A ** 5) / 120) +
    500000;
  const northing =
    k0 *
    (M +
      N *
        Math.tan(latR) *
        (A ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * e2Sq) * A ** 6) / 720));
  // Hemisfério sul: a northing tem uma falsa origem de 10 000 000 m, para
  // que nenhum ponto do mapa fique com coordenada negativa. Sem isto, São
  // Paulo saía em 23K −2 605 412 N em vez de 23K 7 394 588 N — um erro de
  // 10 000 km que o mapa não complainava.
  const northingFinal = lat < 0 ? 10000000 + northing : northing;
  return {
    zone,
    letter: UTM_HEMI[Math.floor((lat + 80) / 8)] ?? 'X',
    easting: Math.round(easting * 100) / 100,
    northing: Math.round(northingFinal * 100) / 100,
  };
};

export const formatUTM = (utm: UTM): string =>
  `${utm.zone}${utm.letter} ${utm.easting.toFixed(0)} ${utm.northing.toFixed(0)}`;

export const googleMapsUrl = (lat: number, lon: number): string =>
  `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;

export const wazeUrl = (lat: number, lon: number): string =>
  `https://waze.com/ul?ll=${lat.toFixed(6)},${lon.toFixed(6)}&navigate=yes`;

export const openLink = (url: string): void => {
  Linking.openURL(url).catch(() => {});
};