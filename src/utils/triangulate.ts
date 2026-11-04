export type Point = { lat: number; lon: number };
export type Ray = { point: Point; bearing: number };

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

type Vec3 = { x: number; y: number; z: number };

/** Ponto da esfera (raio 1) a partir da latitude e longitude. */
const toVec = (p: Point): Vec3 => {
  const lat = toRad(p.lat);
  const lon = toRad(p.lon);
  const cosLat = Math.cos(lat);
  return {
    x: cosLat * Math.cos(lon),
    y: cosLat * Math.sin(lon),
    z: Math.sin(lat),
  };
};

/** Norte local (para onde a latitude cresce). */
const northHat = (p: Point): Vec3 => {
  const lat = toRad(p.lat);
  const lon = toRad(p.lon);
  return {
    x: -Math.sin(lat) * Math.cos(lon),
    y: -Math.sin(lat) * Math.sin(lon),
    z: Math.cos(lat),
  };
};

/** Este local (para onde a longitude cresce). */
const eastHat = (p: Point): Vec3 => {
  const lon = toRad(p.lon);
  return { x: -Math.sin(lon), y: Math.cos(lon), z: 0 };
};

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const norm = (v: Vec3): Vec3 => {
  const len = Math.sqrt(dot(v, v));
  if (!len) return v;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
};

/**
 * Interseção de dois raios (para frente): cada um parte de um ponto conhecido
 * e segue um rumo. O ponto onde se cruzam é a posição estimada.
 *
 * A conta é feita em vetores: o raio é o círculo máximo que passa pelo ponto
 * com a direção do rumo, e a interseção de dois círculos máximos é a reta
 * perpendicular às duas normais — de onde saem dois pontos antipodais, e vale
 * o que está "à frente" nos dois raios.
 *
 * É o que faz a "triangulação por rumos" (o observador muda de sítio e mira o
 * alvo) e também a "por marcadores": aí os raios partem dos marcos, com o
 * rumo invertido, e o cruzamento é a posição de quem mirou.
 */
export const intersectRays = (r1: Ray, r2: Ray): Point | null => {
  const p1 = toVec(r1.point);
  const p2 = toVec(r2.point);

  // Direção do raio: o rumo conta a partir do norte e gira para leste.
  const bearing1 = toRad(r1.bearing);
  const d1 = norm({
    x: Math.cos(bearing1) * northHat(r1.point).x + Math.sin(bearing1) * eastHat(r1.point).x,
    y: Math.cos(bearing1) * northHat(r1.point).y + Math.sin(bearing1) * eastHat(r1.point).y,
    z: Math.cos(bearing1) * northHat(r1.point).z + Math.sin(bearing1) * eastHat(r1.point).z,
  });

  const bearing2 = toRad(r2.bearing);
  const d2 = norm({
    x: Math.cos(bearing2) * northHat(r2.point).x + Math.sin(bearing2) * eastHat(r2.point).x,
    y: Math.cos(bearing2) * northHat(r2.point).y + Math.sin(bearing2) * eastHat(r2.point).y,
    z: Math.cos(bearing2) * northHat(r2.point).z + Math.sin(bearing2) * eastHat(r2.point).z,
  });

  // Normal de cada círculo máximo: a perpendicular ao raio no ponto de partida.
  const n1 = cross(p1, d1);
  const n2 = cross(p2, d2);

  // A interseção dos dois planos é a reta na direção n1 × n2.
  const c = cross(n1, n2);
  if (Math.abs(Math.sqrt(dot(c, c))) < 1e-12) return null;

  const candidate = norm(c);
  // Escolhe o ponto que está à frente nos dois raios (e no hemisfério do
  // ponto de partida, senão o antipodal serve).
  const forward =
    dot(candidate, d1) > 0 && dot(candidate, d2) > 0 && dot(candidate, p1) > 0
      ? candidate
      : { x: -candidate.x, y: -candidate.y, z: -candidate.z };

  if (dot(forward, d1) <= 0 || dot(forward, d2) <= 0) return null;

  const lat = Math.asin(forward.z);
  const lon = Math.atan2(forward.y, forward.x);
  return { lat: toDeg(lat), lon: toDeg(lon) };
};

/**
 * Diferença mínima entre dois rumos, em graus (0–180).
 *
 * Serve para dizer "está a apontar 12° ao lado do marco" — o desvio entre o
 * que a agulha marca e o que o marco exige.
 */
export const angleDiff = (a: number, b: number): number => {
  const diff = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return diff;
};
