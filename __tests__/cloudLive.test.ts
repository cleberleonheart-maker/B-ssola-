import fs from 'fs';
import path from 'path';

type UpsertResult = {
  error: { message: string } | null;
};

const loadCloud = (result: UpsertResult) => {
  const upsert = jest.fn().mockResolvedValue(result);
  const insert = jest.fn().mockResolvedValue(result);
  // O `delete` do supabase-js e um encadeamento: cada `eq` devolve o proprio
  // builder, senao a segunda comparacao rebenta em `undefined` e o teste passa
  // a testar outra coisa sem dar conta.
  const builder: { eq: jest.Mock } = { eq: jest.fn() };
  builder.eq.mockReturnValue(builder);
  const remove = jest.fn(() => builder);
  const from = jest.fn((_table: string) => ({ upsert, insert, delete: remove }));
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
  return { cloud, from, upsert, insert, remove, builder };
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

  it('o provider anonimo desligado chega ao Alert com a frase do Supabase', async () => {
    // Era este o caso que aparecia no aparelho: o GoTrue responde 422 com
    // `anonymous_provider_disabled`, o `error` era descartado e o alerta dizia
    // "sem user id na resposta" -- que manda caçar um bug no parsing quando o
    // problema e uma opcao do projeto.
    jest.doMock('@react-native-async-storage/async-storage', () => ({}));
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => ({
        auth: {
          getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
          signInAnonymously: jest.fn().mockResolvedValue({
            data: { user: null, session: null },
            error: { message: 'Anonymous sign-ins are disabled' },
          }),
        },
      })),
    }));
    let cloud!: typeof import('../src/services/cloud');
    jest.isolateModules(() => {
      cloud = jest.requireActual('../src/services/cloud') as typeof import('../src/services/cloud');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(cloud.ensureCloudUser()).resolves.toBeNull();

    expect(cloud.takeCloudError()).toBe(
      'login anonimo: Anonymous sign-ins are disabled',
    );
    warn.mockRestore();
  });
});

/**
 * O trajecto (#92). `live_shares` e um `upsert` por token — uma linha, um
 * ponto — e por isso o viewer so via o caminho percorrido se a pagina estivesse
 * aberta desde o inicio. `live_points` e o registo: um `insert` por fix, com o
 * `id` a ser posto pelo servidor porque e esse `id` que o viewer usa para pedir
 * so o que ainda nao leu.
 */
describe('pushLivePoint', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('@supabase/supabase-js');
    jest.resetModules();
  });

  it('vai para live_points, e nao para a linha do upsert', async () => {
    const { cloud, from } = loadCloud({ error: null });

    await expect(
      cloud.pushLivePoint(
        'lnv1',
        'user-1',
        -15.8,
        -47.9,
        5,
        90,
        1.4,
        1100,
        Date.now() + 60_000,
      ),
    ).resolves.toBe(true);

    expect(from).toHaveBeenCalledWith('live_points');
  });

  it('grava as coordenadas, o dono e o prazo da sessao', async () => {
    const { cloud, insert } = loadCloud({ error: null });
    const expiresAt = Date.now() + 60_000;

    await cloud.pushLivePoint(
      'lnv1',
      'user-1',
      -15.8,
      -47.9,
      5,
      90,
      1.4,
      1100,
      expiresAt,
    );

    // Sem o `expires_at` o ponto nao se distingue de um de uma sessao a
    // terminar, e a purga passa a precisar de adivinhar.
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'lnv1',
        user_id: 'user-1',
        latitude: -15.8,
        longitude: -47.9,
        accuracy: 5,
        heading: 90,
        speed: 1.4,
        altitude: 1100,
        expires_at: new Date(expiresAt).toISOString(),
      }),
    );
  });

  it('cada fix e uma linha nova: sem onConflict para resolver conflito', async () => {
    const { cloud, insert } = loadCloud({ error: null });

    await cloud.pushLivePoint('lnv1', 'user-1', -15.8, -47.9, null, null, null, null, Date.now());

    // Um segundo argumento aqui seria `{ onConflict }`, e viraria update: o
    // ponto anterior desapareceria e o trajecto voltava a ser uma recta.
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]).toHaveLength(1);
  });

  it('devolve false quando a RLS recusa o insert', async () => {
    const { cloud, from } = loadCloud({
      error: { message: 'new row violates row-level security policy' },
    });

    await expect(
      cloud.pushLivePoint('lnv1', 'user-1', -15.8, -47.9, 5, 90, 1.4, 1100, Date.now()),
    ).resolves.toBe(false);
    expect(from).toHaveBeenCalledWith('live_points');
  });
});

describe('deleteLiveShareRow', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('@supabase/supabase-js');
    jest.resetModules();
  });

  it('apaga a linha e o trajecto, porque um link encerrado nao guarda caminho', async () => {
    const { cloud, from, builder } = loadCloud({ error: null });

    await expect(cloud.deleteLiveShareRow('lnv1', 'user-1')).resolves.toBe(true);

    expect(from).toHaveBeenCalledWith('live_shares');
    expect(from).toHaveBeenCalledWith('live_points');
    // Duas condicoes por tabela: `token` e `user_id`. Sem a segunda, um id
    // trocado ia apagar o trajecto de outra pessoa.
    expect(builder.eq).toHaveBeenCalledTimes(4);
    expect(builder.eq).toHaveBeenCalledWith('token', 'lnv1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
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
