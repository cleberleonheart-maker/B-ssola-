import fs from 'fs';
import path from 'path';

type UpsertResult = {
  error: { message: string } | null;
};

const loadCloud = (result: UpsertResult) => {
  const upsert = jest.fn().mockResolvedValue(result);
  const from = jest.fn(() => ({ upsert }));
  jest.doMock('@react-native-async-storage/async-storage', () => ({}));
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
      auth: { getSession: jest.fn() },
      from,
    })),
  }));
  let cloud!: typeof import('../src/services/cloud');
  jest.isolateModules(() => {
    cloud = jest.requireActual('../src/services/cloud') as typeof import('../src/services/cloud');
  });
  return { cloud, from, upsert };
};

describe('pushLivePosition', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('@supabase/supabase-js');
    jest.resetModules();
  });

  it('retorna false quando o Supabase recusa o upsert', async () => {
    const { cloud, upsert } = loadCloud({
      error: { message: 'new row violates row-level security policy' },
    });

    await expect(
      cloud.pushLivePosition('lnv1', 'user-1', -15.8, -47.9, 5, 90, Date.now() + 60_000),
    ).resolves.toBe(false);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('retorna true quando o upsert nao retorna erro', async () => {
    const { cloud } = loadCloud({ error: null });

    await expect(
      cloud.pushLivePosition('lnv2', 'user-1', -15.8, -47.9, 5, 90, Date.now() + 60_000),
    ).resolves.toBe(true);
  });

  it('o Alert recebe a frase do Supabase, nao um "nao configurado"', async () => {
    // O `client` ficar `null` parecia configuracao errada e levava a culpar o
    // projeto e as credenciais. A razao verdadeira e a excecao do
    // `createClient`, e e essa que tem de aparecer no dialogo.
    jest.doMock('@react-native-async-storage/async-storage', () => ({}));
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => {
        throw new Error('Invalid supabaseUrl: Provided URL is malformed.');
      }),
    }));
    let cloud!: typeof import('../src/services/cloud');
    jest.isolateModules(() => {
      cloud = jest.requireActual('../src/services/cloud') as typeof import('../src/services/cloud');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(cloud.ensureCloudUser()).resolves.toBeNull();

    expect(cloud.takeCloudError()).toBe(
      'cliente: Invalid supabaseUrl: Provided URL is malformed.',
    );
    warn.mockRestore();
  });
});

/**
 * O Hermes nao regista um `URL` global e o supabase-js valida o project URL com
 * `new URL(...)`. O sintoma — `createClient` a atirar no aparelho e nunca no
 * Node — e invisivel para a suite toda, porque o Node tem `URL`. Por isso a
 * ordem dos imports em `index.js` fica verificada aqui: se alguem mexer, este
 * teste acende em vez de o aparelho voltar a falhar em silencio.
 */
describe('o polyfill de URL chega antes do supabase-js', () => {
  it('react-native-url-polyfill/auto e o primeiro import de index.js', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    const imports = source
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('import '));

    expect(imports[0]).toBe("import 'react-native-url-polyfill/auto';");
    const polyfillAt = imports.indexOf("import 'react-native-url-polyfill/auto';");
    const reactNativeAt = imports.findIndex((line) => line.includes("'react-native'"));
    expect(polyfillAt).toBeGreaterThanOrEqual(0);
    expect(polyfillAt).toBeLessThan(reactNativeAt);
  });
});
