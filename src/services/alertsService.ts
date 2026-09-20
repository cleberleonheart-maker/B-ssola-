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

export const fetchCivilAlerts = async (
  latitude: number,
  longitude: number,
): Promise<CivilAlerts> => {
  const [weather, quakes] = await Promise.all([
    fetchWeatherAlerts(latitude, longitude),
    fetchNearbyQuakes(latitude, longitude),
  ]);
  return { weather, quakes };
};

export const isSevere = (alerts: CivilAlerts): boolean =>
  alerts.weather.some(
    alert => alert.severity === 'orange' || alert.severity === 'red',
  ) || alerts.quakes.some(quake => quake.mag >= 5.5);