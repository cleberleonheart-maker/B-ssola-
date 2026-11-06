import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

/**
 * Envio do SOS em silêncio (ideia #107).
 *
 * O beacon abria a app de SMS com o texto escrito: quem estivesse a ser
 * assaltado tinha de tocar em "enviar", com o ecrã à vista de toda a gente.
 * Aqui o SMS sai direto do módulo nativo e o telemóvel continua exactamente
 * como estava.
 *
 * A permissão `SEND_SMS` é pedida antes — nas definições, ao guardar o
 * contacto de emergência. Pedir a meio de uma agressão seria uma coisa a
 * menos entre a pessoa e o aviso.
 */

type SosSenderNative = {
  canSend?: () => Promise<boolean>;
  sendSms?: (contact: string, message: string) => Promise<string>;
  cacheContact?: (contact: string) => Promise<boolean>;
  cacheFix?: (
    lat: number,
    lon: number,
    accuracy: number,
    alt: number,
    at: number,
  ) => Promise<boolean>;
  cacheBattery?: (percent: number) => Promise<boolean>;
  cachedState?: () => Promise<{
    contact?: string;
    battery?: number;
    pending?: boolean;
    hasCloud?: boolean;
    lat?: number;
    lon?: number;
    fixAt?: number;
  }>;
  cacheCloud?: (
    refreshToken: string,
    url: string,
    anonKey: string,
    userId: string,
    livePageUrl: string,
    liveMinutes: number,
  ) => Promise<boolean>;
};

const SosSender = (NativeModules as { SosSender?: SosSenderNative }).SosSender ?? null;

export type SosSendResult = 'sent' | 'no_permission' | 'invalid' | 'failed' | 'unsupported';

/** O módulo nativo existe (só no Android)? */
export const sosSenderSupported = Platform.OS === 'android' && !!SosSender?.sendSms;

/** A permissão de enviar SMS já foi concedida? */
export const canSendSmsSilently = async (): Promise<boolean> => {
  if (!SosSender?.canSend) return false;
  try {
    return await SosSender.canSend();
  } catch {
    return false;
  }
};

/**
 * Pede a permissão de enviar SMS.
 *
 * No iOS não existe (e também não há este caminho), por isso devolve `false`.
 */
export const requestSmsPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const resultado = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: 'Enviar o SOS',
        message:
          'A app precisa desta permissão para enviar o aviso de emergência sem abrir a app de SMS.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Agora não',
      },
    );
    return resultado === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

/**
 * Manda o SMS sem abrir nada.
 *
 * Devolve `unsupported` quando não há módulo nativo e `no_permission` quando
 * a permissão não foi dada — nos dois casos quem chama tem de cair no
 * compositor de SMS, que é o caminho antigo.
 */
export const sendSmsSilently = async (
  contact: string,
  message: string,
): Promise<SosSendResult> => {
  if (!SosSender?.sendSms) return 'unsupported';
  try {
    const resultado = await SosSender.sendSms(contact, message);
    if (
      resultado === 'sent' ||
      resultado === 'no_permission' ||
      resultado === 'invalid' ||
      resultado === 'failed'
    ) {
      return resultado;
    }
    return 'failed';
  } catch {
    return 'failed';
  }
};

/**
 * O que o nativo sabe para mandar o aviso sem a app aberta.
 *
 * A tile do SOS dispara o aviso com o telemóvel bloqueado e a app morta: o
 * nativo precisa de saber para quem avisar e onde a pessoa estava. O
 * JavaScript escreve aqui o que sabe — o contacto, a última posição e a
 * bateria — e o nativo lê quando o aviso é disparado.
 *
 * Tudo isto é cache: falhar não pode estragar o que o app faz a seguir, por
 * isso cada escrita é engolida se o módulo nativo não estiver lá.
 */

/** O contacto de emergência, para o aviso sair sem a app aberta. */
export const cacheEmergencyContact = async (contact: string): Promise<void> => {
  if (!SosSender?.cacheContact) return;
  try {
    await SosSender.cacheContact(contact || '');
  } catch {
    // sem cache, o aviso tem de ser mandado com a app aberta
  }
};

/** A última posição, para o aviso levar as coordenadas. */
export const cacheFix = async (fix: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  updatedAt?: number | null;
}): Promise<void> => {
  if (!SosSender?.cacheFix) return;
  if (!Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude)) return;
  try {
    await SosSender.cacheFix(
      fix.latitude,
      fix.longitude,
      typeof fix.accuracy === 'number' && isFinite(fix.accuracy) ? fix.accuracy : NaN,
      typeof fix.altitude === 'number' && isFinite(fix.altitude) ? fix.altitude : NaN,
      typeof fix.updatedAt === 'number' && isFinite(fix.updatedAt)
        ? fix.updatedAt
        : Date.now(),
    );
  } catch {
    // idem
  }
};

/** A última percentagem de bateria conhecida. */
export const cacheBattery = async (percent: number | null): Promise<void> => {
  if (!SosSender?.cacheBattery) return;
  if (typeof percent !== 'number' || !isFinite(percent)) return;
  try {
    await SosSender.cacheBattery(percent);
  } catch {
    // idem
  }
};

/**
 * As credenciais da nuvem, para o aviso conseguir criar a sessão de
 * rastreio sem a app aberta.
 *
 * O refresh token e o que interessa (o access token expira em uma hora); o
 * URL e a anon key são públicos e a página do rastreio é a mesma que o app
 * partilha — vêm todos do JavaScript para que haja uma só cópia de cada.
 */
export const cacheCloudCredentials = async (creds: {
  refreshToken: string;
  url: string;
  anonKey: string;
  userId: string;
  livePageUrl: string;
  liveMinutes: number;
}): Promise<void> => {
  if (!SosSender?.cacheCloud) return;
  if (!creds.refreshToken || !creds.url || !creds.anonKey || !creds.userId) return;
  try {
    await SosSender.cacheCloud(
      creds.refreshToken,
      creds.url,
      creds.anonKey,
      creds.userId,
      creds.livePageUrl || '',
      creds.liveMinutes || 30,
    );
  } catch {
    // sem cache, o aviso sai na mesma — só sem o link do rastreio
  }
};

/** O estado do cache nativo (para o diagnóstico e os testes). */
export const getCachedSosState = async (): Promise<{
  contact: string;
  battery: number | null;
  pending: boolean;
  lat: number | null;
  lon: number | null;
  fixAt: number | null;
} | null> => {
  if (!SosSender?.cachedState) return null;
  try {
    const state = await SosSender.cachedState();
    if (!state) return null;
    return {
      contact: state.contact ?? '',
      battery: typeof state.battery === 'number' && state.battery >= 0 ? state.battery : null,
      pending: !!state.pending,
      lat: typeof state.lat === 'number' ? state.lat : null,
      lon: typeof state.lon === 'number' ? state.lon : null,
      fixAt: typeof state.fixAt === 'number' ? state.fixAt : null,
    };
  } catch {
    return null;
  }
};
