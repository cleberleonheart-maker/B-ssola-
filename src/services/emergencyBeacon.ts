import { Linking, Platform } from 'react-native';
import {
  loadBeaconEnabled as loadBeaconEnabledPref,
  loadBeaconInterval as loadBeaconIntervalPref,
  loadEmergencyContact as loadEmergencyContactPref,
  saveBeaconEnabled as saveBeaconEnabledPref,
  saveBeaconInterval as saveBeaconIntervalPref,
  saveEmergencyContact as saveEmergencyContactPref,
} from './preferencesService';
import {
  buildBeaconMessage,
  clampBeaconInterval,
  DEFAULT_BEACON_INTERVAL_MINUTES,
  type BeaconMessageParams,
} from '../utils/beacon';
import { toInternationalPhone } from './phoneNumberService';

export type BeaconConfig = {
  enabled: boolean;
  contact: string;
  intervalMinutes: number;
};

/** Config do beacon: o que está gravado, já com o intervalo normalizado. */
export const loadBeaconConfig = async (): Promise<BeaconConfig> => {
  try {
    const [enabled, contact, interval] = await Promise.all([
      loadBeaconEnabledPref(),
      loadEmergencyContactPref(),
      loadBeaconIntervalPref(),
    ]);
    return {
      enabled,
      contact: contact || '',
      intervalMinutes: clampBeaconInterval(interval || DEFAULT_BEACON_INTERVAL_MINUTES),
    };
  } catch {
    return {
      enabled: false,
      contact: '',
      intervalMinutes: DEFAULT_BEACON_INTERVAL_MINUTES,
    };
  }
};

export const saveBeaconConfig = async (cfg: Partial<BeaconConfig>) => {
  if (cfg.enabled != null) await saveBeaconEnabledPref(cfg.enabled);
  if (cfg.contact != null) await saveEmergencyContactPref(cfg.contact);
  if (cfg.intervalMinutes != null) {
    await saveBeaconIntervalPref(clampBeaconInterval(cfg.intervalMinutes));
  }
};

/**
 * Passa o contacto guardado para o formato internacional.
 *
 * Quem guardou o número local ("21999990000") fica com ele assim até aqui.
 * O WhatsApp diz que esse número não está no WhatsApp — e está; o formato é
 * que não bate — e o SMS vai para um número que não existe. Passando pelo
 * país do telemóvel, o número guardado passa a ser o número a sério, e
 * gravá-lo corrigido evita que o problema volte.
 */
export const normalizeBeaconContact = async (
  contact: string,
): Promise<{ contact: string; changed: boolean }> => {
  if (!contact) return { contact, changed: false };
  const international = await toInternationalPhone(contact);
  if (!international || international === contact) {
    return { contact, changed: false };
  }
  await saveEmergencyContactPref(international);
  return { contact: international, changed: true };
};

/** Texto do SMS do beacon. */
export const buildMessage = (params: BeaconMessageParams): string =>
  buildBeaconMessage(params);

/**
 * Abre a app de SMS com a mensagem pronta para o contacto.
 *
 * O Android e o iOS não deixam as apps enviarem SMS sem permissão explícita
 * (e a Play Store restringe essa permissão), por isso o app abre o compositor
 * com o texto e o número já lá dentro: quem está em emergência toca em
 * "enviar". Devolve `false` quando não há app de SMS para abrir.
 */
export const sendBeaconSms = async (
  contact: string,
  message: string,
): Promise<boolean> => {
  if (!contact) return false;
  const body = encodeURIComponent(message);
  // O número não vai codificado: o `+` de E.164 codificado (%2B) é
  // interpretado por alguns apps de SMS como o fim do número.
  const number = contact.replace(/[^\d+]/g, '');
  const url =
    Platform.OS === 'ios' ? `sms:${number}&body=${body}` : `sms:${number}?body=${body}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    try {
      await Linking.openURL(`sms:${number}`);
      return true;
    } catch {
      return false;
    }
  }
};
