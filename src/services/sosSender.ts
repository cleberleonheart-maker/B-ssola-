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
