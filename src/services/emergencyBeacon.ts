import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { loadEmergencyContact, saveEmergencyContact as saveEmergencyContactPref, loadBeaconEnabled, saveBeaconEnabled, loadBeaconInterval, saveBeaconInterval } from './preferencesService';

const CONTACT_KEY = '@bussola/emergencyContact';
const ENABLED_KEY = '@bussola/emergencyBeaconEnabled';
const INTERVAL_KEY = '@bussola/emergencyBeaconInterval';

export type BeaconConfig = {
  enabled: boolean;
  contact: string;
  intervalMinutes: number;
};

export const loadBeaconConfig = async (): Promise<BeaconConfig> => {
  try {
    const [enabled, contact, interval] = await Promise.all([loadBeaconEnabled(), loadEmergencyContact(), loadBeaconInterval()]);
    return { enabled, contact: contact || '', intervalMinutes: interval || 30 };
  } catch {
    return { enabled: false, contact: '', intervalMinutes: 30 };
  }
};

export const saveBeaconConfig = async (cfg: Partial<BeaconConfig>) => {
  if (cfg.enabled != null) await saveBeaconEnabled(cfg.enabled);
  if (cfg.contact != null) await saveEmergencyContactPref(cfg.contact);
  if (cfg.intervalMinutes != null) await saveBeaconInterval(cfg.intervalMinutes);
};

export const loadEmergencyContact = async (): Promise<string> => {
  return loadEmergencyContact();
};

export const saveEmergencyContact = async (contact: string) => {
  await saveEmergencyContactPref(contact);
};

export const loadBeaconEnabled = async (): Promise<boolean> => {
  return loadBeaconEnabled();
};

export const saveBeaconEnabled = async (enabled: boolean) => {
  await saveBeaconEnabled(enabled);
};

export const loadBeaconInterval = async (): Promise<number> => {
  return loadBeaconInterval();
};

export const saveBeaconInterval = async (m: number) => {
  await saveBeaconInterval(m);
};

export const buildBeaconMessage = (params: {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  altitude?: number | null;
  battery?: number | null;
  network?: string | null;
  time?: Date;
}) => {
  const t = params.time || new Date();
  const lat = params.latitude != null ? params.latitude.toFixed(6) : '?';
  const lon = params.longitude != null ? params.longitude.toFixed(6) : '?';
  const acc = params.accuracy != null ? Math.round(params.accuracy) : '?';
  const alt = params.altitude != null ? Math.round(params.altitude) : '?';
  const bat = params.battery != null ? Math.round(params.battery) : '?';
  const net = params.network || '?';
  const maps = params.latitude != null && params.longitude != null ? `https://maps.google.com/?q=${params.latitude},${params.longitude}` : '';
  return `SOS BEACON Bussola\n${t.toISOString()}\nLat:${lat} Lon:${lon} acc:${acc}m alt:${alt}m\nBateria:${bat}% Rede:${net}\n${maps}`.trim();
};

export const sendBeaconSms = async (contact: string, message: string) => {
  if (!contact) return false;
  const url = `sms:${encodeURIComponent(contact)}?body=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    try {
      await Linking.openURL(`sms:${contact}`);
      return true;
    } catch {
      return false;
    }
  }
};
