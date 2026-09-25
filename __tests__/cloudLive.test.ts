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
});
