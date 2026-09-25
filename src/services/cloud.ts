import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL: string = 'https://wotzcykrvidbjkonaawx.supabase.co';
const SUPABASE_ANON_KEY: string = 'sb_publishable_g8EcCQe4YPGaeMz1V-8gIw_OxF3iLNv';

export const isCloudEnabled = (): boolean =>
  SUPABASE_URL !== 'COLE_A_URL_DO_SUPABASE' &&
  SUPABASE_ANON_KEY !== 'COLE_A_CHAVE_ANON' &&
  SUPABASE_URL.startsWith('https://');

let client: SupabaseClient | null = null;
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
    console.warn('[cloud] falha ao criar cliente Supabase (Hermes/URL)', e);
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

export const ensureCloudUser = async (): Promise<string | null> => {
  if (!client) {
    warnDisabled();
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
      const { data } = await withTimeout(client.auth.getSession());
      if (data?.session?.user) {
        currentUserId = data.session.user.id;
        return currentUserId;
      }
      const { data: signInData } = await withTimeout(
        client.auth.signInAnonymously(),
      );
      currentUserId = signInData?.user?.id ?? null;
      return currentUserId;
    } catch {
      currentUserId = null;
      return null;
    }
  })();
  ensurePromise.finally(() => {
    ensurePromise = null;
  }).catch(() => {});
  return ensurePromise;
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

export const upsertLiveShare = async (
  userId: string,
  token: string,
  pos: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    altitude?: number | null;
  },
  expiresAt: number,
): Promise<void> => {
  if (!client) return;
  try {
    await withTimeout(
      client.from('live_shares').upsert(
        {
          token,
          user_id: userId,
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy ?? null,
          heading: pos.heading ?? null,
          speed: pos.speed ?? null,
          altitude: pos.altitude ?? null,
          expires_at: new Date(expiresAt).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' },
      ),
    );
  } catch {
    // offline: tenta no proximo intervalo
  }
};

export const deleteLiveShare = async (
  userId: string,
  token: string,
): Promise<void> => {
  if (!client) return;
  try {
    await withTimeout(
      client
        .from('live_shares')
        .delete()
        .eq('token', token)
        .eq('user_id', userId),
    );
  } catch {
    // offline: apenas remove o link local
  }
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
  if (!client) return false;
  try {
    await withTimeout(
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
    );
    return true;
  } catch {
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
    return true;
  } catch {
    return false;
  }
};

export const fetchLiveShareRow = async (
  token: string,
): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  expires_at: string | null;
} | null> => {
  if (!client) return null;
  try {
    const { data } = await withTimeout(
      client.from('live_shares').select('*').eq('token', token).maybeSingle(),
    );
    return (data as unknown as {
      latitude: number; longitude: number;
      accuracy: number | null; heading: number | null; expires_at: string | null;
    }) ?? null;
  } catch {
    return null;
  }
};
