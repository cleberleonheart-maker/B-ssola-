import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "Lápides" dos itens apagados no aparelho (ideia #18).
 *
 * O sync é um `upsert`: junta a nuvem ao local e sobe o que mudou, mas nunca
 * apaga nada. Sem esta memória, um ponto apagado aqui voltava no `fetch`
 * seguinte — o sync ressuscitava-o no arranque a seguir, e apagar waypoints
 * deixava de funcionar no próprio aparelho.
 *
 * Cada apagar grava o `id` com o instante. O sync filtra o que veio da nuvem
 * por estes ids e, depois de subir o resto, apaga essas linhas lá (a política
 * de DELETE da RLS já cobria isto; faltava quem a usasse). Só depois de a nuvem
 * confirmar o apagar é que a lápide é esquecida — se a rede falhar, fica para a
 * próxima tentativa.
 *
 * Têm prazo: 90 dias. É margem a mais para um aparelho voltar a ligar-se e
 * chegarem a tempo, e evita que isto cresça sem fim. O preço de uma lápide
 * expirada é um item apagado num aparelho antigo poder voltar — o mesmo preço
 * que o `expires_at` das partilhas ao vivo já aceita.
 */
export type SyncCollection = 'waypoints' | 'notes' | 'tracks';

const STORAGE_KEY = '@bussola/syncTombstones';
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

type Store = Partial<Record<SyncCollection, Record<string, number>>>;

const load = async (): Promise<Store> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const save = async (store: Store): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // uma lápide que não grava é um apagar que pode voltar; não pode é ser um
    // apagar que rebenta. Quem apaga não espera por isto.
  }
};

const prune = (
  bucket: Record<string, number>,
  now: number,
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [id, at] of Object.entries(bucket)) {
    if (now - at <= RETENTION_MS) out[id] = at;
  }
  return out;
};

/** Grava a lápide de um item apagado localmente. */
export const noteDeleted = async (
  collection: SyncCollection,
  id: string,
): Promise<void> => {
  const store = await load();
  const now = Date.now();
  const bucket = prune(store[collection] ?? {}, now);
  bucket[id] = now;
  store[collection] = bucket;
  await save(store);
};

/** Os ids apagados há menos de 90 dias, por coleção. */
export const loadDeletedIds = async (
  collection: SyncCollection,
): Promise<Record<string, number>> => {
  const store = await load();
  return prune(store[collection] ?? {}, Date.now());
};

/** Esquece as lápides já propagadas para a nuvem. */
export const clearDeletedIds = async (
  collection: SyncCollection,
  ids: string[],
): Promise<void> => {
  const store = await load();
  const bucket = store[collection];
  if (!bucket) return;
  for (const id of ids) delete bucket[id];
  store[collection] = bucket;
  await save(store);
};

export const TOMBSTONE_RETENTION_MS = RETENTION_MS;
