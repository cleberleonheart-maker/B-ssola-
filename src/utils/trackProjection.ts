import { initialBearing, toRad } from './geo';

/**
 * Projeção partilhada entre a pré-visualização de trilhos do app e o mini
 * mapa da página de rastreio (`web/live.html`).
 *
 * É equirrectangular com a correcção `cos(latitude)`: sem ela, um grau de
 * longitude contaria o mesmo que um de latitude e o desenho esticava ~27% na
 * latitude de Lisboa. A mesma matemática está escrita em JavaScript dentro do
 * `live.html`, e `__tests__/trackProjectionParity.test.ts` trava a paridade
 * entre as duas — se umaMexer e a outra não, esse teste acende.
 *
 * Não há tiles nem projections remotas: a projection é uma função pura das
 * coordenadas, o que faz o desenho funcionar sem rede por construção.
 */

export type GeoPoint = { lat: number; lon: number };
export type ProjectedPoint = { x: number; y: number };

export type Viewport = {
  width: number;
  height: number;
  /** Margem em pixels entre o desenho e o limite da caixa. */
  padding?: number;
  /**
   * Centro e escala explícitos. Sem isto a vista é "encaixa o trilho inteiro
   * na caixa"; com isto a vista é "mostra esta janela à minha volta", que é o
   * que se quer num mapa que segue a pessoa. O trilho continua a ser desenhado
   * inteiro, é só a janela que muda.
   */
  center?: GeoPoint;
  /** Lado da janela, em metros. Só usado com `center`. */
  spanMeters?: number;
};

export type TrackProjection = {
  points: ProjectedPoint[];
  /** Pixels por metro. */
  scale: number;
  center: GeoPoint | null;
  metersPerDegreeLat: number;
  metersPerDegreeLon: number;
  spanMeters: { width: number; height: number };
  /**
   * A janela foi alargada pela regra do mínimo, ou seja: o que está no ecrã é
   * maior do que o trilho. Verdadeiro tanto para um ponto só como para um
   * trilho de 300 m, e a interface usa isto para dizer "aqui está tudo".
   */
  atMinimumSpan: boolean;
};

/** Metros por grau de latitude. Longitude entra com `cos(lat)` em cima. */
const METERS_PER_DEGREE_LAT = 111320;

/**
 * Janela mínima, em metros, mostrada quando o trilho não tem extensão
 * aproveitável — um ponto só, ou o vaivém de alguns metros de uma leitura de
 * GPS parada. Sem isto a escala seria infinita e o desenho um borrão.
 */
const MIN_SPAN_METERS = 400;

const EMPTY: TrackProjection = {
  points: [],
  scale: 0,
  center: null,
  metersPerDegreeLat: METERS_PER_DEGREE_LAT,
  metersPerDegreeLon: METERS_PER_DEGREE_LAT,
  spanMeters: { width: 0, height: 0 },
  atMinimumSpan: true,
};

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/**
 * Escolhe uma barra de escala que caiba numa fracção da largura: `1`, `2` ou
 * `5` vezes uma potência de dez, com pelo menos um metro.
 *
 * A conta é `largura * fracção / escala` — quantos metros cabem nessa fatia.
 * Multiplicar a escala pela fracção, que é o erro óbvio, dá a unidade errada:
 * com a escala a 0.83 px/m e a largura a 360, uma barra de 400 m de janela
 * sairia com "0.2 m" em vez de "100 m".
 */
export const niceScaleBar = (
  projection: TrackProjection,
  width: number,
  maxFraction = 0.3,
): { meters: number; pixels: number } | null => {
  if (projection.center === null || projection.scale <= 0) return null;
  const budget = Math.max(width, 0) * maxFraction;
  const raw = budget / projection.scale;
  if (raw < 1) return { meters: 1, pixels: projection.scale };
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  const meters = step * magnitude;
  return { meters, pixels: meters * projection.scale };
};

/**
 * Projeta `points` para uma caixa `width` x `height`, centradas e com a maior
 * escala em que o trilho cabe dentro da margem. Devolve sempre o mesmo
 * resultado para a mesma entrada — nenhuma dependência de estado, nenhuma
 * animação, nenhum pedido.
 *
 * Com `viewport.center` a janela é a que foi pedida, não a que o trilho ocupa:
 * o ponto que está no centro da caixa é sempre esse, e o resto sai de volta
 * quando passa do limite. É o que permite um mapa que segue a pessoa.
 *
 * Não trata a antimeridiana: um trilho que atravesse os 180° de longitude
 * seria desenhado dando a volta ao mundo. Isso é preferível a um `if` que
 * adivinha, porque ninguém regista um trilho que atravessa o Pacífico.
 */
export const projectTrack = (
  points: readonly GeoPoint[],
  viewport: Viewport,
): TrackProjection => {
  if (points.length === 0) return EMPTY;

  const padding = clamp(viewport.padding ?? 12, 0, Math.min(viewport.width, viewport.height) / 2);
  const innerWidth = Math.max(viewport.width - padding * 2, 1);
  const innerHeight = Math.max(viewport.height - padding * 2, 1);

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLon = points[0].lon;
  let maxLon = points[0].lon;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }

  const followed: GeoPoint | null = viewport.center ?? null;
  const center = followed ?? { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
  const metersPerDegreeLon =
    METERS_PER_DEGREE_LAT * Math.cos(toRad(center.lat));

  const rawWidth = (maxLon - minLon) * metersPerDegreeLon;
  const rawHeight = (maxLat - minLat) * METERS_PER_DEGREE_LAT;

  const followedSpan = followed ? Math.max(viewport.spanMeters ?? MIN_SPAN_METERS, 1) : 0;
  const atMinimumSpan = followed === null && (
    rawWidth < MIN_SPAN_METERS || rawHeight < MIN_SPAN_METERS
  );

  const spanWidth = followed ? followedSpan : Math.max(rawWidth, MIN_SPAN_METERS);
  const spanHeight = followed ? followedSpan : Math.max(rawHeight, MIN_SPAN_METERS);

  const scale = Math.min(innerWidth / spanWidth, innerHeight / spanHeight);

  const originX = viewport.width / 2;
  const originY = viewport.height / 2;

  return {
    points: points.map(p => ({
      x: originX + (p.lon - center.lon) * metersPerDegreeLon * scale,
      y: originY - (p.lat - center.lat) * METERS_PER_DEGREE_LAT * scale,
    })),
    scale,
    center,
    metersPerDegreeLat: METERS_PER_DEGREE_LAT,
    metersPerDegreeLon,
    spanMeters: { width: spanWidth, height: spanHeight },
    atMinimumSpan,
  };
};

/**
 * O mesmo traço, pronto a desenhar com `View` + `transform: rotate`, que é o
 * que o app tem sem dependências nativas. Cada barra é centrada no meio do
 * segmento para o `left`/`top` não sair dois vezes deslocado.
 */
export type Segment = { x: number; y: number; w: number; a: number };

export const polylineSegments = (
  points: readonly ProjectedPoint[],
  thickness = 2,
): Segment[] => {
  const out: Segment[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    out.push({
      x: (a.x + b.x) / 2 - len / 2,
      y: (a.y + b.y) / 2 - thickness / 2,
      w: len,
      a: (Math.atan2(dy, dx) * 180) / Math.PI,
    });
  }
  return out;
};

/** Caminho SVG equivalente, para a página web. */
export const polylinePath = (points: readonly ProjectedPoint[]): string => {
  if (points.length === 0) return '';
  const round = (v: number) => Math.round(v * 100) / 100;
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`)
    .join(' ');
};

export type TrackPathHint = {
  /** Distância ao ponto mais próximo do traço, em metros. */
  meters: number;
  /** Rumo da posição atual para o ponto mais próximo, em graus (0–360). */
  bearing: number;
  /** O ponto mais próximo do traço (segmento ou vértice). */
  nearest: GeoPoint;
};

/**
 * Distância de um ponto (lat/lon) ao traço de uma trilha — a polilinha inteira,
 * e não só aos vértices: com pontos simplificados separados por dezenas de
 * metros, medir só aos vértices sobrestimaria a saída do trajeto.
 *
 * Projeta tudo para o plano equirrectangular centrado no ponto (mesmo truque do
 * resto do ficheiro), calcula a distância ponto-a-segmento em cada segmento e
 * guarda o menor; o rumo devolvido serve para quem se perdeu saber para onde
 * voltar. NULL quando não há pontos.
 */
export const distanceToTrackPath = (
  lat: number,
  lon: number,
  points: readonly GeoPoint[],
): TrackPathHint | null => {
  if (points.length === 0) return null;
  const cosLat = Math.cos(toRad(lat));
  const toPlanar = (p: GeoPoint) => ({
    x: (p.lon - lon) * 111000 * cosLat,
    y: (p.lat - lat) * 111000,
  });

  const nearest = (x: number, y: number): GeoPoint => ({
    lat: lat + y / 111000,
    lon: lon + x / (111000 * cosLat),
  });

  const first = toPlanar(points[0]);
  let bestMeters = Math.hypot(first.x, first.y);
  let bestPoint = points[0];

  if (points.length === 1) {
    return {
      meters: bestMeters,
      bearing: initialBearing(lat, lon, points[0].lat, points[0].lon),
      nearest: points[0],
    };
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = toPlanar(points[i]);
    const b = toPlanar(points[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
    }
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const meters = Math.hypot(cx, cy);
    if (meters < bestMeters) {
      bestMeters = meters;
      bestPoint = nearest(cx, cy);
    }
  }

  return {
    meters: bestMeters,
    bearing: initialBearing(lat, lon, bestPoint.lat, bestPoint.lon),
    nearest: bestPoint,
  };
};