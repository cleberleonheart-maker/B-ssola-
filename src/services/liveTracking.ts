import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { cloudEndpoint, getCloudAccessToken } from './cloud';

type StartResult = {
  started: boolean;
  backgroundLocation: boolean;
};

type LiveTrackingNative = {
  start: (config: NativeTrackingConfig) => Promise<StartResult>;
  stop: () => Promise<boolean>;
  hasBackgroundLocation: () => Promise<boolean>;
};

/** Espelha o que o `LiveTrackingService` le do Intent. */
type NativeTrackingConfig = {
  token: string;
  userId: string;
  accessToken: string;
  url: string;
  anonKey: string;
  expiresAt: number;
};

export type LiveTrackingRequest = {
  /** Token da sessao (`lnv...`): a chave da linha em `live_shares`. */
  token: string;
  /** Mesmo id que o `pushLiveFix` usaria — a RLS exige `user_id = auth.uid()`. */
  userId: string;
  expiresAt: number;
};

/** Quem esta gravando a posicao na tabela. */
export type LiveTrackingOwner = 'service' | 'js';

export type LiveTrackingResult = {
  /** O servico subiu e ele proprio faz o push. */
  foreground: boolean;
  /** A permissão de localização em background está concedida. */
  backgroundLocation: boolean;
  /**
   * `'service'` quando o nativo assume o push. `'js'` no iOS, sem permissao ou
   * sem credencial: ai o `setInterval` do modal continua sendo quem envia, e so
   * funciona com o app aberto — que e o que o aviso de permissao ja diz.
   */
  owner: LiveTrackingOwner;
};

// Resolvido na chamada, e nao no carregamento do modulo: registrar o
// pacote nativo pode acontecer depois do bundle comecar, e a captura
// antecipada prenderia um `undefined` para sempre.
const getNative = (): LiveTrackingNative | undefined =>
  NativeModules.LiveTracking as LiveTrackingNative | undefined;

const jsFallback = (backgroundLocation: boolean): LiveTrackingResult => ({
  foreground: false,
  backgroundLocation,
  owner: 'js',
});

/**
 * Sobe o foreground service, que passa a ser dono da posição.
 *
 * Antes o servico so mantinha o processo vivo e quem fazia o push era o
 * `setInterval` do JavaScript. Isso resolve o estrangulamento de timer com o
 * app em background, mas nao o processo morto: START_STICKY traz o processo de
 * volta e o `setInterval` so nasce de novo quando o modal do SOS monta — ate
 * la, a linha em `live_shares` ficava parada e quem assistia via "SEM SINAL"
 * sem nenhuma pista de que a sessao seguia ativa.
 *
 * Com o push no servico a posicao nao depende mais do JS existir. O primeiro
 * fix continua sendo enviado pelo JS antes disto: e o que aborta a sessao se o
 * upsert falhar (v7.20), e o servico assume a partir do segundo.
 */
export const startLiveTracking = async (
  req: LiveTrackingRequest,
): Promise<LiveTrackingResult> => {
  const native = getNative();
  if (Platform.OS !== 'android' || !native) return jsFallback(false);

  // Sem endpoint ou sem JWT o push nativo volta 401 e o rastreio morre em
  // silencio: melhor o JS assumir, que pelo menos da para avisar o usuario.
  const endpoint = cloudEndpoint();
  const accessToken = await getCloudAccessToken().catch(() => null);
  if (!endpoint || !accessToken) return jsFallback(false);

  let backgroundLocation = await native
    .hasBackgroundLocation()
    .catch(() => false);
  if (!backgroundLocation) {
    backgroundLocation = await requestBackgroundLocation();
  }
  if (!backgroundLocation) return jsFallback(false);

  const config: NativeTrackingConfig = {
    token: req.token,
    userId: req.userId,
    accessToken,
    url: endpoint.url,
    anonKey: endpoint.anonKey,
    expiresAt: req.expiresAt,
  };

  const res = await native.start(config).catch(() => null);
  return {
    foreground: res?.started === true,
    backgroundLocation: res?.backgroundLocation !== false,
    owner: res?.started === true ? 'service' : 'js',
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
