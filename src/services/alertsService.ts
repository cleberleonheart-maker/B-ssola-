import { haversine } from '../utils/geo';

export type WeatherAlert = {
  event: string;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  severity: 'green' | 'yellow' | 'orange' | 'red';
  awareness_type: string | null;
  effective: number | null;
  expires: number | null;
};

export type QuakeAlert = {
  mag: number;
  place: string;
  time: number;
  distanceKm: number | null;
};

export type CivilAlerts = {
  weather: WeatherAlert[];
  quakes: QuakeAlert[];
};

type RawWeatherAlert = {
  event?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  severity?: string;
  awareness_level?: string;
  awareness_type?: string;
  effective?: string;
  expires?: string;
};

type RawInmetAlert = {
  severidade?: string;
  aviso_cor?: string;
  descricao?: string;
  instrucoes?: string;
  data_inicio?: string;
  data_fim?: string;
  poligono?: string;
};

const REQUEST_TIMEOUT = 10000;

const fetchJson = async (url: string): Promise<unknown> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`http_${res.status}`);
    }
    return await res.json();
  } catch {
    throw new Error('network_error');
  } finally {
    clearTimeout(id);
  }
};

const parseSeverity = (
  severity?: string,
  awarenessLevel?: string,
): WeatherAlert['severity'] => {
  const level = (awarenessLevel ?? severity ?? '').toLowerCase();
  if (level.includes('red') || level.includes('extreme')) return 'red';
  if (level.includes('orange') || level.includes('severe')) return 'orange';
  if (level.includes('yellow') || level.includes('moderate')) return 'yellow';
  return 'green';
};

const toTime = (raw?: string): number | null => {
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
};

export const fetchWeatherAlerts = async (
  latitude: number,
  longitude: number,
): Promise<WeatherAlert[]> => {
  try {
    const data = (await fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(
        4,
      )}&longitude=${longitude.toFixed(
        4,
      )}&forecast_days=3&alerts=true`,
    )) as { alerts?: RawWeatherAlert[] };
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];
    const now = Date.now();
    return alerts
      .map(raw => ({
        event: raw.event ?? 'Alerta',
        headline: raw.headline ?? null,
        description: raw.description ?? null,
        instruction: raw.instruction ?? null,
        severity: parseSeverity(raw.severity, raw.awareness_level),
        awareness_type: raw.awareness_type ?? null,
        effective: toTime(raw.effective),
        expires: toTime(raw.expires),
      }))
      .filter(
        alert =>
          alert.severity !== 'green' &&
          (alert.expires === null || alert.expires > now),
      );
  } catch {
    return [];
  }
};

export const fetchNearbyQuakes = async (
  latitude: number,
  longitude: number,
  maxDistanceKm = 1000,
  minMagnitude = 4,
): Promise<QuakeAlert[]> => {
  try {
    const data = (await fetchJson(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    )) as {
      features?: Array<{
        properties?: {
          mag?: number | null;
          place?: string | null;
          time?: number | null;
        };
        geometry?: { coordinates?: number[] };
      }>;
    };
    const features = Array.isArray(data.features) ? data.features : [];
    return features
      .map(feature => {
        const props = feature.properties;
        const coords = feature.geometry?.coordinates;
        const mag = props?.mag ?? 0;
        if (mag < minMagnitude) return null;
        let distanceKm: number | null = null;
        if (coords && coords.length >= 2) {
          distanceKm = haversine(
            latitude,
            longitude,
            coords[1],
            coords[0],
          );
        }
        return {
          mag,
          place: props?.place ?? 'Terremoto',
          time: props?.time ?? Date.now(),
          distanceKm,
        };
      })
      .filter(
        (quake): quake is QuakeAlert =>
          quake !== null &&
          (quake.distanceKm === null || quake.distanceKm <= maxDistanceKm),
      )
      .sort((a, b) => b.mag - a.mag)
      .slice(0, 8);
  } catch {
    return [];
  }
};

type Pt = number[];

const inmetRings = (geojson: string): Pt[][] => {
  try {
    const parsed = JSON.parse(geojson) as {
      type?: string;
      coordinates?: unknown;
    };
    const coords = parsed.coordinates as unknown;
    if (!Array.isArray(coords)) return [];
    const rings: Pt[][] = [];
    if (parsed.type === 'Polygon') {
      (coords as Pt[][]).forEach(ring => rings.push(ring));
    } else if (parsed.type === 'MultiPolygon') {
      (coords as Pt[][][]).forEach(poly =>
        poly.forEach(ring => rings.push(ring)),
      );
    }
    return rings;
  } catch {
    return [];
  }
};

const pointInRing = (lat: number, lon: number, ring: Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lonI, latI] = ring[i];
    const [lonJ, latJ] = ring[j];
    const intersects =
      latI > lat !== latJ > lat &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI;
    if (intersects) inside = !inside;
  }
  return inside;
};

const parseInmetSeverity = (
  value?: string,
  color?: string,
): WeatherAlert['severity'] => {
  const level = (value ?? '').toLowerCase();
  const hex = (color ?? '').toUpperCase();
  if (level.includes('grande') || hex === '#FF0000') return 'red';
  if (level.includes('potencial')) return 'yellow';
  if (level.includes('perigo') || hex === '#FF9900') return 'orange';
  return 'green';
};

export const fetchInmetAlerts = async (
  latitude: number,
  longitude: number,
): Promise<WeatherAlert[]> => {
  try {
    const data = (await fetchJson(
      'https://apiprevmet3.inmet.gov.br/avisos/ativos',
    )) as { hoje?: RawInmetAlert[]; futuro?: RawInmetAlert[] };
    const now = Date.now();
    const items = [
      ...(Array.isArray(data.hoje) ? data.hoje : []),
      ...(Array.isArray(data.futuro) ? data.futuro : []),
    ];
    return items
      .map((raw): WeatherAlert | null => {
        const rings =
          typeof raw.poligono === 'string' ? inmetRings(raw.poligono) : [];
        if (
          rings.length === 0 ||
          !rings.some(ring => pointInRing(latitude, longitude, ring))
        ) {
          return null;
        }
        const expires = raw.data_fim ? toTime(raw.data_fim) : null;
        if (expires !== null && expires < now) return null;
        const severity = parseInmetSeverity(raw.severidade, raw.aviso_cor);
        if (severity === 'green') return null;
        return {
          event: raw.severidade ?? 'Aviso INMET',
          headline: raw.descricao ?? null,
          description: raw.descricao ?? null,
          instruction: raw.instrucoes ?? null,
          severity,
          awareness_type: 'INMET',
          effective: raw.data_inicio ? toTime(raw.data_inicio) : null,
          expires,
        };
      })
      .filter((a): a is WeatherAlert => a !== null)
      .slice(0, 6);
  } catch {
    return [];
  }
};

export const fetchCivilAlerts = async (
  latitude: number,
  longitude: number,
): Promise<CivilAlerts> => {
  const [weather, quakes, inmet] = await Promise.all([
    fetchWeatherAlerts(latitude, longitude),
    fetchNearbyQuakes(latitude, longitude),
    fetchInmetAlerts(latitude, longitude),
  ]);
  return { weather: [...weather, ...inmet], quakes };
};

export const isSevere = (alerts: CivilAlerts): boolean =>
  alerts.weather.some(
    alert => alert.severity === 'orange' || alert.severity === 'red',
  ) || alerts.quakes.some(quake => quake.mag >= 5.5);