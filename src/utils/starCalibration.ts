import {
  crossCentrePosition,
  polarisPosition,
  solarPosition,
  starPosition,
  type CelestialPoint,
} from './astro';
import { BRIGHT_STARS, CRUX_CENTRE, POLARIS_STAR } from './starCatalog';

/**
 * Calibração da declinação por uma estrela do céu (ideia #13).
 *
 * A ideia era apontar a câmara à Polaris, que está junto ao polo celeste
 * norte: a sua altura é a latitude e o seu azimute é o norte verdadeiro. Mas
 * a Polaris só se vê a norte do equador — no Brasil ela está uns 23° abaixo
 * do horizonte — por isso a calibração passou a aceitar qualquer estrela
 * brilhante: o que interessa é o *azimute verdadeiro* dela, e isso o
 * catálogo dá com precisão de segundos de arco.
 *
 * O que decide a qualidade do alvo é a geometria do telefone: em retrato, o
 * `heading` da app é o azimute do eixo da câmara (o `-Z` do sensor) e a
 * inclinação desse eixo é `viewElevationDeg`. Uma estrela demasiado alta
 * exigiria um telefone tombado mais de 45°, e a partir daí a compensação de
 * inclinação do `getHeading` deixa de dar o azimute da câmara (passa a dar
 * o do topo do ecrã, 90° ao lado). Uma estrela demasiado baixa, perto do
 * horizonte, sofre da refração e da falta de luz. Por isso o alvo ideal está
 * algures entre 10° e 40° de altura.
 */

/** Tolerâncias da mira, em graus. */
export const STAR_AZIMUTH_TOLERANCE = 3;
export const STAR_ELEVATION_TOLERANCE = 6;

/** Acima desta altura o telefone já não lê bem o azimute da câmara. */
export const TARGET_MAX_ELEVATION = 44;
/** Abaixo desta altura a estrela está a afogar-se no horizonte. */
export const TARGET_MIN_ELEVATION = 4;
/** A altura que o telefone lê melhor. */
export const TARGET_IDEAL_ELEVATION = 25;

export type CalibrationTarget = {
  id: string;
  /** Nome próprio da estrela — o mesmo nos três idiomas. */
  name: string;
  /**
   * Chave de tradução, quando o alvo não é uma estrela com nome próprio (o
   * centro da Cruz do Sul). Os nomes de estrela são iguais em pt/en/es.
   */
  labelKey?: string;
  /** Onde está a estrela agora. */
  position: CelestialPoint;
  /** O telefone consegue ler bem o azimute a esta altura? */
  usable: boolean;
  /** Quanto o alvo é bom, para os ordenar (maior = melhor). */
  score: number;
  /** Magnitude, quando a estrela é uma do catálogo. */
  magnitude: number | null;
};

export type StarAim = {
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
 * câmara; `target` é a estrela escolhida.
 */
export const starAim = (
  viewAzimuth: number,
  viewElevation: number,
  target: CelestialPoint,
): StarAim => {
  const azimuthError = angleDelta(viewAzimuth, target.azimuth);
  const elevationError = target.elevation - viewElevation;
  return {
    azimuthError,
    elevationError,
    onTarget:
      Math.abs(azimuthError) <= STAR_AZIMUTH_TOLERANCE &&
      Math.abs(elevationError) <= STAR_ELEVATION_TOLERANCE,
  };
};

/**
 * A declinação vista pela estrela: o azimute verdadeiro da estrela menos o
 * azimute magnético que o telefone lê enquanto aponta para ela.
 *
 * A convenção é a da app (leste positivo): `verdadeiro = magnético + decl`.
 * Em São Paulo, por exemplo, o norte magnético está a leste do verdadeiro, a
 * declinação dá negativa, e o resultado bate com a tabela.
 */
export const declinationFromStar = (
  starAzimuth: number,
  magneticHeading: number,
): number => {
  const delta = angleDelta(magneticHeading, starAzimuth);
  return Math.round(delta * 10) / 10;
};

/** Quão boa é a altura da estrela para a leitura do telefone. */
const elevationScore = (elevation: number) =>
  Math.max(0, 100 - Math.abs(elevation - TARGET_IDEAL_ELEVATION) * 2.5);

const buildTarget = (
  id: string,
  name: string,
  labelKey: string | undefined,
  position: CelestialPoint,
  magnitude: number | null,
): CalibrationTarget => {
  const usable =
    position.elevation >= TARGET_MIN_ELEVATION &&
    position.elevation <= TARGET_MAX_ELEVATION;
  return {
    id,
    name,
    labelKey,
    position,
    usable,
    score: elevationScore(position.elevation) - (magnitude ?? 2) * 8,
    magnitude,
  };
};

/**
 * As estrelas que estão no horizonte agora, ordenadas da melhor para a
 * pior para o telefone.
 *
 * Os alvos especiais — a Polaris (norte) e o centro da Cruz do Sul (sul) —
 * entram na lista como mais uma opção: são os mais fáceis de reconhecer no
 * céu, mesmo quando a sua posição não é a ideal para a leitura do azimute.
 */
export const calibrationTargets = (
  date: Date,
  latitude: number,
  longitude: number,
): CalibrationTarget[] => {
  const targets: CalibrationTarget[] = [];

  const polaris = polarisPosition(date, latitude, longitude);
  if (polaris.elevation > 0) {
    targets.push(
      buildTarget(POLARIS_STAR.id, POLARIS_STAR.name, undefined, polaris, POLARIS_STAR.magnitude),
    );
  }

  const cross = crossCentrePosition(date, latitude, longitude);
  if (cross.elevation > 0) {
    targets.push(
      buildTarget(CRUX_CENTRE.id, CRUX_CENTRE.name, 'cal_target_cross', cross, CRUX_CENTRE.magnitude),
    );
  }

  for (const star of BRIGHT_STARS) {
    const position = starPosition(
      { rightAscension: star.ra, declination: star.dec },
      date,
      latitude,
      longitude,
    );
    if (position.elevation <= 0) continue;
    targets.push(buildTarget(star.id, star.name, undefined, position, star.magnitude));
  }

  return targets.sort((a, b) => b.score - a.score);
};

/** A estrela mais bem colocada agora, ou null se nenhuma estiver no horizonte. */
export const bestTarget = (
  targets: CalibrationTarget[],
): CalibrationTarget | null => targets.find(t => t.usable) ?? targets[0] ?? null;

/**
 * Está de dia? As estrelas estão no céu, mas não se veem — vale avisar para
 * não se perder tempo à procura da Polaris em pleno sol.
 */
export const isDaytime = (date: Date, latitude: number, longitude: number): boolean =>
  solarPosition(date, latitude, longitude).elevation > -6;
