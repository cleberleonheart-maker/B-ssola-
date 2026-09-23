import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import type { WeatherAlert } from './alertsService';

const CHANNEL_ALERTAS = 'alertas-civis';

export const initNotifications = async (): Promise<void> => {
  try {
    await notifee.createChannel({
      id: CHANNEL_ALERTAS,
      name: 'Alertas Civis',
      importance: AndroidImportance.HIGH,
      vibration: true,
    });
  } catch {
    // canal ja existe ou falha nao critica
  }
};

export const showAlertNotification = async (
  alert: WeatherAlert,
): Promise<boolean> => {
  try {
    await initNotifications();
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
        'Alerta meteorologico na sua regiao.',
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