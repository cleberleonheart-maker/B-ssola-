import { NativeModules, Platform } from 'react-native';

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
        return Math.round(level);
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
        return Math.round(b.level * 100);
      }
    }
  } catch {
    // ignore
  }
  return null;
};
