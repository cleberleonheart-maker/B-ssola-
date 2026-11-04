/**
 * Mapa de calor "onde estive" (ideia #36).
 *
 * A app sabe onde esteve sempre que o GPS está ligado; até agora essa
 * informação ficava no breadcrumb do mini-mapa, que se perde quando se fecha
 * o ecrã. Aqui os pontos ficam guardados e são agrupados numa grelha: o
 * desenho final é a mancha de calor — onde se passou mais tempo é mais quente.
 *
 * Tudo aqui é função pura das coordenadas: a grelha, a cor e os filtros de
 * tempo. O desenho no ecrã é que decide o tamanho da célula em pixels, e a
 * projeção (equirrectangular com `cos(latitude)`) é a mesma do mini-mapa e da
 * página `web/live.html`.
 */

export type HeatPoint = { lat: number; lon: number; ts?: number };

export type HeatCell = {
  /** Centro da célula (a média dos pontos nela). */
  lat: number;
  lon: number;
  /** Quantos pontos caíram nesta célula. */
  count: number;
  /** Densidade relativa de 0 a 1, para a cor. */
  weight: number;
};

const METERS_PER_DEGREE_LAT = 111320;

/** Lado da célula do mapa de calor, em metros. */
export const DEFAULT_CELL_METERS = 40;

/**
 * Agrupa os pontos numa grelha de `cellMeters` e devolve as células com a
 * densidade de cada uma.
 *
 * A grelha é global (a chave sai das coordenadas em metros, não do primeiro
 * ponto), para a mesma célula ser sempre a mesma: sem isso, dois levantamentos
 * do mesmo sítio dariam manchas diferentes e a comparação entre dias não
 * valia nada.
 *
 * O peso é a raiz da densidade relativa, e não a densidade em si: com a
 * raiz, uma célula com um quarto das visitas da mais cheia já aparece a
 * meio da escala — a diferença entre "ali passaste" e "ali viveste" é o que
 * se quer ver.
 */
export const buildHeatGrid = (
  points: readonly HeatPoint[],
  cellMeters: number = DEFAULT_CELL_METERS,
): HeatCell[] => {
  const size = Math.max(cellMeters, 1);
  const cells = new Map<string, { latSum: number; lonSum: number; count: number }>();

  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const metersPerLon = METERS_PER_DEGREE_LAT * Math.cos((point.lat * Math.PI) / 180);
    const x = Math.floor((point.lon * metersPerLon) / size);
    const y = Math.floor((point.lat * METERS_PER_DEGREE_LAT) / size);
    const key = `${x}:${y}`;
    const cell = cells.get(key);
    if (cell) {
      cell.count += 1;
      cell.latSum += point.lat;
      cell.lonSum += point.lon;
    } else {
      cells.set(key, { latSum: point.lat, lonSum: point.lon, count: 1 });
    }
  }

  const list = Array.from(cells.values()).map(cell => ({
    lat: cell.latSum / cell.count,
    lon: cell.lonSum / cell.count,
    count: cell.count,
  }));
  if (list.length === 0) return [];

  const max = list.reduce((m, cell) => Math.max(m, cell.count), 1);
  return list.map(cell => ({ ...cell, weight: Math.sqrt(cell.count / max) }));
};

/** Âncoras da rampa de cor: frio (azul), meio (amarelo), quente (vermelho). */
const HEAT_STOPS: Array<{ at: number; rgb: [number, number, number] }> = [
  { at: 0, rgb: [47, 111, 208] },
  { at: 0.5, rgb: [245, 197, 66] },
  { at: 1, rgb: [224, 75, 75] },
];

const hex = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

/**
 * A cor de uma célula, de azul (passaste por lá) a vermelho (viveste ali).
 * A rampa é piecewise-linear entre as três âncoras.
 */
export const heatColor = (weight: number): string => {
  const w = Math.max(0, Math.min(1, weight));
  const lower = HEAT_STOPS[0];
  const upper = HEAT_STOPS[HEAT_STOPS.length - 1];
  let from = lower;
  let to = upper;
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    if (w >= HEAT_STOPS[i].at && w <= HEAT_STOPS[i + 1].at) {
      from = HEAT_STOPS[i];
      to = HEAT_STOPS[i + 1];
      break;
    }
  }
  const span = to.at - from.at;
  const t = span <= 0 ? 0 : (w - from.at) / span;
  const rgb = from.rgb.map((value, i) => value + (to.rgb[i] - value) * t);
  return `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`;
};

/** Meia-noite local do dia em que `ts` cai. */
export const startOfDay = (ts: number): number => {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const filterSince = <T extends { ts: number }>(
  points: readonly T[],
  sinceTs: number,
): T[] => points.filter(point => point.ts >= sinceTs);
