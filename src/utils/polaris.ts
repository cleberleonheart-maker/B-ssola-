import { normalizeHeading } from './compass';
import type { CelestialPoint } from './astro';

/**
 * Calibração da bússola pela Estrela Polar (ideia #13).
 *
 * A Polaris está a menos de meio grau do polo celeste: a sua altura sobre o
 * horizonte é a latitude de quem olha, e o seu azimute é o norte verdadeiro.
 * Apontar a câmara do telefone a Polaris é, portanto, apontar ao norte
 * geográfico — e a diferença entre o rumo que o magnetómetro lê e o azimute
 * verdadeiro da estrela é a declinação, medida no sitio em vez de tirada de
 * uma tabela de cidades.
 *
 * O que decide é a geometria do telefone: em retrato, o `heading` da app é o
 * azimute do eixo da câmara (o `-Z` do sensor), e a inclinação desse eixo é
 * `viewElevationDeg`. Por isso a mira só faz sentido com o telefone na
 * vertical, retrato, apontado à estrela.
 */

/** Tolerâncias da mira, em graus. */
export const POLARIS_AZIMUTH_TOLERANCE = 3;
export const POLARIS_ELEVATION_TOLERANCE = 6;

/**
 * Acima desta latitude a estrela está tão alta que o telefone teria de ficar
 * tombado mais de 45°, e a partir daí a compensação de inclinação do
 * `getHeading` deixa de dar o azimute da câmara (passa a dar o do topo do
 * ecrã, 90° ao lado). A partir daí a mira não é fiável, e vale mais dizer isso
 * do que dar um número errado.
 */
export const POLARIS_MAX_LATITUDE = 44;

export type PolarisAim = {
  /** Quanto falta virar, em graus (positivo = para a direita). */
  azimuthError: number;
  /** Quanto falta levantar o telefone, em graus (positivo = subir). */
  elevationError: number;
  /** A mira está em cima da estrela? */
  onTarget: boolean;
};

/** Diferença com sinal entre dois azimutes, em [-180, 180]. */
export const angleDelta = (from: number, to: number): number => {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
};

/**
 * Onde está a estrela em relação ao que o telefone está a apontar.
 *
 * `viewAzimuth` e `viewElevation` são o azimute e a elevação do eixo da
 * câmara; `polaris` é a posição da estrela.
 */
export const polarisAim = (
  viewAzimuth: number,
  viewElevation: number,
  polaris: CelestialPoint,
): PolarisAim => {
  const azimuthError = angleDelta(viewAzimuth, polaris.azimuth);
  const elevationError = polaris.elevation - viewElevation;
  return {
    azimuthError,
    elevationError,
    onTarget:
      Math.abs(azimuthError) <= POLARIS_AZIMUTH_TOLERANCE &&
      Math.abs(elevationError) <= POLARIS_ELEVATION_TOLERANCE,
  };
};

/**
 * A declinação vista pela estrela: o azimute verdadeiro da Polaris menos o
 * azimute magnético que o telefone lê enquanto aponta para ela.
 *
 * A convenção é a da app (leste positivo): `verdadeiro = magnético + decl`.
 * Em São Paulo, por exemplo, o norte magnético está a leste do verdadeiro, a
 * declinação dá negativa, e o resultado bate com a tabela.
 */
export const declinationFromPolaris = (
  polarisAzimuth: number,
  magneticHeading: number,
): number => {
  const delta = angleDelta(magneticHeading, polarisAzimuth);
  return Math.round(delta * 10) / 10;
};

/** A latitude permite esta calibração? */
export const polarisUsable = (latitude: number): boolean =>
  Number.isFinite(latitude) && Math.abs(latitude) <= POLARIS_MAX_LATITUDE;

/**
 * O azimute da estrela no referencial magnético, para comparar com o que o
 * ecrã mostra (a app mostra o heading já com a declinação aplicada quando
 * ela está ligada).
 */
export const expectedMagneticHeading = (
  polarisAzimuth: number,
  declinationEnabled: boolean,
  declinationDegrees: number,
): number =>
  normalizeHeading(
    polarisAzimuth - (declinationEnabled ? declinationDegrees : 0),
  );
