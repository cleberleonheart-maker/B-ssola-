import { NativeModules, Platform } from 'react-native';

type BatteryOptNative = {
  isIgnoringBatteryOptimizations?: () => Promise<boolean | null>;
  requestIgnoreBatteryOptimizations?: () => Promise<boolean | null>;
  openBatteryOptimizationSettings?: () => Promise<boolean | null>;
};

export const isIgnoringBatteryOptimizations = async (): Promise<boolean | null> => {
  if (Platform.OS !== 'android') return true;
  try {
    const native = NativeModules.BatteryOpt as BatteryOptNative | undefined;
    if (native?.isIgnoringBatteryOptimizations) {
      return await native.isIgnoringBatteryOptimizations();
    }
  } catch {
    // ignore
  }
  return null;
};

export const requestIgnoreBatteryOptimizations = async (): Promise<boolean | null> => {
  if (Platform.OS !== 'android') return true;
  try {
    const native = NativeModules.BatteryOpt as BatteryOptNative | undefined;
    if (native?.requestIgnoreBatteryOptimizations) {
      return await native.requestIgnoreBatteryOptimizations();
    }
  } catch {
    // ignore
  }
  return null;
};

export const openBatteryOptimizationSettings = async (): Promise<boolean | null> => {
  if (Platform.OS !== 'android') return true;
  try {
    const native = NativeModules.BatteryOpt as BatteryOptNative | undefined;
    if (native?.openBatteryOptimizationSettings) {
      return await native.openBatteryOptimizationSettings();
    }
  } catch {
    // ignore
  }
  return null;
};
