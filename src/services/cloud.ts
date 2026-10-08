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

/**
 * Última resposta sem erro vinda da nuvem (ideia #99).
 *
 * Conta qualquer chamada que chegou e respondeu sem erro — sessão, leitura ou
 * escrita — porque a pergunta do painel de Configurações é "a app ainda fala
 * com o Supabase?", não "qual destas tabelas foi tocada". Uma timeout ou uma
 * rejeição não conta: não houve resposta, logo não houve sincronização.
 */
let lastSyncAt: number | null = null;

/** O supabase-js devolve sempre objectos com `error`; `null` quer dizer sucesso. */
const respostaComErro = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  'error' in value &&
  (value as { error: unknown }).error != null;

const withTimeout = <T,>(
  promise: PromiseLike<T>,
  ms = 6000,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('cloud_timeout')), ms);
    Promise.resolve(promise).then(
      value => {
        clearTimeout(id);
        if (!respostaComErro(value)) lastSyncAt = Date.now();
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

export type CloudStatus = {
  /** As credenciais no código estão preenchidas. */
  enabled: boolean;
  /** O cliente foi criado sem exceção. */
  connected: boolean;
  clientError: string | null;
  /**
   * Última falha gravada por `noteCloudError`, sem ser limpa.
   *
   * Diferente de `takeCloudError`: o rastreio ao vivo consome o erro para o
   * Alert e apaga-o, e o painel de Configurações não pode ser quem o roube —
   * aqui lê-se sem alterar, para o alerta continuar a mostrar a mesma coisa.
   */
  lastError: string | null;
  /** `Date.now()` da última resposta sem erro, ou `null` se nunca houve. */
  lastSyncAt: number | null;
};

/** Estado da nuvem para o painel de Configurações (ideia #99). */
export const cloudStatus = (): CloudStatus => ({
  enabled: isCloudEnabled(),
  connected: client !== null,
  clientError,
  lastError: lastCloudError,
  lastSyncAt,
});

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

/**
 * Apaga a conta e os dados na nuvem (ideia #101).
 *
 * O servidor recebe o pedido pela RPC `delete_my_account` (SCRIPT SQL, não a
 * anon key): apaga as linhas das seis tabelas e depois o utilizador em
 * `auth.users`. A RLS por si só não chegava — apagar o utilizador não é REST,
 * e o cliente do Supabase não tem forma de se remover a si próprio.
 *
 * O `signOut` a seguir limpa a sessão local: o id de baixo já não existe, e
 * qualquer pedido futuro com ele é um 400 que ninguém percebe. As variáveis de
 * estado do módulo voltam a zero para um `ensureCloudUser` mais tarde criar uma
 * conta nova em vez de continuar a usar a apagada.
 */
export const deleteMyAccount = async (): Promise<boolean> => {
  if (!client) {
    noteCloudError('conta', clientError ?? 'Supabase nao configurado');
    return false;
  }
  try {
    const { data, error } = await withTimeout(client.rpc('delete_my_account'), 30000);
    if (error) {
      noteCloudError('conta', error.message);
      return false;
    }
    currentUserId = null;
    ensurePromise = null;
    await client.auth.signOut();
    return data === true;
  } catch (error) {
    noteCloudError('conta', error);
    return false;
  }
};

export type AccountStatus = {
  email: string | null;
  confirmed: boolean;
  anonymous: boolean;
};

/**
 * O estado identidade da conta actual (ideia #102).
 *
 * O `ensureCloudUser` devolve o id e nada mais, e para a secção "Conta" isto
 * não basta — quer saber se a conta ainda é anónima (presa ao aparelho) ou se
 * já tem email confirmado (sobrevive ao aparelho). Lê-se do `getUser` e não da
 * sessão, para quem entrou sem `ensureCloudUser` ver a mesma coisa.
 */
export const currentAccountStatus = async (): Promise<AccountStatus | null> => {
  if (!client) return null;
  try {
    const { data, error } = await withTimeout(client.auth.getUser(), 15000);
    if (error || !data.user) return null;
    const user = data.user;
    return {
      email: user.email ?? null,
      confirmed: Boolean(user.email_confirmed_at),
      anonymous: user.is_anonymous === true,
    };
  } catch {
    return null;
  }
};

/**
 * Liga a conta anónima a um email (ideia #102).
 *
 * O caminho é o `updateUser({ email })` do Supabase com a sessão anónima
 * activa: o GoTrue envia um link de confirmação e, ao ser clicado, associa a
 * identidade do email **ao mesmo utilizador** — o `auth.uid()` não muda, e por
 * isso as linhas de notas, trilhas, memória e partilhas continuam a ser as
 * mesmas. Não há migração de dados a fazer nem `security definer` a temer: é
 * exactamente o contrário da ideia #102 escrita antes de o Supabase converter
 * anónimos sem trocar o id.
 *
 * `password` é opcional e decide como se volta a entrar depois. Sem senha,
 * entra-se pelo link/OTP do email; com senha, `updateUser` grava também as
 * credenciais `signInWithPassword` para entrar de qualquer aparelho — sempre no
 * mesmo `auth.uid()`.
 *
 * Requer "manual linking" ligado no projecto (uma vez, no dashboard). Se
 * estiver desligado, o erro do GoTrue diz exactamente isso e chega ao ecrã.
 */
export const linkEmail = async (email: string, password?: string): Promise<boolean> => {
  if (!client) {
    noteCloudError('conta', clientError ?? 'Supabase nao configurado');
    return false;
  }
  const emailLimpo = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
    noteCloudError('conta', 'email invalido');
    return false;
  }
  if (password !== undefined && password.length < 6) {
    noteCloudError('conta', 'senha muito curta');
    return false;
  }
  try {
    const userId = await ensureCloudUser();
    if (!userId) return false;
    const { error } = await withTimeout(
      client.auth.updateUser(
        password ? { email: emailLimpo, password } : { email: emailLimpo },
      ),
      15000,
    );
    if (error) {
      noteCloudError('conta', error.message);
      return false;
    }
    return true;
  } catch (error) {
    noteCloudError('conta', error);
    return false;
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
  /**
   * SHA-256 do APK anunciado, gravado pelo CI no mesmo instante que publica.
   * Falta a coluna até `scripts/app_version_sha.sql` correr no SQL Editor — daí
   * ser opcional, e não `string`.
   */
  apk_sha256?: string | null;
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
  /**
   * Preenchido quando a pessoa carrega em "Parar" (#100). A linha fica na
   * tabela de propósito — é o que faz o histórico responder "mandei um link
   * às 21h04 e durou 30 min" — e as RPCs de posição e de trajecto escondem a
   * sessão enquanto isto estiver preenchido.
   */
  stopped_at: string | null;
};

/** O que o histórico de partilhas (#100) lê: carimbos de tempo, sem coordenada. */
export type LiveShareHistoryRow = Pick<
  LiveShareRow,
  'token' | 'started_at' | 'stopped_at' | 'expires_at' | 'updated_at'
>;

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

/** O que o `crashReporter` manda, e o que a tabela `crashes` tem. */
export type CrashReport = {
  message: string;
  stack: string | null;
  fingerprint: string;
  appVersion: string;
  versionCode: number;
  happenedAt: string;
  /** Prazo da purga: 90 dias. Um crash de há seis meses já não interessa. */
  expiresAt: string;
};

/**
 * Grava um crash (ideia #56).
 *
 * Devolve só o booleano, e nunca lança: quem chama é o tratamento de um erro,
 * e um tratamento de erro que lança outra vez é como um crash se reproduz
 * sozinho. O reporter também não trata o fracasso — se não há rede no arranque
 * seguinte, o relatório fica na fila para a próxima vez.
 */
export const pushCrashReport = async (
  userId: string,
  report: CrashReport,
): Promise<boolean> => {
  if (!client) {
    noteCloudError('crash', 'Supabase nao configurado');
    return false;
  }
  try {
    const { error } = await withTimeout(
      client.from('crashes').insert({
        user_id: userId,
        message: report.message,
        stack: report.stack,
        fingerprint: report.fingerprint,
        app_version: report.appVersion,
        version_code: report.versionCode,
        happened_at: report.happenedAt,
        reported_at: new Date().toISOString(),
        expires_at: report.expiresAt,
      }),
      15000,
    );
    if (error) {
      noteCloudError('crash', error.message);
      return false;
    }
    return true;
  } catch (error) {
    noteCloudError('crash', error);
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

/**
 * Para uma sessao sem apagar a linha (#100).
 *
 * Antes, o "Parar" fazia um DELETE: o link morria na hora, mas a sessao
 * deixava de existir em qualquer sítio — nem o proprio dono conseguia dizer
 * que tinha partilhado a posicao, nem quando, nem durante quanto tempo. Agora
 * a linha fica marcada com `stopped_at`, e as RPCs de posicao e de trajecto
 * escondem-na como se estivesse apagada: parar e' parar de partilhar.
 *
 * Devolve `false` em tres casos, e nenhum deles e' o mesmo: sem ligacao (o
 * `withTimeout` ou o fetch lancam), o PostgREST a recusar (erro), ou nenhuma
 * linha afectada — o token não é desta pessoa, e aí não há nada para parar.
 * Quem chama cai no DELETE de reserva, que e' o comportamento antigo e o que
 * garante que uma sessao nunca fica viva so porque o UPDATE falhou.
 */
export const markLiveShareStopped = async (
  token: string,
  userId: string,
): Promise<boolean> => {
  if (!client) return false;
  try {
    const { data, error } = await withTimeout(
      client
        .from('live_shares')
        .update({ stopped_at: new Date().toISOString() })
        .eq('token', token)
        .eq('user_id', userId)
        .select('token'),
      15000,
    );
    if (error) {
      noteCloudError('live stop', error.message);
      return false;
    }
    if (!data || (data as unknown[]).length === 0) return false;
    // O trajecto segue a linha: parar leva os pontos embora, como levava
    // quando o "Parar" apagava a sessao inteira.
    await withTimeout(
      client.from('live_points').delete().eq('token', token).eq('user_id', userId),
      15000,
    );
    return true;
  } catch (error) {
    noteCloudError('live stop', error);
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

/**
 * As partilhas de sempre de quem pede, da mais nova para a mais velha (#100).
 *
 * A RLS já limita às linhas do próprio (`user_id = auth.uid()`), portanto o
 * `eq('user_id')` é redundante com a política e obrigatório com o código: sem
 * ele, a consulta dependia de o runtime incluir o filtro sozinho, e é o tipo
 * de coisa que se esquece num refactor. Só os campos do histórico — a
 * coordenada não vem para o aparelho de quem já parou de partilhar, e aqui é
 * o próprio dono a pedir.
 */
export const fetchLiveShareHistory = async (
  userId: string,
  limit = 20,
): Promise<LiveShareHistoryRow[]> => {
  if (!client) return [];
  try {
    const { data, error } = await withTimeout(
      client
        .from('live_shares')
        .select('token, started_at, stopped_at, expires_at, updated_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit),
      15000,
    );
    if (error) {
      noteCloudError('live history', error.message);
      return [];
    }
    return (data as unknown as LiveShareHistoryRow[]) ?? [];
  } catch {
    return [];
  }
};

// ============================================================
// Limpeza do que já passou do prazo.
//
// As duas tabelas que guardam histórico — os pontos do trajecto e os relatórios
// de crash — têm `expires_at` indexado desde o início, e nenhuma delas tinha
// quem o usasse. A RPC esconde o que passou do prazo, o que resolve a leitura
// e não o armazenamento: as linhas ficavam para sempre.
//
// Quem apaga é o próprio dono, e só as suas: as políticas de DELETE comparam
// `user_id` com `auth.uid()`, o mesmo que a escrita. Não é que o `pg_cron` não
// servisse — é que depende de uma extension que não vem ligada em todos os
// projectos, e uma limpeza que depende disso é uma limpeza que nunca acontece
// em silêncio. Aqui não há nada para ligar: a app já tem sessão nestas alturas.
//
// Porquê no cliente e não no servidor: apanhar as linhas velha é trabalho de
// quem acumula. Quem nunca abre a app não acumula nada novo, e as linhas que
// ficam são as de sessões que já não podem ser consultedas por ninguém — a RPC
// devolve-as vazias há meses.

/**
 * Apaga os relatórios de crash deste utilizador que já passaram dos 90 dias.
 *
 * Devolve só se correu. A contagem de linhas apanhadas não interessa a ninguém
 * — isto é higiene, não funcionalidade, e falhar aqui não pode virar um erro
 * visível na app.
 */
export const deleteExpiredCrashReports = async (
  userId: string,
): Promise<boolean> => {
  if (!client) return false;
  try {
    const { error } = await withTimeout(
      client
        .from('crashes')
        .delete()
        .eq('user_id', userId)
        .lt('expires_at', new Date().toISOString()),
    );
    if (error) {
      noteCloudError('limpeza de crashes', error.message);
      return false;
    }
    return true;
  } catch (error) {
    noteCloudError('limpeza de crashes', error);
    return false;
  }
};

/**
 * Apaga os pontos do trajecto deste utilizador cujas sessões já acabaram.
 *
 * O filtro é `expires_at < agora` e não o token: o que sobra de uma sessão
 * terminada à pressa não tem token com que ir buscá-la, e é precisamente essa
 * a linha que nunca é apagada. Uma sessão a decorrer tem `expires_at` no futuro, o
 * que a torna intocável — que é o que se quer.
 */
export const deleteExpiredLivePoints = async (
  userId: string,
): Promise<boolean> => {
  if (!client) return false;
  try {
    const { error } = await withTimeout(
      client
        .from('live_points')
        .delete()
        .eq('user_id', userId)
        .lt('expires_at', new Date().toISOString()),
    );
    if (error) {
      noteCloudError('limpeza de pontos', error.message);
      return false;
    }
    return true;
  } catch (error) {
    noteCloudError('limpeza de pontos', error);
    return false;
  }
};
