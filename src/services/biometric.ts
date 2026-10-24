import { NativeModules, Platform } from 'react-native';

type BiometricNative = {
  isAvailable?: () => Promise<boolean>;
  authenticate?: (title: string, subtitle: string, cancel: string) => Promise<boolean>;
};

export const isBiometricAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const native = NativeModules.Biometric as BiometricNative | undefined;
    if (native?.isAvailable) {
      return await native.isAvailable();
    }
  } catch {
    // ignore
  }
  return false;
};

export const authenticateBiometric = async (
  title: string,
  subtitle: string,
  cancel: string,
): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    const native = NativeModules.Biometric as BiometricNative | undefined;
    if (native?.authenticate) {
      return await native.authenticate(title, subtitle, cancel);
    }
  } catch {
    // ignore
  }
  return false;
};
