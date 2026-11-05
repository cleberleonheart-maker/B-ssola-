import { NativeModules, Platform } from 'react-native';
import { cacheBattery } from './sosSender';

type BatteryNative = {
  getBatteryLevel?: () => Promise<number | null>;
};

export const getBatteryLevel = async (): Promise<number | null> => {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    const native = NativeModules.Battery as BatteryNative | undefined;
    if (native?.getBatteryLevel) {
      const level = await native.getBatteryLevel();
      if (typeof level === 'number' && level >= 0 && level <= 100) {
        const rounded = Math.round(level);
        // O modo de assalto (ideia #107) avisa com a app fechada: a bateria
        // entra no cache nativo para o aviso dizer quanto resta.
        void cacheBattery(rounded);
        return rounded;
      }
    }
  } catch {
    // ignore
  }
  try {
    const battery = (navigator as any)?.getBattery?.();
    if (battery && typeof battery.then === 'function') {
      const b = await battery;
      if (typeof b?.level === 'number') {
        const rounded = Math.round(b.level * 100);
        void cacheBattery(rounded);
        return rounded;
      }
    }
  } catch {
    // ignore
  }
  return null;
};
