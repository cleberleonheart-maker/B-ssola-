import { DeviceEventEmitter, NativeModules } from 'react-native';

type ApkDownloaderNative = {
  download(url: string, fileName: string, id: string): Promise<boolean>;
  install(uri: string): Promise<boolean>;
  cancel?(id: string): Promise<boolean>;
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

/**
 * Só HTTPS. A URL do APK vem de uma tabela na nuvem, ou seja, de um dado
 * remoto: aceitar `http:` expõe o download e o arquivo entregue a quem estiver
 * no caminho da rede, e o APK é depois instalado. O manifesto liga
 * `usesCleartextTraffic`, portanto a permissão de texto claro vinha de nós.
 */
export const isDirectApkUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return /\.apk(\?.*)?$/i.test(parsed.pathname) && parsed.protocol === 'https:';
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

/**
 * Tempo máximo de download. Sem isto, uma conexão que empaca no meio deixa a
 * promise pendurada para sempre: a tela fica presa em "3%" e os listeners do
 * `DeviceEventEmitter` vazam. O nativo tem `readTimeout` por socket, mas isso
 * não cobre o arquivo inteiro.
 */
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

let activeDownloadId: string | null = null;

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
  activeDownloadId = id;

  return new Promise<ApkDownloadResult>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      subs.forEach(sub => sub.remove());
      if (activeDownloadId === id) {
        activeDownloadId = null;
      }
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const subs = [
      DeviceEventEmitter.addListener('ApkDownloaderProgress', event => {
        if (event?.id !== id) return;
        onProgress?.({ received: event.received ?? 0, total: event.total ?? 0 });
      }),
      DeviceEventEmitter.addListener('ApkDownloaderDone', event => {
        if (event?.id !== id) return;
        settle(() => resolve({ name: event.name ?? name, uri: event.uri ?? '' }));
      }),
      DeviceEventEmitter.addListener('ApkDownloaderError', event => {
        if (event?.id !== id) return;
        settle(() => reject(new Error(event?.message ?? 'download_failed')));
      }),
    ];

    timer = setTimeout(() => {
      cancelApkDownload();
      settle(() => reject(new Error('download_timeout')));
    }, DOWNLOAD_TIMEOUT_MS);

    native.download(url, name, id).catch(error => {
      settle(() => reject(error));
    });
  });
};

/**
 * Cancela o download em curso. Apaga também o arquivo parcial: sem isso o
 * `.apk` truncado fica na pasta Downloads, e o próximo "instalar" podría
 * pegá-lo. O nativo ignora o evento `Done`/`Error` que chegar depois.
 */
export const cancelApkDownload = (): void => {
  const id = activeDownloadId;
  if (!id || !native?.cancel) {
    return;
  }
  native.cancel(id).catch(() => {});
};

export const installApk = (uri: string): Promise<boolean> => {
  if (!native?.install) {
    return Promise.reject(new Error('apk_installer_unavailable'));
  }
  return native.install(uri);
};
