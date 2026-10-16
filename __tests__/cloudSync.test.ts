/**
 * O sync da ideia #18: pull → merge → push, junção por `id` (o local ganha no
 * empate), e a lápide que impede um item apagado de ressuscitar no pull
 * seguinte.
 *
 * Usa o mesmo truque do `cloudLive.test.ts`: um cliente Supabase falso com um
 * armazenamento em memória, carregado dentro de `isolateModules` — assim o
 * `cloud.ts` (que cria o cliente no arranque do módulo) enxerga o mock, e o
 * `AsyncStorage` do `waypointsService` é o mesmo do sync. Fora do isolate os
 * dois teriam cópias diferentes e o teste passava a testar outra coisa.
 */

type Row = { user_id: string; id: string; data: unknown; updated_at: string };

type FakeOptions = {
  rows?: Record<string, Row[]>;
  /** A auth não devolve sessão nem consegue entrar: o caminho "offline". */
  authFail?: boolean;
  /** O PostgREST recusa o upsert. */
  upsertError?: string | null;
  /** O PostgREST recusa o delete (a lápide fica por propagar). */
  deleteError?: string | null;
};

const store: Record<string, Row[]> = {};

const makeClient = (opts: FakeOptions) => {
  const auth = {
    getSession: jest.fn().mockResolvedValue(
      opts.authFail
        ? { data: { session: null }, error: null }
        : {
            data: { session: { user: { id: 'user-1' } } },
            error: null,
          },
    ),
    signInAnonymously: jest.fn().mockResolvedValue(
      opts.authFail
        ? {
            data: { user: null },
            error: { message: 'anonymous_provider_disabled' },
          }
        : { data: { user: { id: 'user-1' } }, error: null },
    ),
  };

  const from = (table: string) => {
    const preds: { col: string; val: unknown; op: 'eq' | 'in' }[] = [];
    const matches = (row: Row) =>
      preds.every(p => {
        const atual = row[p.col as keyof Row];
        return p.op === 'eq'
          ? atual === p.val
          : (p.val as unknown[]).includes(atual);
      });

    const terminal = () => ({
      data: (store[table] ?? []).filter(matches).map(r => ({ ...r })),
      error: null,
    });

    const builder: Record<string, unknown> = {
      select: () => builder,
      order: () => builder,
      limit: () => Promise.resolve(terminal()),
      eq: (col: string, val: unknown) => {
        preds.push({ col, val, op: 'eq' });
        return builder;
      },
      in: (col: string, val: unknown) => {
        preds.push({ col, val, op: 'in' });
        return Promise.resolve(terminal());
      },
      delete: () => builder,
      upsert: (rows: Row[]) => {
        if (opts.upsertError) return Promise.resolve({ error: { message: opts.upsertError } });
        const map = new Map((store[table] ?? []).map(r => [r.id, r]));
        for (const row of rows) map.set(row.id, row);
        store[table] = [...map.values()];
        return Promise.resolve({ error: null });
      },
    };

    // O `delete` real encadeia `.delete().eq(...).in(...)` e o terminal devolve
    // `{ error }`. Aqui o `.in` acima já resolve; para o delete preciso de
    // remover as linhas que casam, não devolvê-las.
    const deletar = () => {
      if (opts.deleteError) {
        return Promise.resolve({ error: { message: opts.deleteError } });
      }
      store[table] = (store[table] ?? []).filter(row => !matches(row));
      return Promise.resolve({ error: null });
    };
    builder.in = (col: string, val: unknown) => {
      preds.push({ col, val, op: 'in' });
      // No select o terminal resolve; no delete, apaga.
      return preds.some(p => p.op === 'in') && builder.__delete
        ? deletar()
        : Promise.resolve(terminal());
    };
    builder.delete = () => {
      builder.__delete = true;
      return builder;
    };
    return builder;
  };

  return { auth, from };
};

const loadModules = (opts: FakeOptions = {}) => {
  jest.resetModules();
  for (const key of Object.keys(store)) delete store[key];
  Object.assign(store, opts.rows ?? {});
  jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => makeClient(opts)),
  }));

  let cloudSync!: typeof import('../src/services/cloudSync');
  let waypointsService!: typeof import('../src/services/waypointsService');
  jest.isolateModules(() => {
    cloudSync = jest.requireActual(
      '../src/services/cloudSync',
    ) as typeof import('../src/services/cloudSync');
    waypointsService = jest.requireActual(
      '../src/services/waypointsService',
    ) as typeof import('../src/services/waypointsService');
  });
  return { cloudSync, waypointsService };
};

const wp = (id: string, name: string): import('../src/services/waypointsService').Waypoint => ({
  id,
  name,
  latitude: -15.8,
  longitude: -47.9,
  altitude: null,
  createdAt: 1,
});

describe('mergeCloudItems', () => {
  it('o local ganha no empate e o que só está na nuvem entra no fim', async () => {
    const { cloudSync } = loadModules();
    const local = [wp('a', 'Casa'), wp('b', 'Mirante')];
    const remoto = [wp('b', 'Mirante (editado)'), wp('c', 'Cachoeira')];

    const merged = cloudSync.mergeCloudItems(local, remoto);

    expect(merged.map(w => w.id)).toEqual(['a', 'b', 'c']);
    expect(merged.find(w => w.id === 'b')?.name).toBe('Mirante');
  });
});

describe('syncWaypoints', () => {
  it('recupera um ponto que só existe na nuvem (aparelho novo)', async () => {
    const { cloudSync, waypointsService } = loadModules({
      rows: {
        waypoints: [
          {
            user_id: 'user-1',
            id: 'remoto-1',
            data: { name: 'Cachoeira', latitude: -1, longitude: -2, altitude: null, createdAt: 5 },
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      },
    });

    const resultado = await cloudSync.syncWaypoints();

    expect(resultado.map(w => w.id)).toEqual(['remoto-1']);
    expect(await waypointsService.loadWaypoints()).toHaveLength(1);
  });

  it('apaga na nuvem o ponto que foi apagado aqui (lápide)', async () => {
    const { cloudSync, waypointsService } = loadModules({
      rows: {
        waypoints: [
          {
            user_id: 'user-1',
            id: 'morto',
            data: { name: 'Apagado', latitude: 0, longitude: 0, altitude: null, createdAt: 1 },
            updated_at: '2026-01-01T00:00:00Z',
          },
          {
            user_id: 'user-1',
            id: 'vivo',
            data: { name: 'Vivo', latitude: 1, longitude: 1, altitude: null, createdAt: 1 },
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      },
    });
    await waypointsService.replaceWaypoints([wp('morto', 'Apagado'), wp('vivo', 'Vivo')]);
    await waypointsService.removeWaypoint('morto');

    const resultado = await cloudSync.syncWaypoints();

    expect(resultado.map(w => w.id)).toEqual(['vivo']);
    // A linha morreu na nuvem e a lápide foi esquecida.
    expect(store.waypoints.map(r => r.id)).toEqual(['vivo']);
  });

  it('mantém a lápide quando o delete da nuvem falha (rede em baixo)', async () => {
    const { cloudSync, waypointsService } = loadModules({
      rows: {
        waypoints: [
          {
            user_id: 'user-1',
            id: 'morto',
            data: { name: 'Apagado', latitude: 0, longitude: 0, altitude: null, createdAt: 1 },
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      },
      deleteError: 'network',
    });
    await waypointsService.replaceWaypoints([wp('morto', 'Apagado')]);
    await waypointsService.removeWaypoint('morto');

    const resultado = await cloudSync.syncWaypoints();

    // O pull escondeu o morto, mas a lápide fica para a próxima tentativa.
    expect(resultado).toEqual([]);
    expect(store.waypoints).toHaveLength(1);
  });

  it('sem sessão devolve a lista local e marca offline, sem partir nada', async () => {
    const { cloudSync, waypointsService } = loadModules({ authFail: true });
    await waypointsService.replaceWaypoints([wp('a', 'Casa')]);

    const resultado = await cloudSync.syncWaypoints();

    expect(resultado.map(w => w.id)).toEqual(['a']);
    expect(await waypointsService.loadWaypoints()).toHaveLength(1);
    expect(cloudSync.cloudSyncStatus()?.state).toBe('offline');
  });

  it('um upsert recusado marca fail mas mantém o merge local', async () => {
    const { cloudSync, waypointsService } = loadModules({ upsertError: 'boom' });
    await waypointsService.replaceWaypoints([wp('a', 'Casa')]);

    const resultado = await cloudSync.syncWaypoints();

    expect(resultado.map(w => w.id)).toEqual(['a']);
    expect(await waypointsService.loadWaypoints()).toHaveLength(1);
    expect(cloudSync.cloudSyncStatus()?.state).toBe('fail');
  });

  it('não ressobrepõe o mesmo payload de novo (push só do que mudou)', async () => {
    const row: Row = {
      user_id: 'user-1',
      id: 'a',
      data: {
        name: 'a',
        latitude: -15.8,
        longitude: -47.9,
        altitude: null,
        createdAt: 1,
      },
      updated_at: '2026-01-01T00:00:00Z',
    };
    const { cloudSync, waypointsService } = loadModules({
      rows: { waypoints: [row] },
    });
    await waypointsService.replaceWaypoints([wp('a', 'a')]);

    const antes = store.waypoints[0].updated_at;
    await cloudSync.syncWaypoints();

    // Sem mudanças o push não corre: o `updated_at` que o `pushRecords` grava
    // a cada upsert nunca chega a ser escrito por cima.
    expect(store.waypoints).toHaveLength(1);
    expect(store.waypoints[0].updated_at).toBe(antes);
  });
});
