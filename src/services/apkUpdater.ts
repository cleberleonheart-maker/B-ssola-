import { DeviceEventEmitter, NativeModules } from 'react-native';

type ApkDownloaderNative = {
  download(url: string, fileName: string, id: string): Promise<boolean>;
  install(uri: string): Promise<boolean>;
};

const native = NativeModules.ApkDownloader as ApkDownloaderNative | undefined;

export const isApkDownloaderAvailable = (): boolean => !!native;

export type ApkDownloadProgress = {
  received: number;
  total: number;
};

export type ApkDownloadResult = {
  name: string;
  uri: string;
};

export const isDirectApkUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return /\.apk(\?.*)?$/i.test(parsed.pathname) && /^https?:$/.test(parsed.protocol);
  } catch {
    return false;
  }
};

const fileNameFromUrl = (url: string, fallback: string): string => {
  try {
    const name = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (name && /\.apk$/i.test(name)) {
      return decodeURIComponent(name);
    }
  } catch {
    // ignore
  }
  return fallback;
};

export const downloadApk = (
  url: string,
  fileName: string,
  onProgress?: (progress: ApkDownloadProgress) => void,
): Promise<ApkDownloadResult> => {
  if (!native) {
    return Promise.reject(new Error('apk_downloader_unavailable'));
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const name = fileNameFromUrl(url, fileName.endsWith('.apk') ? fileName : `${fileName}.apk`);

  return new Promise<ApkDownloadResult>((resolve, reject) => {
    const subs = [
      DeviceEventEmitter.addListener('ApkDownloaderProgress', event => {
        if (event?.id !== id) return;
        onProgress?.({ received: event.received ?? 0, total: event.total ?? 0 });
      }),
      DeviceEventEmitter.addListener('ApkDownloaderDone', event => {
        if (event?.id !== id) return;
        cleanup();
        resolve({ name: event.name ?? name, uri: event.uri ?? '' });
      }),
      DeviceEventEmitter.addListener('ApkDownloaderError', event => {
        if (event?.id !== id) return;
        cleanup();
        reject(new Error(event?.message ?? 'download_failed'));
      }),
    ];
    const cleanup = () => subs.forEach(sub => sub.remove());

    native.download(url, name, id).catch(error => {
      cleanup();
      reject(error);
    });
  });
};

export const installApk = (uri: string): Promise<boolean> => {
  if (!native?.install) {
    return Promise.reject(new Error('apk_installer_unavailable'));
  }
  return native.install(uri);
};
