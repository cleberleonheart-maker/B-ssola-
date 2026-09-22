import { NativeModules, Platform, Share } from 'react-native';

type TrackShareNative = {
  shareGpx?: (name: string, content: string) => Promise<void>;
};

const TrackShare = (NativeModules as { TrackShare?: TrackShareNative }).TrackShare ?? null;

export const trackShareSupported =
  Platform.OS === 'android' && !!TrackShare?.shareGpx;

export const shareTrackGpx = async (name: string, content: string): Promise<boolean> => {
  const safe = name.replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40);
  if (trackShareSupported && TrackShare?.shareGpx) {
    try {
      await TrackShare.shareGpx(safe || 'track', content);
      return true;
    } catch {
      // cai no fallback abaixo
    }
  }
  await Share.share({ message: content });
  return true;
};