/**
 * Sistema de unidades (ideia #68).
 *
 * O app mede e guarda tudo em unidades do SI (metros, m/s, °C): as conversões
 * acontecem só na hora de mostrar, para não espalhar fatores de conversão pelos
 * cálculos. `current` é a escolha viva do usuário — carregada do disco no
 * arranque em `CompassScreen` — e os formatadores leem-na por omissão, o que
 * torna todos os painéis coerentes sem ter de passar a preferência por dezenas
 * de call sites. Ainda assim as funções aceitam um `units` explícito, que é o
 * que os testes usam para não dependerem de estado global.
 */

export type UnitSystem = 'metric' | 'imperial';

const METERS_PER_FOOT = 0.3048;
const METERS_PER_MILE = 1609.344;
const MPS_TO_KMH = 3.6;
const MPS_TO_MPH = 2.2369362920544;

let current: UnitSystem = 'metric';

export const setUnitSystem = (units: UnitSystem): void => {
  current = units === 'imperial' ? 'imperial' : 'metric';
};

export const getUnitSystem = (): UnitSystem => current;

export const metersToFeet = (meters: number): number => meters / METERS_PER_FOOT;
export const metersToMiles = (meters: number): number => meters / METERS_PER_MILE;

/**
 * Distância para leitura de navegação. Métrico mantém o formato de sempre
 * (metro/casa decimal, km com duas). Imperial usa pés abaixo de 0,1 mi e
 * milhas a partir daí — o ponto em que "525 pés" começa a ser mais difícil de
 * ler do que "0,10 mi".
 */
export const formatDistance = (meters: number, units: UnitSystem = current): string => {
  if (units === 'imperial') {
    const miles = metersToMiles(meters);
    if (miles >= 0.1) return `${miles.toFixed(2)} mi`;
    return `${Math.round(metersToFeet(meters))} ft`;
  }
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  if (meters >= 100) return `${Math.round(meters)} m`;
  return `${meters.toFixed(1)} m`;
};

/** Altitude/elevação arredondada, sem unidade (para layouts que estilizam à parte). */
export const altitudeValue = (meters: number, units: UnitSystem = current): string =>
  units === 'imperial'
    ? `${Math.round(metersToFeet(meters))}`
    : `${Math.round(meters)}`;

export const altitudeUnit = (units: UnitSystem = current): string =>
  units === 'imperial' ? 'ft' : 'm';

export const formatAltitude = (meters: number, units: UnitSystem = current): string =>
  `${altitudeValue(meters, units)} ${altitudeUnit(units)}`;

/** Velocidade do GPS. */
export const formatSpeed = (mps: number, units: UnitSystem = current): string =>
  units === 'imperial'
    ? `${(mps * MPS_TO_MPH).toFixed(1)} mph`
    : `${(mps * MPS_TO_KMH).toFixed(1)} km/h`;

/**
 * Precisão do GPS. Em métrico mantém o inteiro seco ("12 m"); em imperial vira
 * pés pelo mesmo arredondamento, para o painel continuar a caber no mesmo sítio.
 */
export const formatAccuracy = (meters: number, units: UnitSystem = current): string =>
  units === 'imperial'
    ? `${Math.round(metersToFeet(meters))} ft`
    : `${Math.round(meters)} m`;
