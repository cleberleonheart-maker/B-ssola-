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

const MOON_PHASES = [
  { from: 0, to: 45, name: 'Lua nova', icon: '🌑' },
  { from: 45, to: 135, name: 'Crescente', icon: '🌒' },
  { from: 135, to: 225, name: 'Lua cheia', icon: '🌕' },
  { from: 225, to: 315, name: 'Minguante', icon: '🌘' },
  { from: 315, to: 360, name: 'Lua nova', icon: '🌑' },
];

export const moonPhase = (date: Date) => {
  const d = toDays(date);
  const D = wrap360(297.8501921 + 445267.1114034 * (d / 36525));
  const fraction = (1 - Math.cos(toRad(D))) / 2;
  const phase = MOON_PHASES.find(p => D >= p.from && D < p.to) ?? MOON_PHASES[0];
  return { ...phase, elongation: D, fraction };
};