import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { haversine } from '../utils/geo';
import type { LocationFix } from './locationService';

/**
 * "Onde estive" (ideia #36): registo local das posições por onde a app
 * passou.
 *
 * O breadcrumb do mini-mapa já desenhava o trajecto, mas só enquanto o ecrã
 * estava aberto. Aqui os pontos ficam guardados no `AsyncStorage` (sem nuvem:
 * é um registo de onde a pessoa esteve, não um dado para partilhar) e o mapa
 * de calor desenha a mancha do dia ou da semana.
 *
 * A amostragem é deliberadamente preguiçosa: um ponto novo só entra se a
 * pessoa andou pelo menos `MIN_STEP_METERS` **e** passou `MIN_GAP_MS`. Sem
 * isto, um GPS parado a oscilar um metro enchia a lista em minutos e o
 * desenho deixava de servir.
 */

export type WhereaboutsPoint = {
  id: string;
  lat: number;
  lon: number;
  ts: number;
};

const STORAGE_KEY = '@bussola/whereabouts';

/** Teto de pontos guardados (uma semana de amostras). */
const MAX_POINTS = 3000;

/** O que é mais antigo que se guarda: uma semana. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Distância mínima entre pontos registados, em metros. */
const MIN_STEP_METERS = 15;

/** Tempo mínimo entre pontos registados, em milissegundos. */
const MIN_GAP_MS = 20000;

const isValidPoint = (point: unknown): point is WhereaboutsPoint => {
  if (!point || typeof point !== 'object') return false;
  const p = point as Partial<WhereaboutsPoint>;
  return (
    typeof p.id === 'string' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    Number.isFinite(p.ts)
  );
};

export const loadWhereabouts = async (): Promise<WhereaboutsPoint[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const agora = Date.now();
    return parsed
      .filter(isValidPoint)
      .filter(point => agora - point.ts <= MAX_AGE_MS)
      .slice(-MAX_POINTS);
  } catch {
    return [];
  }
};

export const saveWhereabouts = async (list: WhereaboutsPoint[]) => {
  const next = list.slice(-MAX_POINTS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const appendWhereabouts = async (point: WhereaboutsPoint) => {
  const list = await loadWhereabouts();
  return saveWhereabouts([...list, point]);
};

export const clearWhereabouts = async () => saveWhereabouts([]);

export const createWhereaboutsId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Regista as posições por onde a app passa. Chamar com a posição actual a
 * cada actualização do GPS: quem decide o que é uma passagem e o que é
 * ruído é o próprio hook, e não quem o usa.
 */
export const useWhereabouts = (active: boolean, location: LocationFix): void => {
  const lastRef = useRef<{ lat: number; lon: number; ts: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    const lat = location.latitude;
    const lon = location.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (lat === 0 && lon === 0) return;

    const now = Date.now();
    const last = lastRef.current;
    if (last) {
      const moved = haversine(last.lat, last.lon, lat, lon);
      if (moved < MIN_STEP_METERS || now - last.ts < MIN_GAP_MS) return;
    }
    lastRef.current = { lat, lon, ts: now };

    appendWhereabouts({ id: createWhereaboutsId(), lat, lon, ts: now }).catch(() => {});
  }, [active, location.latitude, location.longitude]);
};
