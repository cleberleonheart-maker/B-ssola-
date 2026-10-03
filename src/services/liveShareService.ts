import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeHeading } from '../utils/compass';
import {
  isCloudEnabled,
  ensureCloudUser,
  pushLivePosition,
  deleteLiveShareRow,
} from './cloud';
import type { LocationFix } from './locationService';

const PREFIX = 'bussola:live:';
const ACTIVE_KEY = 'bussola:live:active';
const MS_PER_MIN = 60000;

export interface LiveSession {
  token: string;
  expiresAt: number;
}

export const liveLink = (s: LiveSession): string =>
  'https://cleberleonheart-maker.github.io/B-ssola-/live.html#tkn=' +
  encodeURIComponent(s.token);

export const liveCountdown = (s: LiveSession): string => {
  const left = s.expiresAt - Date.now();
  if (left <= 0) return '0:00';
  const m = Math.floor(left / MS_PER_MIN) % 60;
  const h = Math.floor(left / (MS_PER_MIN * 60));
  return `${h}:${String(m).padStart(2, '0')}`;
};

export const startLiveShare = async (
  minutes: number,
): Promise<LiveSession | null> => {
  if (!isCloudEnabled()) return null;
  const token =
    'lnv' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10);
  const session: LiveSession = {
    token,
    expiresAt: Date.now() + Math.max(5, minutes) * MS_PER_MIN,
  };
  try {
    await AsyncStorage.setItem(PREFIX + token, JSON.stringify(session));
    await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
  } catch {}
  return session;
};

export const stopLiveShare = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PREFIX + token);
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    if (!raw) return;
    const active = JSON.parse(raw) as LiveSession | null;
    if (!active || !active.token || active.token === token) {
      await AsyncStorage.removeItem(ACTIVE_KEY);
    }
  } catch {}
  try {
    const userId = await ensureCloudUser();
    if (userId) await deleteLiveShareRow(token, userId);
  } catch {}
};

export const getActiveLiveSession = async (): Promise<LiveSession | null> => {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as LiveSession | null;
    if (!session || !session.token || session.expiresAt <= Date.now()) {
      await AsyncStorage.removeItem(ACTIVE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

/**
 * O *bearing* do GPS so existe quando ha deslocamento; parado, o Android devolve
 * `null`. O rumo da bussola e sempre disponivel, entao serve de reserva — sem ele
 * o viewer fica sem rumo justamente na emergencia com o aparelho no bolso.
 *
 * Preferimos o GPS quando existe por ser a referencia da plataforma. O rumo da
 * bussola ja vem com a declinacao aplicada (ver `CompassScreen.handleHeading`),
 * entao esta no mesmo referencial do resto do app e nao converte de novo.
 */
export const resolveLiveHeading = (
  gpsHeading: number | null | undefined,
  magneticHeading: number | null | undefined,
): number | null => {
  if (gpsHeading != null && Number.isFinite(gpsHeading)) {
    return gpsHeading;
  }
  if (magneticHeading != null && Number.isFinite(magneticHeading)) {
    return normalizeHeading(magneticHeading);
  }
  return null;
};

export const pushLiveFix = async (
  s: LiveSession,
  fix: LocationFix,
  magneticHeading: number | null = null,
): Promise<boolean> => {
  if (!isCloudEnabled()) return false;
  // A identidade vem sempre daqui, e nao da sessao: o stopLiveShare tambem usa
  // ensureCloudUser(), e um id guardado na sessao poderia nao bater com o dele
  // — a linha ficaria orfa na tabela.
  const userId = await ensureCloudUser();
  if (!userId) return false;
  return pushLivePosition(
    s.token,
    userId,
    fix.latitude,
    fix.longitude,
    fix.accuracy ?? null,
    resolveLiveHeading(fix.heading, magneticHeading),
    s.expiresAt,
  );
};

/**
 * O que o `LiveTrackingService` precisa para assumir o push: o token da linha e
 * o `user_id` que a RLS vai comparar com o `auth.uid()` do JWT.
 *
 * Sai daqui, e nao do modal, para o id continuar vindo de uma fonte so — o
 * `pushLiveFix` e o `stopLiveShare` usam o mesmo `ensureCloudUser()`, e foi
 * justamente um id guardado na sessao que deixou a linha orfa na v7.22.
 */
export const livePushCredentials = async (
  s: LiveSession,
): Promise<{ token: string; userId: string } | null> => {
  if (!isCloudEnabled()) return null;
  const userId = await ensureCloudUser();
  return userId ? { token: s.token, userId } : null;
};

export const shareLiveLink = async (s: LiveSession): Promise<void> => {
  const url = liveLink(s);
  try {
    const { default: Rn } = await import('react-native');
    await Rn.Share.share({ message: url });
  } catch {}
};

export const openLiveInWhatsApp = async (s: LiveSession): Promise<void> => {
  const url = liveLink(s);
  const enc = encodeURIComponent(`Estou ao vivo aqui: ${url}`);
  try {
    const { Linking: L } = await import('react-native');
    await L.openURL(`whatsapp://send?text=${enc}`);
  } catch {}
};

export const openLiveInSms = async (s: LiveSession): Promise<void> => {
  const url = liveLink(s);
  const enc = encodeURIComponent(`Estou ao vivo aqui: ${url}`);
  try {
    const { Linking: L } = await import('react-native');
    await L.openURL(`sms:?body=${enc}`);
  } catch {}
};
