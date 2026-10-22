import { NativeModules, Platform } from 'react-native';

type NetworkNative = {
  getNetworkInfo?: () => Promise<{ operator?: string | null; type?: string | null } | null>;
};

export type NetworkInfo = {
  operator: string | null;
  type: string | null;
};

export const getNetworkInfo = async (): Promise<NetworkInfo> => {
  if (Platform.OS !== 'android') {
    return { operator: null, type: null };
  }
  try {
    const native = NativeModules.NetworkInfo as NetworkNative | undefined;
    if (native?.getNetworkInfo) {
      const res = await native.getNetworkInfo();
      if (res) {
        return {
          operator: typeof res.operator === 'string' && res.operator.length ? res.operator : null,
          type: typeof res.type === 'string' && res.type.length ? res.type : null,
        };
      }
    }
  } catch {
    // ignore
  }
  return { operator: null, type: null };
};
