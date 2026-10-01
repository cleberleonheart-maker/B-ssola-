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
  const deleteLiveShareRow = jest.fn(
    async (_token: string, _userId: string) => true,
  );
  const pushLivePosition = jest.fn(
    async (
      _token: string,
      _userId: string,
      _lat: number,
      _lng: number,
      _acc: number | null,
      _heading: number | null,
      _expiresAt: number,
    ) => true,
  );
  jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: AsyncStorage }));
  jest.doMock('../src/services/cloud', () => ({
    isCloudEnabled: jest.fn(() => true),
    ensureCloudUser: jest.fn(async () => 'user-1'),
    pushLivePosition,
    deleteLiveShareRow,
  }));
  jest.spyOn(Date, 'now').mockReturnValue(now);
  let service!: typeof import('../src/services/liveShareService');
  jest.isolateModules(() => {
    service = jest.requireActual('../src/services/liveShareService') as typeof import('../src/services/liveShareService');
  });
  return { service, store, deleteLiveShareRow, pushLivePosition };
};

const MS_PER_MIN = 60000;

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
    const s = await service.startLiveShare(30);
    expect(s).not.toBeNull();
    expect(store.has('bussola:live:active')).toBe(true);
    const resumed = await service.getActiveLiveSession();
    expect(resumed?.token).toBe(s?.token);
  });

  it('descarta sessão expirada', async () => {
    const { service, store } = loadService(1000);
    const s = await service.startLiveShare(5);
    jest.spyOn(Date, 'now').mockReturnValue(1000 + 6 * MS_PER_MIN);
    expect(await service.getActiveLiveSession()).toBeNull();
    expect(store.has('bussola:live:active')).toBe(false);
    expect(s?.expiresAt).toBe(1000 + 5 * MS_PER_MIN);
  });

  it('limpa a sessão ativa ao parar', async () => {
    const { service, store, deleteLiveShareRow } = loadService(1000);
    const s = await service.startLiveShare(30);
    await service.stopLiveShare(s!.token);
    expect(store.has('bussola:live:active')).toBe(false);
    expect(store.has('bussola:live:' + s!.token)).toBe(false);
    expect(await service.getActiveLiveSession()).toBeNull();
    expect(deleteLiveShareRow).toHaveBeenCalledWith(s!.token, 'user-1');
  });

  it('não apaga uma sessão ativa mais nova', async () => {
    const { service, store } = loadService(1000);
    await service.startLiveShare(30);
    const older = 'lnv-antiga';
    await service.stopLiveShare(older);
    expect(store.has('bussola:live:active')).toBe(true);
  });

  it('envia o rumo do fix para o push', async () => {
    const { service, pushLivePosition } = loadService(1000);
    const s = await service.startLiveShare(30);
    const sent = await service.pushLiveFix(s!, {
      latitude: -15.8,
      longitude: -47.9,
      accuracy: 5,
      altitude: 1100,
      speed: 1.4,
      provider: 'gps',
      updatedAt: 1000,
      heading: 90,
    });
    expect(sent).toBe(true);
    // token, userId, lat, lng, accuracy, heading, expiresAt
    expect(pushLivePosition).toHaveBeenCalledWith(
      s!.token,
      'user-1',
      -15.8,
      -47.9,
      5,
      90,
      s!.expiresAt,
    );
  });

  it('envia heading nulo quando o GPS não informa rumo', async () => {
    const { service, pushLivePosition } = loadService(1000);
    const s = await service.startLiveShare(30);
    await service.pushLiveFix(s!, {
      latitude: -15.8,
      longitude: -47.9,
      accuracy: null,
      altitude: null,
      speed: null,
      provider: null,
      updatedAt: null,
      heading: null,
    });
    expect(pushLivePosition.mock.calls[0][5]).toBeNull();
  });

  it('usa o rumo da bussola quando o GPS nao devolve bearing (ideia 54)', async () => {
    const { service, pushLivePosition } = loadService(1000);
    const s = await service.startLiveShare(30);
    await service.pushLiveFix(
      s!,
      {
        latitude: -15.8,
        longitude: -47.9,
        accuracy: null,
        altitude: null,
        speed: null,
        provider: null,
        updatedAt: null,
        heading: null,
      },
      187,
    );
    expect(pushLivePosition.mock.calls[0][5]).toBe(187);
  });

  it('prefere o bearing do GPS quando ele existe', async () => {
    const { service, pushLivePosition } = loadService(1000);
    const s = await service.startLiveShare(30);
    await service.pushLiveFix(
      s!,
      {
        latitude: -15.8,
        longitude: -47.9,
        accuracy: null,
        altitude: null,
        speed: null,
        provider: null,
        updatedAt: null,
        heading: 42,
      },
      187,
    );
    expect(pushLivePosition.mock.calls[0][5]).toBe(42);
  });

  it('normaliza o rumo da bussola antes de enviar', async () => {
    const { service, pushLivePosition } = loadService(1000);
    const s = await service.startLiveShare(30);
    await service.pushLiveFix(
      s!,
      {
        latitude: -15.8,
        longitude: -47.9,
        accuracy: null,
        altitude: null,
        speed: null,
        provider: null,
        updatedAt: null,
        heading: null,
      },
      370,
    );
    expect(pushLivePosition.mock.calls[0][5]).toBeCloseTo(10, 5);
  });

  it('descarta rumo magnetico invalido em vez de mandar NaN', async () => {
    const { service, pushLivePosition } = loadService(1000);
    const s = await service.startLiveShare(30);
    await service.pushLiveFix(
      s!,
      {
        latitude: -15.8,
        longitude: -47.9,
        accuracy: null,
        altitude: null,
        speed: null,
        provider: null,
        updatedAt: null,
        heading: null,
      },
      NaN,
    );
    expect(pushLivePosition.mock.calls[0][5]).toBeNull();
  });

  it('usa o mesmo userId no push e na remoção da linha', async () => {
    const { service, pushLivePosition, deleteLiveShareRow } = loadService(1000);
    const s = await service.startLiveShare(30);
    await service.pushLiveFix(s!, {
      latitude: -15.8,
      longitude: -47.9,
      accuracy: null,
      altitude: null,
      speed: null,
      provider: null,
      updatedAt: null,
      heading: null,
    });
    await service.stopLiveShare(s!.token);
    const pushedUser = pushLivePosition.mock.calls[0][1];
    const deletedUser = deleteLiveShareRow.mock.calls[0][1];
    expect(pushedUser).toBe(deletedUser);
  });
});
