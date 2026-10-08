/**
 * O hash esperado do APK vem de DUAS fontes, feitas por quem não é o app: o
 * `digest` que a GitHub calcula por asset, e a coluna `apk_sha256` que o CI
 * grava na nuvem. O que está em teste aqui é a junção das duas — e sobretudo
 * o caso em que elas NÃO podem ser comparadas, que é quando o asset escolhido
 * é mais recente do que a linha da nuvem.
 */
import { APP_VERSION_CODE } from '../src/version.generated';

jest.doMock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

const assetOf = (name: string, digest?: string) => ({
  name,
  browser_download_url: `https://exemplo.test/${name}`,
  digest: digest === undefined ? null : `sha256:${digest}`,
});

const loadUpdateService = (
  cloud: Record<string, unknown> | null,
  assets: Array<Record<string, unknown>>,
) => {
  const fetchLatestAppVersion = jest.fn().mockResolvedValue(cloud);
  jest.doMock('../src/services/cloud', () => ({ fetchLatestAppVersion }));

  let mod!: typeof import('../src/services/versionService');
  jest.isolateModules(() => {
    mod = require('../src/services/versionService');
  });

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ assets }),
  }) as unknown as typeof fetch;

  return mod;
};

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

/**
 * O `checkForUpdate` só oferece o que for maior do que o build instalado, e
 * `version.generated.ts` é reescrito a cada bump. Com o número escrito à mão,
 * estes testes deixavam de oferecer update no dia seguinte ao release e
 * falhavam com `null` onde esperavam um objeto, sem nada a dizer sobre o
 * porque. Tudo aqui deriva do código que está instalado.
 */
const INSTALLED = APP_VERSION_CODE;
const NEXT = INSTALLED + 1;
const NEWER = INSTALLED + 2;

const nextRow = (overrides: Record<string, unknown> = {}) => ({
  version_code: NEXT,
  version_name: '7.34',
  update_url: `https://exemplo.test/bussola-v${NEXT}.apk`,
  message: null,
  required: false,
  apk_sha256: null,
  ...overrides,
});

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  jest.dontMock('../src/services/cloud');
});

describe('checkForUpdate — o hash esperado do APK', () => {
  it('usa o hash quando as duas fontes concordam', async () => {
    const svc = loadUpdateService(nextRow({ apk_sha256: HASH_A }), [assetOf(`bussola-v${NEXT}.apk`, HASH_A)]);

    const update = await svc.checkForUpdate({ ignoreOffered: true });

    expect(update).not.toBeNull();
    expect(update?.apkSha256).toBe(HASH_A);
    expect(update?.hashConflict).toBe(false);
  });

  it('marca conflito quando as duas fontes discordam', async () => {
    const svc = loadUpdateService(nextRow({ apk_sha256: HASH_A }), [assetOf(`bussola-v${NEXT}.apk`, HASH_B)]);

    const update = await svc.checkForUpdate({ ignoreOffered: true });

    // Sem hash e com conflito: o modal recusa a instalação em vez de escolher
    // uma das versões. Um APK trocado assinado com a nossa chave instala-se
    // por cima sem o Android reclamar, e é exactamente esse o caso.
    expect(update?.hashConflict).toBe(true);
    expect(update?.apkSha256).toBeNull();
  });

  it('não compara hashes de ficheiros diferentes', async () => {
    // A nuvem aponta para a próxima versão, mas a release já tem uma mais nova.
    // de ficheiros distintos: compará-los acusaria um conflito falso em todas as
    // releases, e o app deixaria de oferecer a atualização.
    const svc = loadUpdateService(
      nextRow({ apk_sha256: HASH_A }),
      [assetOf(`bussola-v${NEWER}.apk`, HASH_B)],
    );

    const update = await svc.checkForUpdate({ ignoreOffered: true });

    expect(update?.versionCode).toBe(NEXT);
    expect(update?.hashConflict).toBe(false);
    // O hash da nuvem é o que descreve a versão que vai ser baixada.
    expect(update?.apkSha256).toBe(HASH_A);
  });

  it('aceita a coluna ausente e fica só com o digest da GitHub', async () => {
    const svc = loadUpdateService(nextRow(), [assetOf(`bussola-v${NEXT}.apk`, HASH_A)]);

    const update = await svc.checkForUpdate({ ignoreOffered: true });

    expect(update?.apkSha256).toBe(HASH_A);
    expect(update?.hashConflict).toBe(false);
  });

  it('não inventa hash quando ninguém sabe', async () => {
    const svc = loadUpdateService(nextRow(), [assetOf(`bussola-v${NEXT}.apk`)]);

    const update = await svc.checkForUpdate({ ignoreOffered: true });

    // `null` e não string inventada: sem hash o app instala sem conferir, que
    // é o comportamento de antes, em vez de recusar uma release legítima.
    expect(update?.apkSha256).toBeNull();
    expect(update?.hashConflict).toBe(false);
  });

  it('ignora um digest mal formado em vez de o propagar', async () => {
    const svc = loadUpdateService(
      nextRow({ apk_sha256: HASH_A }),
      [assetOf(`bussola-v${NEXT}.apk`, 'isto não é um hash')],
    );

    const update = await svc.checkForUpdate({ ignoreOffered: true });

    expect(update?.apkSha256).toBe(HASH_A);
    expect(update?.hashConflict).toBe(false);
  });

  it('no caminho só-GitHub usa o digest do asset', async () => {
    const svc = loadUpdateService(null, [assetOf(`bussola-v${NEXT}.apk`, HASH_B)]);

    const update = await svc.checkForUpdate({ ignoreOffered: true });

    expect(update?.versionCode).toBe(NEXT);
    expect(update?.apkSha256).toBe(HASH_B);
    expect(update?.hashConflict).toBe(false);
  });
});
