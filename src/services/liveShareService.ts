import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeHeading } from '../utils/compass';
import {
  isCloudEnabled,
  ensureCloudUser,
  pushLivePosition,
  pushLivePoint,
  deleteLiveShareRow,
  markLiveShareStopped,
  deleteExpiredLivePoints,
  noteCloudError,
  takeCloudError,
} from './cloud';
import type { LocationFix } from './locationService';

/**
 * Motivo da falha, para o Alert deixar de dizer só "não foi possível".
 *
 * O `📡` que não arranca é o pior caso do app: a pessoa está numa emergência e o
 * ecrã recusa-se sem dizer porquê. O `console.warn` sozinho não chega, porque
 * ninguém vai abrir o Metro numa emergência — a causa vai no próprio diálogo.
 */
export const livePushError = (): string | null => takeCloudError();

const PREFIX = 'bussola:live:';
const ACTIVE_KEY = 'bussola:live:active';
const MS_PER_MIN = 60000;

export interface LiveSession {
  token: string;
  expiresAt: number;
}

export const liveLink = (s: LiveSession): string =>
  'https://cleberleonheart-maker.github.io/B-ssola-/live.html#tkn=' +
  encodeURIComponent(s.token);

export const liveCountdown = (s: LiveSession): string => {
  const left = s.expiresAt - Date.now();
  if (left <= 0) return '0:00';
  const m = Math.floor(left / MS_PER_MIN) % 60;
  const h = Math.floor(left / (MS_PER_MIN * 60));
  return `${h}:${String(m).padStart(2, '0')}`;
};

/**
 * Texto curto da duração escolhida: "15 min", "1 h", "2 h".
 *
 * Horas cheias viram "h" para o chip do seletor não ficar largo nem quebrar a
 * linha; o resto sai com uma casa decimal. O mínimo de 5 min é o mesmo de
 * `startLiveShare`, para o rótulo nunca prometer menos do que a sessão dura.
 */
export const liveDurationLabel = (minutes: number): string => {
  const safe = Math.max(5, Math.round(minutes));
  if (safe < 60) return `${safe} min`;
  const hours = safe / 60;
  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
};

export const startLiveShare = async (
  minutes: number,
): Promise<LiveSession | null> => {
  if (!isCloudEnabled()) return null;
  const token =
    'lnv' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10);
  const session: LiveSession = {
    token,
    expiresAt: Date.now() + Math.max(5, minutes) * MS_PER_MIN,
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
    if (!userId) return;
    // O caminho bom é marcar (#100): a linha fica e o histórico passa a
    // saber que esta sessão existiu, quando começou e quando acabou. O
    // DELETE é a reserva — uma sessão que não conseguiu ser marcada não pode
    // ficar viva a partilhar posição, que é o pior dos dois mundos.
    const marcada = await markLiveShareStopped(token, userId);
    if (!marcada) await deleteLiveShareRow(token, userId);
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

/**
 * O *bearing* do GPS só existe quando ha deslocamento; parado, o Android devolve
 * `null`. O rumo da bussola e sempre disponivel, entao serve de reserva — sem ele
 * o viewer fica sem rumo justamente na emergencia com o aparelho no bolso.
 *
 * Preferimos o GPS quando existe por ser a referencia da plataforma. O rumo da
 * bussola ja vem com a declinacao aplicada (ver `CompassScreen.handleHeading`),
 * entao esta no mesmo referencial do resto do app e nao converte de novo.
 *
 * As duas regras abaixo — `>= 0` e normalizar para 0–360 — existem para bater
 * certo com o `resolveLiveHeading` do Kotlin, que toma as decisões a partir do
 * primeiro fix. Sem elas os dois lados discordavam em 360 (um escrevia "360°" no
 * viewer, que parece leitura quebrada) e nos negativos, que são o sentinel do
 * `hasBearing()`: o serviço tratava o -1 como "sem bearing" e caía na reserva,
 * e o JS publicava-o como se fosse um rumo. `__tests__/liveHeadingParity.test.ts`
 * corre os dois sobre o mesmo fixture.
 */
export const resolveLiveHeading = (
  gpsHeading: number | null | undefined,
  magneticHeading: number | null | undefined,
): number | null => {
  if (gpsHeading != null && Number.isFinite(gpsHeading) && gpsHeading >= 0) {
    return normalizeHeading(gpsHeading);
  }
  if (magneticHeading != null && Number.isFinite(magneticHeading)) {
    return normalizeHeading(magneticHeading);
  }
  return null;
};


/**
 * Apaga, uma vez por sessão da app, os nossos pontos de sessões já acabadas.
 *
 * A que fica por apanhar é sempre a mesma: a de uma sessão que morreu sem
 * `stopLiveShare` — app fechada à força, crash, ou o próprio delete a falhar
 * sem rede. Essas linhas não têm token com que ir buscá-las, e como ninguém
 * usava o `expires_at`, ficavam na base para sempre. A RPC já as escondia, o
 * que resolvia a leitura e não o armazenamento — e não o facto de a pessoa que
 * parou de partilhar ter o trajecto dela guardado na mesma.
 *
 * Uma vez por processo chega: o que se junta durante a sessão atual é pouco e
 * vai ser apanhado da próxima vez. E uma limpeza que corresse de 10 em 10
 * segundos seria um pedido por minuto para apanhar o mesmo lixo.
 */
let purgaDePontosFeita = false;

const purgeExpiredPointsOnce = async (userId: string): Promise<void> => {
  if (purgaDePontosFeita) return;
  // Marca-se antes de correr, e não depois: se a limpeza falhar, repetir a cada
  // 10 segundos seria pior do que deixar para a próxima vez que a app abrir.
  purgaDePontosFeita = true;
  // O `catch` não é sobra. `void` cala o linter, não a runtime: uma promessa
  // rejeitada sem handler é um unhandled rejection, que em Node mata o
  // processo inteiro. Foi assim que este teste o apanhou, e o mesmo
  // aconteceria num arranque real.
  await deleteExpiredLivePoints(userId).catch(() => {});
};

export const pushLiveFix = async (
  s: LiveSession,
  fix: LocationFix,
  magneticHeading: number | null = null,
): Promise<boolean> => {
  if (!isCloudEnabled()) {
    noteCloudError('cloud desligada', 'SUPABASE_URL/ANON_KEY ausentes');
    return false;
  }
  // A identidade vem sempre daqui, e nao da sessao: o stopLiveShare tambem usa
  // ensureCloudUser(), e um id guardado na sessao poderia nao bater com o dele
  // — a linha ficaria orfa na tabela.
  const userId = await ensureCloudUser();
  if (!userId) return false;
  // Sem await: é higiene de fundo e não pode atrasar o ponto de 10 em 10
  // segundos. E antes de gravar, para que uma limpeza lenta não atrase o
  // primeiro `push` de quem acabou de abrir o link — que é quando a pessoa
  // está à espera de ver que ele arrancou.
  void purgeExpiredPointsOnce(userId);
  const heading = resolveLiveHeading(fix.heading, magneticHeading);
  const pushed = await pushLivePosition(
    s.token,
    userId,
    fix.latitude,
    fix.longitude,
    fix.accuracy ?? null,
    heading,
    s.expiresAt,
  );
  if (!pushed) return false;
  // A posicao actual e o que mantem o link vivo; o ponto e o trajecto (#92).
  // Vem depois e sem bloquear: se esta gravacao falhar, quem esta a ver o link
  // continua a ver para onde a pessoa esta agora, so com um troco a menos no
  // caminho. O inverso — gravar o ponto e falhar a posicao — deixaria o link
  // morto com pontos ja publicados.
  await pushLivePoint(
    s.token,
    userId,
    fix.latitude,
    fix.longitude,
    fix.accuracy ?? null,
    heading,
    fix.speed ?? null,
    fix.altitude ?? null,
    s.expiresAt,
  );
  return true;
};

/**
 * O que o `LiveTrackingService` precisa para assumir o push: o token da linha e
 * o `user_id` que a RLS vai comparar com o `auth.uid()` do JWT.
 *
 * Sai daqui, e nao do modal, para o id continuar vindo de uma fonte so — o
 * `pushLiveFix` e o `stopLiveShare` usam o mesmo `ensureCloudUser()`, e foi
 * justamente um id guardado na sessao que deixou a linha orfa na v7.22.
 */
export const livePushCredentials = async (
  s: LiveSession,
): Promise<{ token: string; userId: string } | null> => {
  if (!isCloudEnabled()) return null;
  const userId = await ensureCloudUser();
  return userId ? { token: s.token, userId } : null;
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
