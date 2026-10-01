import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import type { WeatherAlert } from './alertsService';
import type { Translator } from '../i18n/strings';

const CHANNEL_ALERTAS = 'alertas-civis';

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