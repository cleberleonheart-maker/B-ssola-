import { DeviceEventEmitter, NativeModules } from 'react-native';

/**
 * Cancelamento do APK.
 *
 * O nativo sinaliza cancelamento com `promise.resolve(false)`, não com
 * `reject`. O `downloadApk` só tratava `.catch`, então o `await` no modal ficava
 * pendurado: a tela voltava a "inativo" mas a promise continuava viva até o
 * timeout de 5 min, com os listeners do `DeviceEventEmitter` presos.
 *
 * O módulo `apkUpdater` lê `NativeModules.ApkDownloader` no import, por isso
 * cada teste recarrega o módulo depois de instalar o mock.
 */
type MockNative = {
  download: jest.Mock;
  install: jest.Mock;
  cancel: jest.Mock;
  verify: jest.Mock;
};

const mockNative = (): MockNative => ({
  download: jest.fn(),
  install: jest.fn(),
  cancel: jest.fn().mockResolvedValue(true),
  verify: jest.fn().mockResolvedValue(true),
});

const loadUpdater = (native: MockNative) => {
  (NativeModules as Record<string, unknown>).ApkDownloader = native;
  let mod!: typeof import('../src/services/apkUpdater');
  jest.isolateModules(() => {
    mod = require('../src/services/apkUpdater');
  });
  return mod;
};

const emit = (event: string, payload: Record<string, unknown>) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (DeviceEventEmitter as any).emit(event, payload);

const URL_OK = 'https://exemplo.test/app/bussola-7.27.apk';

/** O id é gerado dentro de `downloadApk`; os eventos só batem com ele. */
const idUsed = (native: MockNative): string =>
  native.download.mock.calls[0][2] as string;

describe('apkUpdater — cancelamento e timeout', () => {
  let native: MockNative;

  beforeEach(() => {
    jest.useFakeTimers();
    native = mockNative();
    // Nunca resolvido por omissão: quem resolve é cada teste.
    native.download.mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (NativeModules as Record<string, unknown>).ApkDownloader;
    jest.restoreAllMocks();
  });

  it('o cancelamento rejeita a promise em vez de a deixar pendurada', async () => {
    const updater = loadUpdater(native);
    const pending = updater.downloadApk(URL_OK, 'bussola.apk');
    const assertion = expect(pending).rejects.toThrow('download_cancelled');

    updater.cancelApkDownload();

    await assertion;
    expect(native.cancel).toHaveBeenCalledTimes(1);
  });

  it('o cancelamento também vale quando o nativo resolve false', async () => {
    // O timeout chama o cancelamento e rejeita por aqui; mas um `resolve(false)`
    // de outra origem (o nativo a perder a corrida) não pode ficar pelo caminho.
    const updater = loadUpdater(native);
    native.download.mockResolvedValue(false);

    await expect(updater.downloadApk(URL_OK, 'bussola.apk')).rejects.toThrow(
      'download_cancelled',
    );
  });

  it('o timeout de 5 min cancela o nativo e rejeita', async () => {
    const updater = loadUpdater(native);
    const pending = updater.downloadApk(URL_OK, 'bussola.apk');
    const assertion = expect(pending).rejects.toThrow('download_timeout');

    jest.advanceTimersByTime(5 * 60 * 1000);

    await assertion;
    expect(native.cancel).toHaveBeenCalled();
  });

  it('não rejeita duas vezes quando o timeout e o nativo chegam juntos', async () => {
    const updater = loadUpdater(native);
    let resolveNative: (v: boolean) => void = () => {};
    native.download.mockReturnValue(
      new Promise<boolean>(r => {
        resolveNative = r;
      }),
    );

    const pending = updater.downloadApk(URL_OK, 'bussola.apk');
    const assertion = expect(pending).rejects.toThrow('download_timeout');
    jest.advanceTimersByTime(5 * 60 * 1000);
    // O nativo percebe o cancelamento e confirma com `false` logo a seguir.
    resolveNative(false);

    await assertion;
    // Sem o guard `settled`, o segundo reject apareceria como unhandled rejection.
    await Promise.resolve();
  });

  it('o evento Done resolve com nome e uri', async () => {
    const updater = loadUpdater(native);
    const pending = updater.downloadApk(URL_OK, 'bussola.apk');

    emit('ApkDownloaderDone', {
      id: idUsed(native),
      name: 'bussola-7.27.apk',
      uri: 'content://media/1',
    });

    await expect(pending).resolves.toEqual({
      name: 'bussola-7.27.apk',
      uri: 'content://media/1',
    });
  });

  it('o id do evento tem de bater com o do download', async () => {
    const updater = loadUpdater(native);
    const pending = updater.downloadApk(URL_OK, 'bussola.apk');
    const assertion = expect(pending).rejects.toThrow('download_cancelled');

    // Evento de um download antigo que chegou tarde: não pode resolver o atual.
    emit('ApkDownloaderDone', { id: 'outro-id', uri: 'content://media/2' });
    updater.cancelApkDownload();

    await assertion;
  });

  it('remove os listeners quando o download termina', async () => {
    const updater = loadUpdater(native);
    const before = DeviceEventEmitter.listenerCount('ApkDownloaderDone');
    const pending = updater.downloadApk(URL_OK, 'bussola.apk');
    expect(DeviceEventEmitter.listenerCount('ApkDownloaderDone')).toBe(before + 1);

    updater.cancelApkDownload();
    await expect(pending).rejects.toThrow('download_cancelled');

    expect(DeviceEventEmitter.listenerCount('ApkDownloaderDone')).toBe(before);
  });

  it('rejeita sem nativo instalado', async () => {
    const updater = loadUpdater(null as unknown as MockNative);
    delete (NativeModules as Record<string, unknown>).ApkDownloader;
    let mod!: typeof import('../src/services/apkUpdater');
    jest.isolateModules(() => {
      mod = require('../src/services/apkUpdater');
    });

    await expect(mod.downloadApk(URL_OK, 'bussola.apk')).rejects.toThrow(
      'apk_downloader_unavailable',
    );
expect(updater.isApkDownloaderAvailable()).toBe(false);
  });
});

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

describe('apkUpdater — conferir o hash antes de instalar', () => {
  let native: MockNative;

  beforeEach(() => {
    native = mockNative();
  });

  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).ApkDownloader;
    jest.restoreAllMocks();
  });

  it('aceita o prefixo sha256: que a GitHub devolve', () => {
    const updater = loadUpdater(native);
    expect(updater.normalizeSha256(`sha256:${SHA_A}`)).toBe(SHA_A);
    expect(updater.normalizeSha256(`SHA-256:${SHA_A.toUpperCase()}`)).toBe(SHA_A);
  });

  it('trata hash mal formado como "não sei", nunca como "bate certo"', () => {
    const updater = loadUpdater(native);
    expect(updater.normalizeSha256('')).toBe('');
    expect(updater.normalizeSha256(null)).toBe('');
    expect(updater.normalizeSha256(undefined)).toBe('');
    expect(updater.normalizeSha256('sha256:')).toBe('');
    expect(updater.normalizeSha256(SHA_A.slice(0, 63))).toBe('');
    // 65 caracteres: um a mais, e já não é o hash do ficheiro anunciado.
    expect(updater.normalizeSha256(`${SHA_A}a`)).toBe('');
    expect(updater.normalizeSha256('z'.repeat(64))).toBe('');
  });

  it('confere o ficheiro com o hash esperado', async () => {
    const updater = loadUpdater(native);

    await expect(updater.verifyApk('content://media/1', SHA_A)).resolves.toBe(true);
    expect(native.verify).toHaveBeenCalledWith('content://media/1', SHA_A);
  });

  it('propaga hash_mismatch do nativo em vez de engolir', async () => {
    const updater = loadUpdater(native);
    native.verify.mockRejectedValue(new Error('O arquivo não é o APK anunciado'));

    // Um `catch` que devolvesse `false` aqui transformava um APK trocado num
    // "a verificação falhou, instalo assim mesmo".
    await expect(updater.verifyApk('content://media/1', SHA_B)).rejects.toThrow(
      'não é o APK anunciado',
    );
  });

  it('não chama o nativo com hash ausente', async () => {
    const updater = loadUpdater(native);

    await expect(updater.verifyApk('content://media/1', 'nada')).rejects.toThrow(
      'hash_missing',
    );
    expect(native.verify).not.toHaveBeenCalled();
  });

  it('rejeita quando o nativo antigo não tem verify', async () => {
    const updater = loadUpdater({
      download: jest.fn(),
      install: jest.fn(),
    } as unknown as MockNative);

    await expect(updater.verifyApk('content://media/1', SHA_A)).rejects.toThrow(
      'apk_verify_unavailable',
    );
  });
});
