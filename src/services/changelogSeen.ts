import AsyncStorage from '@react-native-async-storage/async-storage';

const CHANGELOG_SEEN_KEY = '@bussola/changelogSeen';

/**
 * Build em que o usuário viu as novidades pela última vez, ou `null` se nunca
 * viu (instalação nova, storage limpo, valor corrompido).
 *
 * A gravação é feita **ao fechar** o modal, não ao abrir o app: matar o processo
 * com o modal na tela não pode contar como leitura, senão as entradas do
 * intervalo se perdem e aquele pedaço de changelog nunca mais aparece.
 */
export const loadChangelogSeen = async (): Promise<number | null> => {
  try {
    const raw = await AsyncStorage.getItem(CHANGELOG_SEEN_KEY);
    if (raw == null) {
      return null;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const markChangelogSeen = async (code: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(CHANGELOG_SEEN_KEY, String(code));
  } catch {
    // ignore storage errors
  }
};
