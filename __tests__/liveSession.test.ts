const loadService = (now: number) => {
  const store = new Map<string, string>();
  const AsyncStorage = {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  const deleteLiveShareRow = jest.fn(async () => true);
  jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: AsyncStorage }));
  jest.doMock('../src/services/cloud', () => ({
    isCloudEnabled: jest.fn(() => true),
    ensureCloudUser: jest.fn(async () => 'user-1'),
    pushLivePosition: jest.fn(async () => true),
    deleteLiveShareRow,
  }));
  jest.spyOn(Date, 'now').mockReturnValue(now);
  let service!: typeof import('../src/services/liveShareService');
  jest.isolateModules(() => {
    service = jest.requireActual('../src/services/liveShareService') as typeof import('../src/services/liveShareService');
  });
  return { service, store, deleteLiveShareRow };
};

const MS = 60000;

describe('sessão de live', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('../src/services/cloud');
    jest.resetModules();
  });

  it('guarda a sessão ativa e permite retomar', async () => {
    const { service, store } = loadService(1000);
    const s = await service.startLiveShare('', 30);
    expect(s).not.toBeNull();
    expect(store.has('bussola:live:active')).toBe(true);
    const resumed = await service.getActiveLiveSession();
    expect(resumed?.token).toBe(s?.token);
  });

  it('descarta sessão expirada', async () => {
    const { service, store } = loadService(1000);
    const s = await service.startLiveShare('', 5);
    jest.spyOn(Date, 'now').mockReturnValue(1000 + 6 * MS);
    expect(await service.getActiveLiveSession()).toBeNull();
    expect(store.has('bussola:live:active')).toBe(false);
    expect(s?.expiresAt).toBe(1000 + 5 * MS);
  });

  it('limpa a sessão ativa ao parar', async () => {
    const { service, store, deleteLiveShareRow } = loadService(1000);
    const s = await service.startLiveShare('', 30);
    await service.stopLiveShare(s!.token);
    expect(store.has('bussola:live:active')).toBe(false);
    expect(store.has('bussola:live:' + s!.token)).toBe(false);
    expect(await service.getActiveLiveSession()).toBeNull();
    expect(deleteLiveShareRow).toHaveBeenCalledWith(s!.token, 'user-1');
  });

  it('não apaga uma sessão ativa mais nova', async () => {
    const { service, store } = loadService(1000);
    await service.startLiveShare('', 30);
    const older = 'lnv-antiga';
    await service.stopLiveShare(older);
    expect(store.has('bussola:live:active')).toBe(true);
  });
});
