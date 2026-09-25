import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isCloudEnabled,
  ensureCloudUser,
  pushLivePosition,
  deleteLiveShareRow,
} from './cloud';
import type { LocationFix } from './locationService';

const PREFIX = 'bussola:live:';
const ACTIVE_KEY = 'bussola:live:active';
const MS = 60000;

export interface LiveSession {
  token: string;
  userId: string;
  expiresAt: number;
}

export const liveLink = (s: LiveSession): string =>
  'https://cleberleonheart-maker.github.io/B-ssola-/live.html#tkn=' +
  encodeURIComponent(s.token);

export const liveCountdown = (s: LiveSession): string => {
  const left = s.expiresAt - Date.now();
  if (left <= 0) return '0:00';
  const m = Math.floor(left / MS) % 60;
  const h = Math.floor(left / (MS * 60));
  return `${h}:${String(m).padStart(2, '0')}`;
};

export const startLiveShare = async (
  userId: string,
  minutes: number,
): Promise<LiveSession | null> => {
  if (!isCloudEnabled()) return null;
  const token =
    'lnv' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10);
  const session: LiveSession = {
    token,
    userId,
    expiresAt: Date.now() + Math.max(5, minutes) * MS,
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

export const pushLiveFix = async (
  s: LiveSession,
  fix: LocationFix,
): Promise<boolean> => {
  if (!isCloudEnabled()) return false;
  const userId = s.userId || (await ensureCloudUser());
  if (!userId) return false;
  return pushLivePosition(
    s.token,
    userId,
    fix.latitude,
    fix.longitude,
    fix.accuracy ?? null,
    null,
    s.expiresAt,
  );
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
