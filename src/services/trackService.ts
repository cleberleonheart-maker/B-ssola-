import AsyncStorage from '@react-native-async-storage/async-storage';
import { haversine } from '../utils/geo';

export type TrackPoint = {
  lat: number;
  lon: number;
  alt: number | null;
  ts: number;
};

/**
 * Ponto de interesse marcado durante a gravação (no clássico "marcar POI",
 * com foto e nota). Vive dentro da trilha que o gerou, e quanto às fotos usa a
 * mesma convenção da caderneta: a câmera do sistema escreve em
 * `cache/photos/...` e o caminho é o que fica guardado.
 */
export type TrackPoi = {
  id: string;
  lat: number;
  lon: number;
  alt: number | null;
  ts: number;
  note: string;
  photoPath: string | null;
};

export type TrackStats = {
  distance: number;
  eleGain: number;
  eleLoss: number;
  maxAlt: number | null;
  minAlt: number | null;
  maxSpeedKmh: number;
};

export type RecordedTrack = {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number;
  points: TrackPoint[];
  pois: TrackPoi[];
} & TrackStats;

const STORAGE_KEY = '@bussola/tracks';
const ALT_DEADBAND = 1.5;

export const computeTrackStats = (
  points: TrackPoint[],
): TrackStats => {
  let distance = 0;
  let eleGain = 0;
  let eleLoss = 0;
  let maxAlt: number | null = null;
  let minAlt: number | null = null;
  let maxSpeedKmh = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0) {
      const prev = points[i - 1];
      distance += haversine(prev.lat, prev.lon, p.lat, p.lon);
      if (p.alt != null && prev.alt != null) {
        const dp = p.alt - prev.alt;
        if (Math.abs(dp) > ALT_DEADBAND) {
          if (dp > 0) eleGain += dp;
          else eleLoss += -dp;
        }
      }
      const dtSec = Math.max((p.ts - prev.ts) / 1000, 0);
      const dMeters = haversine(prev.lat, prev.lon, p.lat, p.lon);
      if (dtSec > 0) {
        const kmh = (dMeters / dtSec) * 3.6;
        if (kmh > maxSpeedKmh) maxSpeedKmh = kmh;
      }
    }
    if (p.alt != null) {
      if (maxAlt == null || p.alt > maxAlt) maxAlt = p.alt;
      if (minAlt == null || p.alt < minAlt) minAlt = p.alt;
    }
  }

  return {
    distance:
      points.length > 1 ? Math.round(distance * 10) / 10 : 0,
    eleGain: Math.round(Math.max(0, eleGain)),
    eleLoss: Math.round(Math.max(0, eleLoss)),
    maxAlt,
    minAlt,
    maxSpeedKmh: Math.round(maxSpeedKmh * 10) / 10,
  };
};

export const createTrackId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const createPoiId = () =>
  `poi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const loadTracks = async (): Promise<RecordedTrack[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecordedTrack[]) : [];
  } catch {
    return [];
  }
};

export const saveTrack = async (track: RecordedTrack) => {
  const list = await loadTracks();
  const next = [track, ...list];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const deleteTrack = async (id: string) => {
  const list = await loadTracks();
  const next = list.filter(tr => tr.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const replaceTracks = async (list: RecordedTrack[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
};

export const simplifyPath = (
  points: TrackPoint[],
  tolerance = 0.00003,
): TrackPoint[] => {
  if (points.length < 3) return points;

  const sqDist = (p: TrackPoint, q: TrackPoint) => {
    const dx = p.lat - q.lat;
    const dy = p.lon - q.lon;
    return dx * dx + dy * dy;
  };

  const segDist = (p: TrackPoint, a: TrackPoint, b: TrackPoint) => {
    const dx = b.lon - a.lon;
    const dy = b.lat - a.lat;
    if (dx === 0 && dy === 0) return sqDist(p, a);
    const t =
      ((p.lon - a.lon) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy);
    if (t < 0) return sqDist(p, a);
    if (t > 1) return sqDist(p, b);
    const projLon = a.lon + t * dx;
    const projLat = a.lat + t * dy;
    return (p.lon - projLon) ** 2 + (p.lat - projLat) ** 2;
  };

  const keep = new Set<number>([0, points.length - 1]);
  const eps = tolerance * tolerance;
  const stack: number[] = [0, points.length - 1];

  while (stack.length > 0) {
    const last = stack.pop() as number;
    const first = stack.pop() as number;
    if (last - first < 2) {
      continue;
    }
    let dmax = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = segDist(points[i], points[first], points[last]);
      if (d > dmax) {
        dmax = d;
        index = i;
      }
    }
    if (index < 0 || dmax <= eps) {
      continue;
    }
    keep.add(index);
    stack.push(first, index, index, last);
  }

  const out: TrackPoint[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (keep.has(i)) out.push(points[i]);
  }
  return out;
};

export const formatDuration = (ms: number): string => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};