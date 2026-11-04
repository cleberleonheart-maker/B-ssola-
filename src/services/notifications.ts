import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import type { WeatherAlert } from './alertsService';
import type { Translator } from '../i18n/strings';

const CHANNEL_ALERTAS = 'alertas-civis';
const CHANNEL_PRESSAO = 'aviso-pressao';
const CHANNEL_RETORNO = 'aviso-retorno';
const CHANNEL_BEACON = 'beacon-emergencia';

/**
 * O nome do canal e o corpo de fallback sao textos de interface, entao seguem o
 * idioma escolhido no app. Passar o `t` de fora evita o servico depender de
 * contexto React (ele roda fora da arvore, disparado por um timer de 30 min).
 *
 * O canal do Android e imutavel depois de criado: se o utilizador troca de
 * idioma, o nome antigo permanece. Isso e aceitavel porque o id e estavel e o
 * Android so recria o canal se o id mudar.
 */
export const initNotifications = async (t: Translator): Promise<void> => {
  try {
    await notifee.createChannel({
      id: CHANNEL_ALERTAS,
      name: t('al_notif_channel'),
      importance: AndroidImportance.HIGH,
      vibration: true,
    });
  } catch {
    // canal ja existe ou falha nao critica
  }
};

export const showAlertNotification = async (
  alert: WeatherAlert,
  t: Translator,
): Promise<boolean> => {
  try {
    await initNotifications(t);
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      return false;
    }
    await notifee.displayNotification({
      title: `${alert.severity.toUpperCase()} · ${alert.event}`,
      body:
        alert.description ??
        alert.headline ??
        alert.instruction ??
        t('al_notif_fallback'),
      data: { type: 'civil-alert', severity: alert.severity },
      android: {
        channelId: CHANNEL_ALERTAS,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
    return true;
  } catch {
    return false;
  }
};

const initPressureChannel = async (t: Translator): Promise<void> => {
  try {
    await notifee.createChannel({
      id: CHANNEL_PRESSAO,
      name: t('baro_alarm_channel'),
      importance: AndroidImportance.HIGH,
      vibration: true,
    });
  } catch {
    // canal ja existe ou falha nao critica
  }
};

/**
 * Avisa da queda rápida da pressão (ideia #104).
 *
 * É o mesmo mecanismo dos alertas civis, num canal próprio: quem silenciou os
 * avisos civis pode ainda querer o do barómetro, e quem está dentro de uma
 * tenda à noite não vai olhar para o ecrã. O corpo leva o valor da queda, que é
 * o que diz "quanto" sem precisar de abrir a app.
 */
export const showPressureDropNotification = async (
  dropHpa: number,
  t: Translator,
): Promise<boolean> => {
  try {
    await initPressureChannel(t);
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      return false;
    }
    await notifee.displayNotification({
      title: t('baro_alarm_title'),
      body: t('baro_alarm_body', { hpa: Math.abs(Math.round(dropHpa)) }),
      data: { type: 'pressure-drop' },
      android: {
        channelId: CHANNEL_PRESSAO,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Avisa que chegou a hora do beacon de emergência (ideia #6).
 *
 * O telemóvel está muitas vezes no bolso, com o ecrã apagado, quando o beacon
 * vence. A notificação é o que traz o aviso ao mundo real: ao tocar, a app
 * abre no SOS, onde o SMS sai com a posição e a bateria já escritas.
 */
export const showBeaconNotification = async (
  t: Translator,
): Promise<boolean> => {
  try {
    await notifee.createChannel({
      id: CHANNEL_BEACON,
      name: t('beacon_notif_channel'),
      importance: AndroidImportance.HIGH,
      vibration: true,
    });
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      return false;
    }
    await notifee.displayNotification({
      title: t('beacon_notif_title'),
      body: t('beacon_notif_body'),
      data: { type: 'beacon' },
      android: {
        channelId: CHANNEL_BEACON,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
    return true;
  } catch {
    return false;
  }
};

const initReturnChannel = async (t: Translator): Promise<void> => {
  try {
    await notifee.createChannel({
      id: CHANNEL_RETORNO,
      name: t('return_dark_notif_channel'),
      importance: AndroidImportance.HIGH,
      vibration: true,
    });
  } catch {
    // canal ja existe ou falha nao critica
  }
};

/**
 * Avisa que passou a hora-limite de voltar antes do escuro (ideia #23).
 *
 * É o mesmo mecanismo das outras notificações, num canal próprio: a hora-limite
 * costuma passar quando a pessoa está a andar com o telemóvel no bolso, que é
 * exatamente quando uma notificação vale mais do que um cartão no ecrã.
 */
export const showReturnBeforeDarkNotification = async (
  sunsetClock: string,
  t: Translator,
): Promise<boolean> => {
  try {
    await initReturnChannel(t);
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      return false;
    }
    await notifee.displayNotification({
      title: t('return_dark_notif_title'),
      body: t('return_dark_notif_body', { sunset: sunsetClock }),
      data: { type: 'return-before-dark' },
      android: {
        channelId: CHANNEL_RETORNO,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
    return true;
  } catch {
    return false;
  }
};