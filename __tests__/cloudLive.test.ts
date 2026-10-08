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

/**
 * A limpeza do que passou do prazo.
 *
 * A pergunta que estes testes fazem é "apanha só as minhas linhas?", e não
 * "apanha alguma linha?". A RLS já garante que ninguém apaga o que é de outro —
 * as políticas de DELETE comparam `user_id` com `auth.uid()` — por isso tirar o
 * `.eq('user_id')` não seria uma falha de segurança, e é precisamente por isso
 * que passa despercebido. Passaria a ser um delete sobre a tabela toda a
 * filtrar por data, que em `live_points` é uma tabela que só cresce.
 *
 * E o inverso também merece ser verificado: um `lt('expires_at', <data futura>)`
 * apanharia as linhas da sessão que está a decorrer, e o link vivo deixava de ter
 * trajecto a meio.
 */
const carregarParaPurga = () => {
  const chamadas: string[] = [];
  const registar = (nome: string) => (...args: unknown[]) => {
    chamadas.push(`${nome}(${args.map(a => JSON.stringify(a)).join(', ')})`);
    return builder;
  };
  const builder: Record<string, unknown> = {};
  const remove = jest.fn(() => {
    chamadas.push('delete()');
    return builder;
  });
  builder.eq = registar('eq');
  builder.lt = registar('lt');
  builder.gt = registar('gt');
  const from = jest.fn((tabela: string) => {
    chamadas.push(`from(${JSON.stringify(tabela)})`);
    return { delete: remove };
  });
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
  return { cloud, chamadas };
};

describe('a limpeza apanha só o que é nosso e só o que já passou do prazo', () => {
  beforeEach(() => jest.resetModules());
  afterEach(() => {
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('@supabase/supabase-js');
    jest.resetModules();
  });

  it('os relatórios de crash', async () => {
    const { cloud, chamadas } = carregarParaPurga();
    await cloud.deleteExpiredCrashReports('user-abc');
    expect(chamadas[0]).toBe('from("crashes")');
    expect(chamadas).toContain('eq("user_id", "user-abc")');
    // `lt` e não `lte`: o prazo e o instante a partir do qual a linha nao
    // interessa, e uma linha que expire este segundo ainda esta no prazo.
    expect(chamadas.some(c => c.startsWith('lt("expires_at"'))).toBe(true);
    // O filtro invertido é o erro que não dói a ver: `gt('expires_at', <agora>)`
    // apaga exactamente as linhas que ainda estão no prazo, e o teste de cima
    // continuava a ver um filtro de data qualquer. Aqui fica dito: nenhum `gt`.
    expect(chamadas.some(c => c.startsWith('gt('))).toBe(false);
  });

  it('os pontos do trajecto', async () => {
    const { cloud, chamadas } = carregarParaPurga();
    await cloud.deleteExpiredLivePoints('user-abc');
    expect(chamadas[0]).toBe('from("live_points")');
    expect(chamadas).toContain('eq("user_id", "user-abc")');
    expect(chamadas.some(c => c.startsWith('lt("expires_at"'))).toBe(true);
  });

  it('a data que apaga é o agora, não uma constante em código', async () => {
    const { cloud, chamadas } = carregarParaPurga();
    const antes = Date.now();
    await cloud.deleteExpiredLivePoints('user-abc');
    const limite = chamadas.find(c => c.startsWith('lt("expires_at"'))!;
    const valor = JSON.parse(limite.slice(limite.indexOf(',') + 1, -1)) as string;
    // Se isto for uma data escrita à mão, o teste passa durante uma semana e
    // depois começa a apagar as linhas da sessão que está a decorrer.
    expect(Date.parse(valor)).toBeGreaterThanOrEqual(antes - 2000);
    expect(Date.parse(valor)).toBeLessThanOrEqual(Date.now() + 2000);
  });

  it('não apaga nada quando o Supabase está desligado', async () => {
    // O `client` fica null quando o `createClient` atira — é o mesmo caminho que
    // o polyfill de URL em falta tomava, e a razão de o `index.js` carregar
    // aquele import antes de tudo. Apagar sem cliente tem de ser `false` e não um
    // erro: é higiene, e ninguém tem de ver um aviso por uma limpeza de rotina.
    const avisos: unknown[][] = [];
    const spy = jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      avisos.push(args);
    });
    jest.doMock('@react-native-async-storage/async-storage', () => ({}));
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => {
        throw new Error('Invalid supabaseUrl');
      }),
    }));
    let cloud!: typeof import('../src/services/cloud');
    jest.isolateModules(() => {
      cloud = jest.requireActual('../src/services/cloud') as typeof import('../src/services/cloud');
    });
    try {
      await expect(cloud.deleteExpiredCrashReports('user-abc')).resolves.toBe(false);
      await expect(cloud.deleteExpiredLivePoints('user-abc')).resolves.toBe(false);
      // Sem cliente não há `from` a que se pudesse chamar — o mock do supabase
      // nem chega a criar um — por isso o que se mede é o resultado (`false`) e
      // que a limpeza não deixou rasto: nem `noteCloudError`, que é o que
      // `takeCloudError` devolve, nem um aviso de limpeza no console.
      expect(cloud.takeCloudError()).toBeNull();
      expect(avisos.filter(a => String(a[0]).includes('limpeza'))).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});

/**
 * O painel de Configurações (#99). Não testa pixel: testa o que ele diz.
 *
 * A pergunta que ele responde no próprio aparelho é "isto está a falar com o
 * Supabase ou não?" — por isso o que interessa é a razão (a exceção do
 * `createClient`, não um genérico "desligado"), a última falha sem ser
 * consumida (o Alert do rastreio é que a limpa) e a última sincronização
 * medida por resposta, não por tentativa.
 */
describe('o estado da nuvem em Configurações (#99)', () => {
  beforeEach(() => jest.resetModules());
  afterEach(() => {
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('@supabase/supabase-js');
    jest.resetModules();
  });

  it('cliente criado, sem nada para dizer', () => {
    const { cloud } = loadCloud({ error: null });
    expect(cloud.cloudStatus()).toEqual({
      enabled: true,
      connected: true,
      clientError: null,
      lastError: null,
      lastSyncAt: null,
    });
  });

  it('quando não está ligado, diz a razão da exceção', () => {
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

    const status = cloud.cloudStatus();
    expect(status.enabled).toBe(true);
    expect(status.connected).toBe(false);
    expect(status.clientError).toBe(
      'Invalid supabaseUrl: Provided URL is malformed.',
    );
  });

  it('uma resposta sem erro conta como última sincronização', async () => {
    const { cloud } = loadCloud({ error: null });
    const antes = Date.now();
    await expect(
      cloud.pushLivePosition('lnv9', 'user-1', -15.8, -47.9, 5, 90, Date.now() + 60_000),
    ).resolves.toBe(true);

    const at = cloud.cloudStatus().lastSyncAt;
    expect(at).not.toBeNull();
    expect(at!).toBeGreaterThanOrEqual(antes);
  });

  it('uma recusa do Supabase não conta como sincronização', async () => {
    const { cloud } = loadCloud({
      error: { message: 'new row violates row-level security policy' },
    });
    await expect(
      cloud.pushLivePosition('lnv9', 'user-1', -15.8, -47.9, 5, 90, Date.now() + 60_000),
    ).resolves.toBe(false);

    expect(cloud.cloudStatus().lastSyncAt).toBeNull();
  });

  it('a última falha é lida sem ser consumida', () => {
    const { cloud } = loadCloud({ error: null });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      cloud.noteCloudError('live push', 'sem rede');
      expect(cloud.cloudStatus().lastError).toBe('live push: sem rede');
      expect(cloud.takeCloudError()).toBe('live push: sem rede');
      expect(cloud.cloudStatus().lastError).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });
});

/**
 * O histórico de partilhas (#100).
 *
 * Parar deixou de apagar a linha — apagá-la era apagar a prova de que a sessão
 * existiu, e sem ela o "histórico" era uma lista vazia sempre. Agora o Parar
 * escreve `stopped_at`, e a lista lê os carimbos de tempo sem voltar a pedir
 * coordenadas: a posição de uma sessão que já acabou não interessa ao ecrã de
 * Configurações, e o que não se pede não se arrisca a receber.
 *
 * O que se verifica aqui é a ordem das escritas e o critério de reserva: só
 * apagar quando a marca não pegou, nunca por omissão.
 */
const carregarParaPartilhas = () => {
  const chamadas: string[] = [];
  const actual: { resultado: { data: unknown; error: { message: string } | null } } = {
    resultado: { data: [], error: null },
  };
  const construir = () => {
    const registar =
      (nome: string) =>
      (...args: unknown[]) => {
        chamadas.push(`${nome}(${args.map(a => JSON.stringify(a)).join(', ')})`);
        return b;
      };
    const b: Record<string, unknown> = {
      eq: registar('eq'),
      order: registar('order'),
      update: registar('update'),
      delete: registar('delete'),
      select: registar('select'),
      limit: registar('limit'),
    };
    // O builder do supabase-js e encadeavel *e* esperavel: `await` no fim da
    // cadeia e o que devolve os dados. Sem o `then`, a promessa resolveria com
    // o proprio objeto e todo o teste passaria a olhar para `undefined`.
    b.then = (onOk: unknown, onErr: unknown) =>
      Promise.resolve(actual.resultado).then(
        onOk as (v: unknown) => unknown,
        onErr as (e: unknown) => unknown,
      );
    return b;
  };
  const from = jest.fn((tabela: string) => {
    chamadas.push(`from(${JSON.stringify(tabela)})`);
    return construir();
  });
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
  const setResultado = (data: unknown, error: { message: string } | null = null) => {
    actual.resultado = { data, error };
  };
  return { cloud, chamadas, setResultado };
};

describe('parar marca a sessão e só apaga se a marca não pegar (#100)', () => {
  beforeEach(() => jest.resetModules());
  afterEach(() => {
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('@supabase/supabase-js');
    jest.resetModules();
  });

  it('escreve stopped_at na linha do próprio e leva os pontos embora', async () => {
    const { cloud, chamadas, setResultado } = carregarParaPartilhas();
    setResultado([{ token: 'lnv1' }]);

    await expect(cloud.markLiveShareStopped('lnv1', 'user-1')).resolves.toBe(true);

    const update = chamadas.find(c => c.startsWith('update('));
    expect(update).toBeDefined();
    const payload = JSON.parse(update!.slice('update('.length, -1)) as { stopped_at: string };
    expect(new Date(payload.stopped_at).toISOString()).toBe(payload.stopped_at);
    expect(Math.abs(Date.parse(payload.stopped_at) - Date.now())).toBeLessThan(5000);
    expect(chamadas).toContain('eq("token", "lnv1")');
    expect(chamadas).toContain('eq("user_id", "user-1")');
    // A linha fica; o trajecto é que sai, tal como saía quando o Parar apagava
    // a sessão inteira. Os pontos de uma sessão parada não se pedem mais.
    expect(chamadas).toContain('from("live_points")');
    expect(chamadas.some(c => c.startsWith('delete('))).toBe(true);
  });

  it('sem apagar nada quando o Supabase recusa a marca', async () => {
    const { cloud, chamadas, setResultado } = carregarParaPartilhas();
    setResultado(null, { message: 'new row violates row-level security policy' });

    await expect(cloud.markLiveShareStopped('lnv1', 'user-1')).resolves.toBe(false);

    // Reserva, não rotina: quem não conseguiu marcar é que decide apagar.
    expect(chamadas.some(c => c.startsWith('delete('))).toBe(false);
    expect(chamadas).not.toContain('from("live_points")');
    expect(cloud.takeCloudError()).toContain('live stop');
  });

  it('sem apagar nenhuma linha afectada — o update não viu nada do nosso', async () => {
    const { cloud, chamadas, setResultado } = carregarParaPartilhas();
    setResultado([]);

    await expect(cloud.markLiveShareStopped('lnv1', 'user-1')).resolves.toBe(false);
    expect(chamadas.some(c => c.startsWith('delete('))).toBe(false);
  });

  it('sem cliente, não marca nem apaga', async () => {
    jest.doMock('@react-native-async-storage/async-storage', () => ({}));
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => {
        throw new Error('Invalid supabaseUrl');
      }),
    }));
    let cloud!: typeof import('../src/services/cloud');
    jest.isolateModules(() => {
      cloud = jest.requireActual('../src/services/cloud') as typeof import('../src/services/cloud');
    });

    await expect(cloud.markLiveShareStopped('lnv1', 'user-1')).resolves.toBe(false);
  });
});

describe('o histórico lê só os carimbos, do próprio, do mais recente para trás', () => {
  beforeEach(() => jest.resetModules());
  afterEach(() => {
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('@supabase/supabase-js');
    jest.resetModules();
  });

  it('pede os campos de tempo, filtra por dono e ordena por início', async () => {
    const { cloud, chamadas, setResultado } = carregarParaPartilhas();
    const linha = {
      token: 'lnv1',
      started_at: '2026-10-14T21:00:00.000Z',
      stopped_at: '2026-10-14T21:12:00.000Z',
      expires_at: '2026-10-14T21:30:00.000Z',
      updated_at: '2026-10-14T21:12:00.000Z',
    };
    setResultado([linha]);

    await expect(cloud.fetchLiveShareHistory('user-1', 5)).resolves.toEqual([linha]);

    expect(chamadas).toContain('from("live_shares")');
    expect(chamadas).toContain(
      'select("token, started_at, stopped_at, expires_at, updated_at")',
    );
    expect(chamadas).toContain('eq("user_id", "user-1")');
    expect(chamadas).toContain('order("started_at", {"ascending":false})');
    expect(chamadas).toContain('limit(5)');
    // Sem `updated_at` na lista de colunas a ordem ainda funcionaria, mas o
    // "quando parou" viria sem a coluna que a preenche — e o ecrã mostraria
    // uma hora que não mudou quando a pessoa carregou em Parar.
    expect(chamadas.some(c => c.includes('latitude'))).toBe(false);
  });

  it('devolve lista vazia em vez de rebentar quando o Supabase recusa', async () => {
    const { cloud, setResultado } = carregarParaPartilhas();
    setResultado(null, { message: 'permission denied' });

    await expect(cloud.fetchLiveShareHistory('user-1')).resolves.toEqual([]);
    expect(cloud.takeCloudError()).toContain('live history');
  });
});

/**
 * Apagar a minha conta e os dados (ideia #101).
 *
 * O que se verifica aqui é a divisão de poderes: o apagar fica na função da
 * base de dados (`delete_my_account`, SECURITY DEFINER), e o cliente só pede,
 * e o `signOut` a seguir à resposta — onde o id já não existe, e um pedido
 * futuro com ele é um 400 que ninguém percebe.
 */
const carregarParaConta = (resultado: {
  data: unknown;
  error: { message: string } | null;
}) => {
  const rpc = jest.fn().mockResolvedValue(resultado);
  const signOut = jest.fn().mockResolvedValue({ error: null });
  jest.doMock('@react-native-async-storage/async-storage', () => ({}));
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
      auth: { getSession: jest.fn(), signOut },
      rpc,
    })),
  }));
  let cloud!: typeof import('../src/services/cloud');
  jest.isolateModules(() => {
    cloud = jest.requireActual('../src/services/cloud') as typeof import('../src/services/cloud');
  });
  return { cloud, rpc, signOut };
};

describe('apagar a conta pede a RPC e desliga a sessão (#101)', () => {
  beforeEach(() => jest.resetModules());
  afterEach(() => {
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('@supabase/supabase-js');
    jest.resetModules();
  });

  it('chama a RPC e sai da sessão quando o servidor apagou', async () => {
    const { cloud, rpc, signOut } = carregarParaConta({ data: true, error: null });

    await expect(cloud.deleteMyAccount()).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('a RPC devolve false e o cliente não finge ter apagado', async () => {
    const { cloud, signOut } = carregarParaConta({ data: false, error: null });

    await expect(cloud.deleteMyAccount()).resolves.toBe(false);
    // Saiu da sessão na mesma: o id já não é o desta conta, e continuar a usá-lo
    // em pedidos futuros seria um 400 de PostgREST que ninguém entende.
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('recusado pelo Supabase não apaga nem desliga', async () => {
    const { cloud, signOut } = carregarParaConta({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(cloud.deleteMyAccount()).resolves.toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    expect(cloud.takeCloudError()).toContain('conta');
  });

  it('sem cliente, devolve false sem atirar', async () => {
    jest.doMock('@react-native-async-storage/async-storage', () => ({}));
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => {
        throw new Error('Invalid supabaseUrl');
      }),
    }));
    let cloud!: typeof import('../src/services/cloud');
    jest.isolateModules(() => {
      cloud = jest.requireActual('../src/services/cloud') as typeof import('../src/services/cloud');
    });

    await expect(cloud.deleteMyAccount()).resolves.toBe(false);
    expect(cloud.takeCloudError()).toContain('conta');
  });
});

/**
 * Ligar a conta anónima a um email (ideia #102).
 *
 * O Supabase converte o utilizador anónimo em permanente com `updateUser` e
 * MANTER o mesmo id — não há migração de linhas a fazer. O que se verifica
 * aqui é que o `linkEmail` garante uma sessão, limpa e normaliza o email antes
 * de o pedir, envia a senha com o email quando ela existe (e recusa-a se vier
 * curta demais), e que só um pedido aceite conta como sucesso; e que o
 * `currentAccountStatus` lê a identidade do `getUser` sem mexer na sessão.
 */
const carregarParaLigacao = (utilizador: {
  email?: string | null;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
} = {}) => {
  const updateUser = jest.fn().mockResolvedValue({ data: null, error: null });
  const getUser = jest.fn().mockResolvedValue({
    data: {
      user: {
        id: 'user-1',
        email: utilizador.email ?? null,
        email_confirmed_at: utilizador.email_confirmed_at ?? null,
        is_anonymous: utilizador.is_anonymous,
      },
    },
    error: null,
  });
  const getSession = jest.fn().mockResolvedValue({ data: { session: null }, error: null });
  const signInAnonymously = jest
    .fn()
    .mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  jest.doMock('@react-native-async-storage/async-storage', () => ({}));
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
      auth: { getSession, signInAnonymously, getUser, updateUser },
    })),
  }));
  let cloud!: typeof import('../src/services/cloud');
  jest.isolateModules(() => {
    cloud = jest.requireActual('../src/services/cloud') as typeof import('../src/services/cloud');
  });
  const pôrResultado = (error: { message: string } | null) => {
    updateUser.mockResolvedValue({ data: null, error });
  };
  return { cloud, updateUser, getSession, signInAnonymously, getUser, pôrResultado };
};

describe('ligar a conta a um email (#102)', () => {
  beforeEach(() => jest.resetModules());
  afterEach(() => {
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('@supabase/supabase-js');
    jest.resetModules();
  });

  it('liga, com sessão anónima assegurada e o email limpo', async () => {
    const { cloud, updateUser, signInAnonymously } = carregarParaLigacao();

    await expect(cloud.linkEmail('  Pessoa@Exemplo.com  ')).resolves.toBe(true);

    // O utilizador vinha sem sessão: o `updateUser` só faz sentido ao pé de uma.
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith({ email: 'pessoa@exemplo.com' });
  });

  it('com senha, liga o email e grava o login na mesma chamada', async () => {
    const { cloud, updateUser } = carregarParaLigacao();

    await expect(
      cloud.linkEmail('pessoa@exemplo.com', 'minha-senha-segura'),
    ).resolves.toBe(true);

    expect(updateUser).toHaveBeenCalledWith({
      email: 'pessoa@exemplo.com',
      password: 'minha-senha-segura',
    });
  });

  it('senha curta demais não é enviada', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { cloud, updateUser } = carregarParaLigacao();

      await expect(cloud.linkEmail('pessoa@exemplo.com', '123')).resolves.toBe(false);
      expect(updateUser).not.toHaveBeenCalled();
      expect(cloud.takeCloudError()).toContain('senha muito curta');
    } finally {
      warn.mockRestore();
    }
  });

  it('recusado pelo Supabase não liga e o motivo chega ao ecrã', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { cloud, updateUser, pôrResultado } = carregarParaLigacao();
      pôrResultado({ message: 'Manual linking is disabled' });

      await expect(cloud.linkEmail('pessoa@exemplo.com')).resolves.toBe(false);
      expect(updateUser).toHaveBeenCalledWith({ email: 'pessoa@exemplo.com' });
      expect(cloud.takeCloudError()).toContain('Manual linking is disabled');
    } finally {
      warn.mockRestore();
    }
  });

  it('email mal formado não é enviado', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { cloud, updateUser } = carregarParaLigacao();

      await expect(cloud.linkEmail('nao-e-um-email')).resolves.toBe(false);
      expect(updateUser).not.toHaveBeenCalled();
      expect(cloud.takeCloudError()).toContain('email invalido');
    } finally {
      warn.mockRestore();
    }
  });

  it('o estado diz anónimo enquanto não há email', async () => {
    const { cloud } = carregarParaLigacao({ is_anonymous: true });

    await expect(cloud.currentAccountStatus()).resolves.toEqual({
      email: null,
      confirmed: false,
      anonymous: true,
    });
  });

  it('o estado diz o email confirmado quando já não é anónimo', async () => {
    const { cloud } = carregarParaLigacao({
      email: 'pessoa@exemplo.com',
      email_confirmed_at: '2026-10-08T12:00:00.000Z',
      is_anonymous: false,
    });

    await expect(cloud.currentAccountStatus()).resolves.toEqual({
      email: 'pessoa@exemplo.com',
      confirmed: true,
      anonymous: false,
    });
  });

  it('sem cliente, ligar devolve false e o estado devolve null', async () => {
    jest.doMock('@react-native-async-storage/async-storage', () => ({}));
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => {
        throw new Error('Invalid supabaseUrl');
      }),
    }));
    let cloud!: typeof import('../src/services/cloud');
    jest.isolateModules(() => {
      cloud = jest.requireActual('../src/services/cloud') as typeof import('../src/services/cloud');
    });

    await expect(cloud.linkEmail('pessoa@exemplo.com')).resolves.toBe(false);
    await expect(cloud.currentAccountStatus()).resolves.toBeNull();
  });
});
