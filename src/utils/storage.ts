import AsyncStorage from '@react-native-async-storage/async-storage';

export const migrateKey = async (
  oldKey: string,
  newKey: string,
): Promise<string | null> => {
  const existing = await AsyncStorage.getItem(newKey);
  if (existing !== null) {
    return existing;
  }
  try {
    const legacy = await AsyncStorage.getItem(oldKey);
    if (legacy !== null) {
      await AsyncStorage.setItem(newKey, legacy);
      await AsyncStorage.removeItem(oldKey);
      return legacy;
    }
  } catch {
    // migração falhou; seguimos sem o valor
  }
  return null;
};