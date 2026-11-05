import { toRad, toDeg } from './geo';

export type CelestialPoint = {
  azimuth: number;
  elevation: number;
  visible: boolean;
};

type RaDec = { rightAscension: number; declination: number };

const J2000 = 2451545.0;

const toDays = (date: Date) => {
  const jd = date.valueOf() / 86400000 + 2440587.5;
  return jd - J2000;
};

const wrap360 = (deg: number) => {
  const v = deg % 360;
  return v < 0 ? v + 360 : v;
};

const wrap180 = (deg: number) => {
  let v = deg % 360;
  if (v > 180) v -= 360;
  if (v < -180) v += 360;
  return v;
};

const gmstDegrees = (d: number) =>
  wrap360(280.46061837 + 360.98564736629 * d);

const horizonCoords = (
  raDec: RaDec,
  date: Date,
  lat: number,
  lon: number,
): CelestialPoint => {
  const d = toDays(date);
  const h = wrap180(gmstDegrees(d) + lon - raDec.rightAscension);
  const hRad = toRad(h);
  const sinAlt =
    Math.sin(toRad(lat)) * Math.sin(toRad(raDec.declination)) +
    Math.cos(toRad(lat)) *
      Math.cos(toRad(raDec.declination)) *
      Math.cos(hRad);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAlt = Math.cos(alt);
  const azRad =
    cosAlt <= 0
      ? 0
      : Math.atan2(
          -Math.sin(hRad),
          Math.cos(toRad(lat)) * Math.tan(toRad(raDec.declination)) -
            Math.sin(toRad(lat)) * Math.cos(hRad),
        );
  return {
    azimuth: wrap360(toDeg(azRad)),
    elevation: toDeg(alt),
    visible: toDeg(alt) > -0.5,
  };
};

const raDecFromEcliptic = (eclLon: number, eclLat: number, T: number) => {
  const eps = toRad(23.4392911 - 0.0130042 * T);
  const l = toRad(eclLon);
  const b = toRad(eclLat);
  return {
    rightAscension: wrap360(
      toDeg(Math.atan2(Math.sin(l) * Math.cos(eps) - Math.tan(b) * Math.sin(eps), Math.cos(l))),
    ),
    declination: toDeg(
      Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l)),
    ),
  };
};

/**
 * Precessão de J2000 para a data (IAU 1976, sem nutação).
 *
 * A estrela não está fixa no céu: o polo celeste desloca-se ~50" por ano e
 * Polaris, que está a menos de meio grau do polo, é a estrela que mais se
 * move. Para uma bússola de bolso isso seria irrelevante; para uma mira de
 * calibração, onde se aponta o telefone a uma estrela a um grau do norte
 * verdadeiro, é a diferença entre "meio grau a mais" e "meio grau a menos".
 *
 * A fórmula é a de Meeus (cap. 21): três rotações em torno dos eixos z, y, z.
 */
const precess = (ra: number, dec: number, t: number): RaDec => {
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) / 3600;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) / 3600;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) / 3600;

  const a = toRad(ra);
  const d = toRad(dec);
  const zetaRad = toRad(zeta);
  const thetaRad = toRad(theta);

  const A = Math.cos(d) * Math.sin(a + zetaRad);
  const B =
    Math.cos(thetaRad) * Math.cos(d) * Math.cos(a + zetaRad) -
    Math.sin(thetaRad) * Math.sin(d);
  const C =
    Math.sin(thetaRad) * Math.cos(d) * Math.cos(a + zetaRad) +
    Math.cos(thetaRad) * Math.sin(d);

  return {
    rightAscension: wrap360(toDeg(Math.atan2(A, B)) + z),
    declination: toDeg(Math.asin(Math.max(-1, Math.min(1, C)))),
  };
};

/**
 * Polaris (a estrela polar), em J2000: RA 2h31m49.09s, Dec +89°15'50.8".
 *
 * É a estrela perto do polo celeste: a sua altura sobre o horizonte é,
 * para todos os efeitos, a latitude de quem está a olhar, e o seu azimute é
 * o norte verdadeiro — é o que permite calibrar a bússola sem tabela de
 * declinação nenhuma (ideia #13).
 *
 * Mas só a norte do equador: no hemisfério sul está abaixo do horizonte, e
 * por isso a calibração do sul usa outras estrelas (a Cruz do Sul e as mais
 * brilhantes do céu sul).
 */
export const POLARIS_J2000: RaDec = {
  rightAscension: 37.954542,
  declination: 89.264111,
};

/** As quatro estrelas da Cruz do Sul, em J2000 (RA/Dec em graus). */
export const CRUX_J2000 = {
  acrux: { rightAscension: 186.6499, declination: -63.0992 },
  gacrux: { rightAscension: 187.7916, declination: -57.1131 },
  mimosa: { rightAscension: 191.9303, declination: -59.6888 },
  delta: { rightAscension: 183.7863, declination: -58.7489 },
} as const;

type Vector3 = { x: number; y: number; z: number };

const vectorFromRaDec = ({ rightAscension: ra, declination: dec }: RaDec): Vector3 => {
  const a = toRad(ra);
  const d = toRad(dec);
  return {
    x: Math.cos(d) * Math.cos(a),
    y: Math.cos(d) * Math.sin(a),
    z: Math.sin(d),
  };
};

const raDecFromVector = (v: Vector3): RaDec => {
  const norm = Math.hypot(v.x, v.y, v.z) || 1;
  return {
    rightAscension: wrap360(toDeg(Math.atan2(v.y, v.x))),
    declination: toDeg(Math.asin(Math.max(-1, Math.min(1, v.z / norm)))),
  };
};

const crossProduct = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/**
 * Onde está uma estrela agora, para quem está em `lat`/`lon`.
 *
 * A estrela é dada em J2000 e precessionada para a data; daqui sai o azimute
 * e a altura sobre o horizonte, que é o que a mira de calibração usa para
 * saber para onde apontar.
 */
export const starPosition = (
  raDecJ2000: RaDec,
  date: Date,
  lat: number,
  lon: number,
): CelestialPoint => {
  const t = toDays(date) / 36525;
  const rd = precess(raDecJ2000.rightAscension, raDecJ2000.declination, t);
  return horizonCoords(rd, date, lat, lon);
};

/**
 * Onde está a Polaris agora, para quem está em `lat`/`lon`.
 *
 * A altura deve ser a latitude e o azimute deve ser o norte (a menos de
 * meio grau, que é a distância de Polaris ao polo em 2026). É isso que a
 * mira de calibração usa para saber para onde apontar.
 */
export const polarisPosition = (date: Date, lat: number, lon: number) =>
  starPosition(POLARIS_J2000, date, lat, lon);

/**
 * O centro da Cruz do Sul: o ponto onde o eixo longo (Gacrux–Acrux) cruza o
 * eixo curto (Mimosa–Delta).
 *
 * É o alvo que se aponta no hemisfério sul: a Cruz é a figura mais fácil de
 * reconhecer do céu sul, e o seu centro fica a ~30° do polo celeste sul —
 * longe o suficiente para o erro de mira não pesar demasiado.
 *
 * O centro é a interseção dos dois grandes círculos, calculada com vetores
 * unitários: primeiro a precessão de cada estrela para a data, depois o
 * cruzamento dos vetores.
 */
export const crossCentrePosition = (date: Date, lat: number, lon: number) => {
  const t = toDays(date) / 36525;
  const p = (rd: RaDec) =>
    vectorFromRaDec(
      precess(rd.rightAscension, rd.declination, t),
    );
  const gacrux = p(CRUX_J2000.gacrux);
  const acrux = p(CRUX_J2000.acrux);
  const mimosa = p(CRUX_J2000.mimosa);
  const delta = p(CRUX_J2000.delta);
  const longAxis = crossProduct(gacrux, acrux);
  const shortAxis = crossProduct(mimosa, delta);
  let centre = raDecFromVector(crossProduct(longAxis, shortAxis));
  // A interseção dá dois pontos opostos; o que nos interessa é o do hemisfério
  // sul celeste (a Cruz fica ao sul, perto do polo sul).
  if (centre.declination > 0) {
    centre = {
      rightAscension: wrap360(centre.rightAscension + 180),
      declination: -centre.declination,
    };
  }
  return horizonCoords(centre, date, lat, lon);
};

export const solarPosition = (date: Date, lat: number, lon: number) => {
  const d = toDays(date);
  const g = toRad(wrap360(357.5291 + 0.98560028 * d));
  const L = wrap360(280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const eps = 23.439 - 0.00000036 * d;
  const ra = wrap360(
    toDeg(Math.atan2(Math.cos(toRad(eps)) * Math.sin(toRad(L)), Math.cos(toRad(L)))),
  );
  const dec = toDeg(Math.asin(Math.sin(toRad(eps)) * Math.sin(toRad(L))));
  return horizonCoords({ rightAscension: ra, declination: dec }, date, lat, lon);
};

const HORIZON_ALT = -0.833;
const BEST_LIGHT_ALT = 15;

export type SunEvents = {
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date | null;
  daylightMinutes: number;
  noonElevation: number;
  bestLightStart: Date | null;
  bestLightEnd: Date | null;
  polarDay: boolean;
  polarNight: boolean;
};

const fromDayTime = (dayStart: Date, minutesIntoDay: number) => {
  const date = new Date(dayStart);
  date.setMinutes(date.getMinutes() + minutesIntoDay);
  return date;
};

const crossingTime = (
  dayStart: Date,
  idxA: number,
  elA: number,
  idxB: number,
  elB: number,
  target: number,
) => {
  const denom = elB - elA;
  if (Math.abs(denom) < 1e-9) return fromDayTime(dayStart, idxB * STEP_MINUTES);
  const t = (target - elA) / denom;
  return fromDayTime(dayStart, idxA * STEP_MINUTES + t * STEP_MINUTES);
};

const STEP_MINUTES = 10;

export const sunEvents = (date: Date, lat: number, lon: number): SunEvents => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const samples = 24 * (60 / STEP_MINUTES);
  const elevations: number[] = [];
  let maxEl = -90;
  let maxIdx = 0;
  for (let i = 0; i <= samples; i += 1) {
    const el = solarPosition(fromDayTime(dayStart, i * STEP_MINUTES), lat, lon).elevation;
    elevations.push(el);
    if (el > maxEl) {
      maxEl = el;
      maxIdx = i;
    }
  }

  let firstAbove = -1;
  let lastAbove = -1;
  for (let i = 0; i < elevations.length; i += 1) {
    if (elevations[i] >= HORIZON_ALT) {
      if (firstAbove < 0) firstAbove = i;
      lastAbove = i;
    }
  }

  const polarDay = firstAbove === 0 && lastAbove === samples;
  const polarNight = firstAbove < 0 && lastAbove < 0;

  let sunrise: Date | null = null;
  let sunset: Date | null = null;
  if (!polarNight && firstAbove >= 0) {
    const s = firstAbove > 0 ? firstAbove - 1 : 0;
    sunrise = firstAbove > 0
      ? crossingTime(dayStart, s, elevations[s], firstAbove, elevations[firstAbove], HORIZON_ALT)
      : fromDayTime(dayStart, 0);
    const eIdx = lastAbove < samples ? lastAbove + 1 : samples;
    sunset = lastAbove < samples
      ? crossingTime(dayStart, lastAbove, elevations[lastAbove], eIdx, elevations[eIdx], HORIZON_ALT)
      : fromDayTime(dayStart, samples);
  }
  if (polarDay) {
    sunrise = fromDayTime(dayStart, 0);
    sunset = fromDayTime(dayStart, samples);
  }

  let bestLightStart: Date | null = null;
  let bestLightEnd: Date | null = null;
  if (!polarNight) {
    let b0 = -1;
    let b1 = -1;
    for (let i = 0; i < elevations.length; i += 1) {
      if (elevations[i] >= BEST_LIGHT_ALT) {
        if (b0 < 0) b0 = i;
        b1 = i;
      }
    }
    if (b0 >= 0) {
      const s = b0 > 0 ? b0 - 1 : 0;
      bestLightStart = b0 > 0
        ? crossingTime(dayStart, s, elevations[s], b0, elevations[b0], BEST_LIGHT_ALT)
        : fromDayTime(dayStart, 0);
      const eIdx = b1 < samples ? b1 + 1 : samples;
      bestLightEnd = b1 < samples
        ? crossingTime(dayStart, b1, elevations[b1], eIdx, elevations[eIdx], BEST_LIGHT_ALT)
        : fromDayTime(dayStart, samples);
    }
  }

  const daylightMinutes = sunrise && sunset
    ? Math.round((sunset.getTime() - sunrise.getTime()) / 60000)
    : 0;

  return {
    sunrise,
    sunset,
    solarNoon: fromDayTime(dayStart, maxIdx * STEP_MINUTES),
    daylightMinutes,
    noonElevation: Math.round(maxEl * 10) / 10,
    bestLightStart,
    bestLightEnd,
    polarDay,
    polarNight,
  };
};

const moonCoordinates = (d: number): RaDec => {
  const T = d / 36525;
  const Lp = wrap360(218.3164477 + 481267.88123421 * T);
  const D = wrap360(297.8501921 + 445267.1114034 * T);
  const M = wrap360(357.5291092 + 35999.0502909 * T);
  const Mp = wrap360(134.9633964 + 477198.8675055 * T);
  const F = wrap360(93.272095 + 483202.0175233 * T);

  const sin = (deg: number) => Math.sin(toRad(deg));

  const eclLon =
    Lp +
    6.288774 * sin(Mp) +
    1.274027 * sin(2 * D - Mp) +
    0.658314 * sin(2 * D) +
    0.213618 * sin(2 * Mp) -
    0.185116 * sin(M) -
    0.114332 * sin(2 * F) +
    0.058793 * sin(2 * D - 2 * Mp) +
    0.057066 * sin(2 * D - M - Mp) +
    0.053322 * sin(2 * D + Mp) +
    0.045758 * sin(2 * D - M) -
    0.040923 * sin(M - Mp) -
    0.03472 * sin(D) -
    0.030383 * sin(M + Mp) +
    0.015327 * sin(2 * D - 2 * F) -
    0.012528 * sin(Mp + 2 * F) +
    0.01098 * sin(Mp - 2 * F) +
    0.010675 * sin(4 * D - Mp) +
    0.010034 * sin(3 * Mp) +
    0.008548 * sin(4 * D - 2 * Mp);

  const eclLat =
    5.128189 * sin(F) +
    0.280606 * sin(Mp + F) +
    0.277693 * sin(Mp - F) +
    0.173238 * sin(2 * D - F) +
    0.055413 * sin(2 * D + F - Mp) +
    0.046272 * sin(2 * D - F - Mp) +
    0.032573 * sin(2 * D + F) +
    0.017198 * sin(2 * Mp + F) +
    0.009267 * sin(2 * D + Mp - F);

  return raDecFromEcliptic(wrap360(eclLon), wrap360(eclLat), T);
};

export const lunarPosition = (date: Date, lat: number, lon: number) => {
  const d = toDays(date);
  return horizonCoords(moonCoordinates(d), date, lat, lon);
};

// D é a elongação média da Lua: 0 = nova, 90 = quarto crescente, 180 = cheia,
// 270 = quarto minguante. Os intervalos são centrados nos quartos reais.
const MOON_PHASES = [
  { from: 337.5, to: 360, name: 'Lua nova', icon: '🌑' },
  { from: 0, to: 22.5, name: 'Lua nova', icon: '🌑' },
  { from: 22.5, to: 67.5, name: 'Crescente', icon: '🌒' },
  { from: 67.5, to: 112.5, name: 'Crescente', icon: '🌓' },
  { from: 112.5, to: 157.5, name: 'Gibosa crescente', icon: '🌔' },
  { from: 157.5, to: 202.5, name: 'Lua cheia', icon: '🌕' },
  { from: 202.5, to: 247.5, name: 'Gibosa minguante', icon: '🌖' },
  { from: 247.5, to: 292.5, name: 'Minguante', icon: '🌗' },
  { from: 292.5, to: 337.5, name: 'Minguante', icon: '🌘' },
];

export const moonPhase = (date: Date) => {
  const d = toDays(date);
  const D = wrap360(297.8501921 + 445267.1114034 * (d / 36525));
  const fraction = (1 - Math.cos(toRad(D))) / 2;
  const phase =
    MOON_PHASES.find(p =>
      p.from <= p.to
        ? D >= p.from && D < p.to
        : D >= p.from || D < p.to,
    ) ?? MOON_PHASES[0];
  return { ...phase, elongation: D, fraction };
};
