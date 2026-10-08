import { NativeModules } from 'react-native';

type KeepAwakeNative = {
  setEnabled?: (enabled: boolean) => void;
};

const KeepAwake = (NativeModules as { KeepAwake?: KeepAwakeNative }).KeepAwake ?? null;

export const keepAwakeAvailable = !!KeepAwake;

/**
 * Liga ou desliga a tela sempre acesa na janela da Activity (Android). Em
 * plataformas sem o módulo nativo a chamada é um no-op silencioso.
 */
export const setKeepScreenOn = (enabled: boolean) => {
  KeepAwake?.setEnabled?.(enabled);
};