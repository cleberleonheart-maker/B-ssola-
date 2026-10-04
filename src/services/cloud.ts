import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL: string = 'https://wotzcykrvidbjkonaawx.supabase.co';
const SUPABASE_ANON_KEY: string = 'sb_publishable_g8EcCQe4YPGaeMz1V-8gIw_OxF3iLNv';

export const isCloudEnabled = (): boolean =>
  SUPABASE_URL !== 'COLE_A_URL_DO_SUPABASE' &&
  SUPABASE_ANON_KEY !== 'COLE_A_CHAVE_ANON' &&
  SUPABASE_URL.startsWith('https://');

export type CloudEndpoint = {
  url: string;
  anonKey: string;
};

/**
 * URL e anon key para quem fala com o Supabase fora do `supabase-js` — hoje
 * só o `LiveTrackingService`, que faz o push da posição em Kotlin.
 *
 * Continua vindo daqui, e não de uma cópia no Kotlin: a RLS de `live_shares`
 * compara `user_id` com `auth.uid()`, e dois lugares com credenciais diferentes
 * é exatamente o tipo de armadilha que a v7.22 removendo `LiveSession.userId`.
 */
export const cloudEndpoint = (): CloudEndpoint | null =>
  isCloudEnabled() ? { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } : null;

let client: SupabaseClient | null = null;
// A excepcao do `createClient` ficava so no Metro, e o unico sintoma no aparelho
// era "cliente nao configurado" — que parece problema de configuracao quando o
// problema e o ambiente. Fica aqui para o Alert mostrar a frase verdadeira.
let clientError: string | null = null;
if (isCloudEnabled()) {
  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (e) {
    clientError = e instanceof Error ? e.message : String(e);
    console.warn('[cloud] falha ao criar cliente Supabase', clientError);
  }
}

export type CloudHistoryEntry = {
  role: 'user' | 'assistant';
  text: string;
  at: number;
};

export type CloudMemoryDoc = {
  facts: Record<string, string>;
  history: CloudHistoryEntry[];
};

export type CloudMemoryRow = CloudMemoryDoc & {
  user_id: string;
  updated_at: string;
};

const withTimeout = <T,>(
  promise: PromiseLike<T>,
  ms = 6000,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('cloud_timeout')), ms);
    Promise.resolve(promise).then(
      value => {
        clearTimeout(id);
        resolve(value);
      },
      error => {
        clearTimeout(id);
        reject(error);
      },
    );
  });

const warnDisabled = (): void => {
  if (!client) {
    console.warn(
      '[Kefera] Nuvem não configurada. Configure SUPABASE_URL e SUPABASE_ANON_KEY para sincronizar a memória.',
    );
  }
};

let currentUserId: string | null | undefined;
let ensurePromise: Promise<string | null> | null = null;

/**
 * Motivo da última falha de nuvem, para o erro na tela deixar de ser genérico.
 *
 * Antes desta variável, um `📡` que não arrancava dizia só "não foi possível
 * iniciar o rastreio ao vivo": `pushLivePosition` devolvia `!error` sem guardá-lo
 * e `ensureCloudUser` engolia a exceção. O Supabase estava inteiro — tabela,
 * policy, chave, auth anónimo — e a única pista na mão era o texto do alerta,
 * o que obriga a eliminar por tentativa. Guarda-se a causa e mostra-se.
 *
 * Nunca inclui o token nem a key: é lida por um humano, e vai para o Alert.
 */
let lastCloudError: string | null = null;

/** Lê e limpa a última falha de nuvem. */
export const takeCloudError = (): string | null => {
  const error = lastCloudError;
  lastCloudError = null;
  return error;
};

export const noteCloudError = (scope: string, error: unknown): void => {
  const message =
    error instanceof Error ? error.message : String(error ?? 'desconhecido');
  lastCloudError = `${scope}: ${message}`;
  console.warn(`[cloud] ${lastCloudError}`);
};

export const ensureCloudUser = async (): Promise<string | null> => {
  if (!client) {
    warnDisabled();
    noteCloudError('cliente', clientError ?? 'Supabase nao configurado');
    return null;
  }
  if (currentUserId) {
    return currentUserId;
  }
  if (ensurePromise) {
    return ensurePromise;
  }
  ensurePromise = (async () => {
    try {
      // 15 s, e não os 6 s do default: em dados móveis um round-trip de auth a
      // frio passa facilmente disso, e o timeout virava "não foi possível iniciar
      // o rastreio" sem que houvesse nada de errado com o Supabase.
      const { data, error: sessionError } = await withTimeout(
        client.auth.getSession(),
        15000,
      );
      if (sessionError) {
        noteCloudError('sessao', sessionError.message);
      }
      if (data?.session?.user) {
        currentUserId = data.session.user.id;
        return currentUserId;
      }
      const { data: signInData, error: signInError } = await withTimeout(
        client.auth.signInAnonymously(),
        15000,
      );
      // O `error` era descartado e o Alert dizia "sem user id na resposta", o
      // que manda procurar um bug no parsing quando a causa está sempre aqui:
      // com o provider anónimo desligado no projeto, o GoTrue responde 422
      // `anonymous_provider_disabled` e é essa frase que tem de chegar ao ecrã.
      if (signInError) {
        noteCloudError('login anonimo', signInError.message);
        currentUserId = null;
        return null;
      }
      currentUserId = signInData?.user?.id ?? null;
      if (!currentUserId) {
        noteCloudError('login anonimo', 'sem user id na resposta');
      }
      return currentUserId;
    } catch (error) {
      noteCloudError('login anonimo', error);
      currentUserId = null;
      return null;
    }
  })();
  ensurePromise.finally(() => {
    ensurePromise = null;
  }).catch(() => {});
  return ensurePromise;
};

/**
 * Token de acesso da sessão (JWT) do usuário da nuvem.
 *
 * O `LiveTrackingService` precisa dele para escrever em `live_shares`: a RLS
 * só aceita `user_id = auth.uid()`, e o `uid()` vem do token, não de um
 * parâmetro. Sem ele o push nativo voltaria 401 e o rastreio morreria em
 * silêncio — daí `null` ser tratado como "não dá para subir o serviço".
 */
export const getCloudAccessToken = async (): Promise<string | null> => {
  if (!client) return null;
  try {
    const { data } = await withTimeout(client.auth.getSession());
    const token = data?.session?.access_token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
};

export const fetchCloudMemory = async (
  userId: string,
): Promise<CloudMemoryRow | null> => {
  if (!client) {
    return null;
  }
  try {
    const { data, error } = await withTimeout(
      client
        .from('virgin_memory')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
    );
    if (error) {
      console.warn('[Kefera] Falha ao buscar memória na nuvem', error.message);
      return null;
    }
    return (data as CloudMemoryRow) ?? null;
  } catch {
    return null;
  }
};

export const pushCloudMemory = async (
  userId: string,
  doc: CloudMemoryDoc,
): Promise<boolean> => {
  if (!client) {
    return false;
  }
  try {
    const { error } = await withTimeout(
      client.from('virgin_memory').upsert(
        {
          user_id: userId,
          facts: doc.facts,
          history: doc.history,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      ),
    );
    if (error) {
      console.warn('[Kefera] Falha ao enviar memória para a nuvem', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export type AppVersion = {
  version_code: number;
  version_name: string;
  update_url: string;
  message: string | null;
  required: boolean;
};

type CloudRecord = {
  id: string;
  data: unknown;
  updated_at: string;
};

const pushRecords = async (
  table: string,
  userId: string,
  items: { id: string; data: unknown }[],
): Promise<boolean> => {
  if (!client) {
    return false;
  }
  try {
    const rows = items.map(item => ({
      user_id: userId,
      id: item.id,
      data: item.data,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await withTimeout(
      client.from(table).upsert(rows, { onConflict: 'id' }),
    );
    if (error) {
      console.warn(`[cloud] falha ao salvar ${table}`, error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const fetchRecords = async (
  table: string,
  userId: string,
): Promise<CloudRecord[]> => {
  if (!client) {
    return [];
  }
  try {
    const { data, error } = await withTimeout(
      client
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(50),
    );
    if (error) {
      console.warn(`[cloud] falha ao buscar ${table}`, error.message);
      return [];
    }
    return (data as CloudRecord[] | null) ?? [];
  } catch {
    return [];
  }
};

export const pushTracks = async (
  userId: string,
  items: { id: string; data: unknown }[],
): Promise<boolean> => pushRecords('tracks', userId, items);

export const fetchCloudTracks = async (
  userId: string,
  table: 'tracks' = 'tracks',
): Promise<CloudRecord[]> => fetchRecords(table, userId);

export const pushNotes = async (
  userId: string,
  items: { id: string; data: unknown }[],
): Promise<boolean> => pushRecords('notes', userId, items);

export const fetchCloudNotes = async (
  userId: string,
): Promise<CloudRecord[]> => fetchRecords('notes', userId);

export const fetchLatestAppVersion = async (): Promise<AppVersion | null> => {
  if (!client) {
    return null;
  }
  try {
    const { data, error } = await withTimeout(
      client
        .from('app_version')
        .select('*')
        .order('version_code', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    if (error) {
      console.warn(
        '[Kefera] Falha ao verificar versão na nuvem',
        error.message,
      );
      return null;
    }
    return (data as AppVersion | null) ?? null;
  } catch {
    return null;
  }
};

export type LiveShareRow = {
  token: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  started_at: string;
  expires_at: string;
  updated_at: string;
};

export const pushLivePosition = async (
  token: string,
  userId: string,
  lat: number,
  lng: number,
  acc: number | null,
  hdg: number | null,
  expiresAt: number,
): Promise<boolean> => {
  if (!client) {
    noteCloudError('live push', 'Supabase nao configurado');
    return false;
  }
  try {
    const { error } = await withTimeout(
      client.from('live_shares').upsert(
        {
          token,
          user_id: userId,
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          heading: hdg,
          expires_at: new Date(expiresAt).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' },
      ),
      15000,
    );
    if (error) {
      noteCloudError('live push', error.message);
      return false;
    }
    return true;
  } catch (error) {
    noteCloudError('live push', error);
    return false;
  }
};

/**
 * Acrescenta um ponto ao trajecto da sessao (#92).
 *
 * `live_shares` guarda um unico ponto por token — um `upsert` sobrescreve o
 * anterior — e por isso nao guardava o caminho percorrido. Esta e a segunda
 * tabela: um `insert` por fix, com o servidor a numerar (`id`), que e o que o
 * viewer usa para pedir so o que ainda nao viu.
 *
 * Devolve `false` sem lancar pelo mesmo motivo de `pushLivePosition`: perder um
 * ponto e melhor do que perder a sessao. Quem chama grava a posicao actual
 * primeiro e so depois o ponto, portanto um `false` aqui deixa um buraco no
 * trajecto e nada mais.
 */
export const pushLivePoint = async (
  token: string,
  userId: string,
  lat: number,
  lng: number,
  acc: number | null,
  hdg: number | null,
  spd: number | null,
  alt: number | null,
  expiresAt: number,
): Promise<boolean> => {
  if (!client) {
    noteCloudError('live point', 'Supabase nao configurado');
    return false;
  }
  try {
    const { error } = await withTimeout(
      client.from('live_points').insert({
        token,
        user_id: userId,
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        heading: hdg,
        speed: spd,
        altitude: alt,
        expires_at: new Date(expiresAt).toISOString(),
      }),
      15000,
    );
    if (error) {
      noteCloudError('live point', error.message);
      return false;
    }
    return true;
  } catch (error) {
    noteCloudError('live point', error);
    return false;
  }
};

export const deleteLiveShareRow = async (
  token: string,
  userId: string,
): Promise<boolean> => {
  if (!client) return false;
  try {
    await withTimeout(
      client.from('live_shares').delete().eq('token', token).eq('user_id', userId),
    );
    // O trajecto segue a linha: uma sessao encerrada tem de levar os pontos
    // embora. Nao e erro grave se falhar — a `live_points` tem `expires_at` e a
    // RPC esconde o que passou do prazo — mas a tentativa fica, para nao
    // deixar lixo de cada sessao que termina.
    await withTimeout(
      client.from('live_points').delete().eq('token', token).eq('user_id', userId),
    );
    return true;
  } catch {
    return false;
  }
};

// A coluna expires_at e NOT NULL na tabela, mas o runtime pode devolver
// ausente em respostas parciais; o contrato original expunha string | null.
type LiveShareSnapshot = Pick<
  LiveShareRow,
  'latitude' | 'longitude' | 'accuracy' | 'heading'
> & { expires_at: string | null };

export const fetchLiveShareRow = async (
  token: string,
): Promise<LiveShareSnapshot | null> => {
  if (!client) return null;
  try {
    const { data } = await withTimeout(
      client.from('live_shares').select('*').eq('token', token).maybeSingle(),
    );
    return (data as unknown as LiveShareSnapshot) ?? null;
  } catch {
    return null;
  }
};
