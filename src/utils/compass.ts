export type Vector3 = { x: number; y: number; z: number };

export const normalizeHeading = (deg: number) => {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
};

/** Normaliza para o intervalo -180..180. Usado para desvios de rumo. */
export const wrap180 = (deg: number) => {
  let v = deg % 360;
  if (v > 180) v -= 360;
  if (v < -180) v += 360;
  return v;
};

export const MILS_PER_DEG = 6400 / 360;

/**
 * Média de azimutes. Azimute é circular: 350° e 10° ficam a 20° um do outro,
 * não a 180°, então a média aritmética vira exatamente o oposto do esperado.
 */
export const circularMeanHeading = (values: number[]): number => {
  let sin = 0;
  let cos = 0;
  let count = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const rad = (value * Math.PI) / 180;
    sin += Math.sin(rad);
    cos += Math.cos(rad);
    count += 1;
  }
  if (count === 0 || (sin === 0 && cos === 0)) return 0;
  return normalizeHeading((Math.atan2(sin, cos) * 180) / Math.PI);
};

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

/**
 * Inclinação do aparelho em graus, a partir do acelerômetro.
 *
 * Convenções (retrato, eixo X p/ a direita, Y p/ o topo da tela, Z para fora
 * da tela): `pitch` é a rotação em torno de X (positivo = topo para cima) e
 * `roll` a rotação em torno de Y (positivo = lado direito para baixo). Em
 * repouso sobre a mesa os dois dão 0; num aparelho deitado de lado, o roll
 * fica em ±90.
 *
 * Como `verticalAngle` (HeightView), não divide por G: `asin` de um componente
 * já normalizado recebe o mesmo resultado com m/s² (Android) ou g (iOS).
 *
 * Em paisagem os rótulos trocam de lugar (o que chamamos de pitch passa a ser
 * o roll físico). O nível é uma leitura de bolha — o valor é o que importa, e
 * a orientação continua a ser a do aparelho, não a do usuário.
 */
export const pitchRollDeg = (accel: Vector3): { pitch: number; roll: number } => {
  const { x, y, z } = accel;
  if (![x, y, z].every(Number.isFinite)) {
    return { pitch: 0, roll: 0 };
  }
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (!(mag > 0)) {
    return { pitch: 0, roll: 0 };
  }
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const pitch = (Math.asin(clamp(y / mag)) * 180) / Math.PI;
  const roll = (Math.asin(clamp(-x / mag)) * 180) / Math.PI;
  return { pitch: Number.isFinite(pitch) ? pitch : 0, roll: Number.isFinite(roll) ? roll : 0 };
};

/**
 * Elevação do eixo da câmera (lado de trás) acima do horizonte, em graus.
 *
 * A câmera traseira olha ao longo de −Z (o Z do sensor sai pela tela), então a
 * componente vertical do eixo de visão é −z/|a| e a elevação é o arcseno dela.
 * Com o aparelho de bruços na mesa o eixo aponta para baixo: −90°. Retido na
 * vertical, z ≈ 0: 0°, o horizonte. De costas para o chão: +90°.
 *
 * O sinal desta leitura é o único ancorado num facto que não depende da
 * convenção de eixos em disputa (ideias #64/#65): com a tela para cima o
 * Android entrega z > 0 — é o mesmo pressuposto do fixture `restMS` dos testes
 * de `verticalAngle`. Não usa Y, portanto é a mesma em retrato e em paisagem.
 */
export const viewElevationDeg = (accel: Vector3): number => {
  const { x, y, z } = accel;
  if (![x, y, z].every(Number.isFinite)) {
    return 0;
  }
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (!(mag > 0)) {
    return 0;
  }
  const value = (Math.asin(Math.max(-1, Math.min(1, -z / mag))) * 180) / Math.PI;
  return Number.isFinite(value) ? value : 0;
};

/**
 * FOV vertical, derivado do horizontal calibrado pelo utilizador e da forma do
 * ecrã: a pré-visualização cobre o contentor (`resizeMode="cover"`), então o
 * ângulo que sobra em cima/baixo depende da razão altura/largura. Sem ecrã
 * medido devolve uma estimativa de 60% do horizontal — melhor que apanhar
 * `Infinity` no primeiro render.
 */
export const verticalFovDeg = (horizontalFovDeg: number, width: number, height: number): number => {
  const horizontal =
    Number.isFinite(horizontalFovDeg) && horizontalFovDeg > 1 && horizontalFovDeg < 179
      ? horizontalFovDeg
      : 90;
  const estimate = horizontal * 0.6;
  if (!(width > 0) || !(height > 0)) {
    return estimate;
  }
  const half = ((horizontal * Math.PI) / 180) / 2;
  const vertical = (2 * Math.atan(Math.tan(half) * (height / width)) * 180) / Math.PI;
  return Number.isFinite(vertical) && vertical > 1 ? vertical : estimate;
};

/**
 * Posição vertical de um marcador no AR, em % da altura da camada (0 = topo,
 * 50 = centro, 100 = base), ou seja: onde o ângulo do alvo cai na pré-
 * visualização da câmera.
 *
 * `targetElevation` é a elevação do alvo acima do horizonte, `viewElevation`
 * a do eixo de visão (`viewElevationDeg`) e `verticalFov` o ângulo vertical da
 * imagem. Um alvo no horizonte com a câmera nivelada fica em 50 (a linha do
 * horizonte); subir o alvo acima do eixo de visão move-o para o topo.
 *
 * Sem elevação (waypoint sem altitude) ou sem ecrã medido, fica em
 * `fallbackPct` — o valor fixo de sempre. O retorno é aparado a 6–94 para o
 * chip não sair da tela quando o alvo está fora do campo.
 */
export const markerTopPct = (
  targetElevation: number | null,
  viewElevation: number,
  verticalFov: number,
  fallbackPct: number,
): number => {
  if (
    targetElevation === null ||
    !Number.isFinite(targetElevation) ||
    !Number.isFinite(viewElevation) ||
    !(verticalFov > 0)
  ) {
    return fallbackPct;
  }
  const pct = 50 - ((targetElevation - viewElevation) / verticalFov) * 100;
  if (!Number.isFinite(pct)) {
    return fallbackPct;
  }
  return Math.max(6, Math.min(94, pct));
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