import { NativeModules } from 'react-native';

type MicLevelNative = {
  start?: () => void;
  stop?: () => void;
  getLevel?: () => Promise<number>;
};

const Native = (NativeModules as { MicLevel?: MicLevelNative }).MicLevel ?? null;

export const micLevelAvailable = !!Native?.getLevel;

export const startMicLevel = () => {
  try {
    Native?.start?.();
  } catch {
    // ignore native failures
  }
};

export const stopMicLevel = () => {
  try {
    Native?.stop?.();
  } catch {
    // ignore native failures
  }
};

/** -1 quando não há leitura (microfone ocupado ou indisponível). */
export const getMicLevel = async (): Promise<number> => {
  if (!Native?.getLevel) {
    return -1;
  }
  try {
    return await Native.getLevel();
  } catch {
    return -1;
  }
};