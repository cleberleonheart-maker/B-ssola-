import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION_CODE } from '../version.generated';
import {
  fetchLatestAppVersion,
  type AppVersion,
} from './cloud';
import { isDirectApkUrl, normalizeSha256 } from './apkUpdater';

const LAST_OFFER_KEY = '@bussola/lastUpdateOffer';

export type AvailableUpdate = {
  versionCode: number;
  versionName: string;
  updateUrl: string;
  message: string | null;
  required: boolean;
  /** SHA-256 esperado, ou `null` se nenhuma das fontes o souber. */
  apkSha256: string | null;
  /**
   * As duas fontes discordam. Alguém trocou o asset ou a linha da nuvem, e isso
   * não se resolve escolhendo a que parece mais certa: o app recusa-se a
   * instalar. Um APK substituido por outro, assinado com a nossa chave, é o
   * caso que o Android não apanha.
   */
  hashConflict: boolean;
};

const GITHUB_RELEASE_URL =
  'https://api.github.com/repos/cleberleonheart-maker/B-ssola-/releases/tags/bussola-apk';

type ReleaseAsset = {
  code: number;
  name: string;
  url: string;
  /** `digest` que a GitHub calcula por asset, independente do nosso CI. */
  sha256: string;
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
      best = {
        code: c,
        name: String(a?.name ?? ''),
        url,
        sha256: normalizeSha256(String(a?.digest ?? '')),
      };
    }
  }
  return best;
};

/**
 * Junta as duas fontes de hash. Só se comparam quando falam do mesmo APK: o
 * asset escolhido pode ser mais novo do que a linha da nuvem, e nesse caso os
 * dois hashes são de ficheiros diferentes — compará-los dava um conflito falso
 * a cada release.
 */
const resolveHash = (
  fromCloud: string | null | undefined,
  fromAsset: string | null | undefined,
  sameRelease: boolean,
): { sha256: string | null; conflict: boolean } => {
  const cloud = normalizeSha256(fromCloud ?? '');
  const asset = sameRelease ? normalizeSha256(fromAsset ?? '') : '';
  if (cloud && asset) {
    return cloud === asset
      ? { sha256: cloud, conflict: false }
      : { sha256: null, conflict: true };
  }
  return { sha256: cloud || asset || null, conflict: false };
};

const fetchLatestDirectAsset = async (): Promise<ReleaseAsset | null> => {
  try {
    const res = await fetch(GITHUB_RELEASE_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Bussola-App',
      },
    });
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
      const hash = resolveHash(
        cloud.apk_sha256,
        asset?.sha256,
        asset?.code === cloud.version_code,
      );
      candidate = {
        versionCode: cloud.version_code,
        versionName: cloud.version_name,
        updateUrl: url,
        message: cloud.message,
        required: !!cloud.required,
        apkSha256: hash.sha256,
        hashConflict: hash.conflict,
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
      apkSha256: asset.sha256 || null,
      hashConflict: false,
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