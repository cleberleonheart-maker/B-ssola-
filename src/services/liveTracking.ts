import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

type StartResult = {
  started: boolean;
  backgroundLocation: boolean;
};

type LiveTrackingNative = {
  start: (expiresAt: number) => Promise<StartResult>;
  stop: () => Promise<boolean>;
  hasBackgroundLocation: () => Promise<boolean>;
};

// Resolvido na chamada, e nao no carregamento do modulo: registrar o
// pacote nativo pode acontecer depois do bundle comecar, e a captura
// anticipada prenderia um `undefined` para sempre.
const getNative = (): LiveTrackingNative | undefined =>
  NativeModules.LiveTracking as LiveTrackingNative | undefined;

export type LiveTrackingResult = {
  /** O foreground service subiu, ou seja, o timer do JS deve sobreviver. */
  foreground: boolean;
  /** A permissão de localização em background está concedida. */
  backgroundLocation: boolean;
};

const unavailable: LiveTrackingResult = {
  foreground: false,
  backgroundLocation: false,
};

/**
 * Mantém o rastreio ao vivo funcionando com a tela apagada.
 *
 * O push é um `setInterval` de JavaScript. Sem foreground service o Android
 * estrangula esse timer e o `LocationManager` para de entregar fix assim que
 * o app sai de foreground — que é justamente o caso de uso, com o aparelho no
 * bolso. O serviço nativo só promove o processo; o push continua no JS.
 */
export const startLiveTracking = async (
  expiresAt: number,
): Promise<LiveTrackingResult> => {
  const native = getNative();
  if (Platform.OS !== 'android' || !native) return unavailable;

  let backgroundLocation = await native.hasBackgroundLocation().catch(() => false);
  if (!backgroundLocation) {
    backgroundLocation = await requestBackgroundLocation();
  }
  if (!backgroundLocation) return { foreground: false, backgroundLocation: false };

  const res = await native.start(expiresAt).catch(() => null);
  return {
    foreground: res?.started === true,
    backgroundLocation: res?.backgroundLocation !== false,
  };
};

export const stopLiveTracking = async (): Promise<void> => {
  const native = getNative();
  if (Platform.OS !== 'android' || !native) return;
  await native.stop().catch(() => {});
};

export const hasBackgroundLocation = async (): Promise<boolean> => {
  const native = getNative();
  if (Platform.OS !== 'android' || !native) return false;
  return native.hasBackgroundLocation().catch(() => false);
};

const requestBackgroundLocation = async (): Promise<boolean> => {
  // Android 10+ separa a permissão de background; em Android 11+ o diálogo
  // só aparece se a localização em primeiro plano já estiver concedida.
  const perm = PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
  if (!perm) return false;
  try {
    const result = await PermissionsAndroid.request(perm, {
      title: 'Localização em segundo plano',
      message:
        'O rastreio ao vivo precisa continuar enviando sua posição com a tela ' +
        'apagada. Sem isso, quem acompanha o link vê "sem sinal" numa emergência.',
      buttonNeutral: 'Agora não',
      buttonNegative: 'Não',
      buttonPositive: 'Permitir',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};
