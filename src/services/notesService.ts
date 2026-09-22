import AsyncStorage from '@react-native-async-storage/async-storage';

export type FieldNote = {
  id: string;
  text: string;
  lat: number;
  lon: number;
  alt: number | null;
  at: number;
  photoPath: string | null;
  cloudSynced: boolean;
};

const STORAGE_KEY = '@bussola/fieldNotes';

export const loadNotes = async (): Promise<FieldNote[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FieldNote[]) : [];
  } catch {
    return [];
  }
};

export const saveNote = async (note: FieldNote) => {
  const list = await loadNotes();
  const next = [note, ...list];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const deleteNote = async (id: string) => {
  const list = await loadNotes();
  const next = list.filter(n => n.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const markSynced = async (id: string): Promise<FieldNote[]> => {
  const list = await loadNotes();
  const next = list.map(n => (n.id === id ? { ...n, cloudSynced: true } : n));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const createNoteId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;