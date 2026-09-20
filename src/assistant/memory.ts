import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateKey } from '../utils/storage';
import {
  ensureCloudUser,
  fetchCloudMemory,
  pushCloudMemory,
  type CloudMemoryDoc,
} from '../services/cloud';

export type MemoryState = {
  facts: Record<string, string>;
  history: { role: 'user' | 'assistant'; text: string; at: number }[];
};

const STORAGE_KEY = '@bussola/kefera/memory/v1';
const CLOUD_META_KEY = '@bussola/kefera/cloudMeta';
const LEGACY_STORAGE_KEY = '@bussola/virgin/memory/v1';
const LEGACY_CLOUD_META_KEY = '@bussola/virgin/cloudMeta';
const HISTORY_LIMIT = 40;

export const DEFAULT_MEMORY: MemoryState = {
  facts: {},
  history: [],
};

export const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const pushHistory = (
  memory: MemoryState,
  role: 'user' | 'assistant',
  text: string,
): void => {
  memory.history.push({ role, text, at: Date.now() });
  if (memory.history.length > HISTORY_LIMIT) {
    memory.history = memory.history.slice(memory.history.length - HISTORY_LIMIT);
  }
};

export const loadMemory = async (): Promise<MemoryState> => {
  const local = await readLocal();
  let syncedAt: string | null = null;
  try {
    const rawMeta = await migrateKey(LEGACY_CLOUD_META_KEY, CLOUD_META_KEY);
    syncedAt = rawMeta ? ((JSON.parse(rawMeta) as { syncedAt?: string }).syncedAt ?? null) : null;
  } catch {
    syncedAt = null;
  }

  let userId: string | null = null;
  try {
    userId = await ensureCloudUser();
  } catch {
    userId = null;
  }
  if (!userId) {
    return local;
  }

  try {
    const row = await fetchCloudMemory(userId);
    if (row) {
      if (!syncedAt || row.updated_at > syncedAt) {
        const merged: MemoryState = {
          facts:
            row.facts && typeof row.facts === 'object'
              ? row.facts
              : local.facts,
          history: Array.isArray(row.history) ? row.history : local.history,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        await AsyncStorage.setItem(
          CLOUD_META_KEY,
          JSON.stringify({ syncedAt: row.updated_at }),
        );
        return merged;
      }
      return local;
    }

    const doc = toCloudDoc(local);
    await pushCloudMemory(userId, doc);
    await AsyncStorage.setItem(
      CLOUD_META_KEY,
      JSON.stringify({ syncedAt: new Date().toISOString() }),
    );
  } catch {
    // nuvem é opcional; seguimos com a memória local
  }
  return local;
};

export const saveMemory = async (memory: MemoryState): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // falha de armazenamento não deve derrubar o app
  }
  try {
    const userId = await ensureCloudUser();
    if (!userId) {
      return;
    }
    const ok = await pushCloudMemory(userId, toCloudDoc(memory));
    if (ok) {
      await AsyncStorage.setItem(
        CLOUD_META_KEY,
        JSON.stringify({ syncedAt: new Date().toISOString() }),
      );
    }
  } catch {
    // sincronização é opcional
  }
};

const readLocal = async (): Promise<MemoryState> => {
  try {
    const raw = await migrateKey(LEGACY_STORAGE_KEY, STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_MEMORY };
    }
    const parsed = JSON.parse(raw) as Partial<MemoryState>;
    return {
      facts:
        parsed.facts && typeof parsed.facts === 'object'
          ? (parsed.facts as Record<string, string>)
          : {},
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
};

const toCloudDoc = (memory: MemoryState): CloudMemoryDoc => ({
  facts: memory.facts,
  history: memory.history,
});