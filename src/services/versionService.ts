import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION_CODE } from '../version.generated';
import {
  fetchLatestAppVersion,
  type AppVersion,
} from './cloud';
import { isDirectApkUrl } from './apkUpdater';

const LAST_OFFER_KEY = '@bussola/lastUpdateOffer';

export type AvailableUpdate = {
  versionCode: number;
  versionName: string;
  updateUrl: string;
  message: string | null;
  required: boolean;
};

const GITHUB_LATEST_RELEASE =
  'https://api.github.com/repos/cleberleonheart-maker/B-ssola-/releases/latest';

type ReleaseAsset = {
  code: number;
  name: string;
  url: string;
};

const pickBestDirectAsset = (
  assets: Array<Record<string, unknown> | undefined> | undefined,
): ReleaseAsset | null => {
  let best: ReleaseAsset | null = null;
  for (const a of assets ?? []) {
    const url = String(a?.browser_download_url ?? '');
    if (!isDirectApkUrl(url)) {
      continue;
    }
    const c = parseInt(String(a?.name ?? '').match(/v(\d+)/)?.[1] ?? '', 10);
    if (!Number.isFinite(c)) {
      continue;
    }
    if ((best?.code ?? 0) < c) {
      best = { code: c, name: String(a?.name ?? ''), url };
    }
  }
  return best;
};

const fetchLatestDirectAsset = async (): Promise<ReleaseAsset | null> => {
  try {
    const res = await fetch(GITHUB_LATEST_RELEASE);
    if (!res.ok) {
      return null;
    }
    const release = await res.json();
    return pickBestDirectAsset(release?.assets);
  } catch {
    return null;
  }
};

export const rememberUpdateOffer = async (versionCode: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_OFFER_KEY, String(versionCode));
  } catch {
    // ignore storage errors
  }
};

const wasUpdateAlreadyOffered = async (versionCode: number): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_OFFER_KEY);
    if (!raw) {
      return false;
    }
    const seen = parseInt(raw, 10);
    return Number.isFinite(seen) && seen >= versionCode;
  } catch {
    return false;
  }
};

export const checkForUpdate = async (options?: {
  ignoreOffered?: boolean;
}): Promise<AvailableUpdate | null> => {
  let cloud: AppVersion | null = null;
  try {
    cloud = await fetchLatestAppVersion();
  } catch {
    // Supabase indisponível — segue para o fallback do GitHub
  }

  const asset = await fetchLatestDirectAsset();

  let candidate: AvailableUpdate | null = null;

  if (cloud && cloud.version_code > APP_VERSION_CODE) {
    const url = isDirectApkUrl(cloud.update_url)
      ? cloud.update_url
      : (asset?.url ?? '');
    if (url) {
      candidate = {
        versionCode: cloud.version_code,
        versionName: cloud.version_name,
        updateUrl: url,
        message: cloud.message,
        required: !!cloud.required,
      };
    }
  }

  if (!candidate && asset && asset.code > APP_VERSION_CODE) {
    candidate = {
      versionCode: asset.code,
      versionName: asset.name,
      updateUrl: asset.url,
      message: null,
      required: false,
    };
  }

  if (!candidate) {
    return null;
  }

  if (!options?.ignoreOffered && (await wasUpdateAlreadyOffered(candidate.versionCode))) {
    // Essa versão já foi oferecida/baixada neste aparelho e o processo antigo
    // continua vivo — não re-oferecer para não entrar em loop de atualização.
    return null;
  }

  return candidate;
};