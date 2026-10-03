import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { cloudEndpoint, getCloudAccessToken } from '../src/services/cloud';
import {
  startLiveTracking,
  stopLiveTracking,
  hasBackgroundLocation,
  type LiveTrackingRequest,
} from '../src/services/liveTracking';

jest.mock('../src/services/cloud', () => ({
  cloudEndpoint: jest.fn(),
  getCloudAccessToken: jest.fn(),
}));

const mockNative = {
  start: jest.fn(),
  stop: jest.fn(),
  hasBackgroundLocation: jest.fn(),
};

const request: LiveTrackingRequest = {
  token: 'lnv-abc',
  userId: 'user-1',
  expiresAt: 1_800_000,
};

const endpoint = { url: 'https://wotzcykrvidbjkonaawx.supabase.co', anonKey: 'anon-key' };

const granted = (v: boolean) =>
  v ? PermissionsAndroid.RESULTS.GRANTED : PermissionsAndroid.RESULTS.DENIED;

describe('liveTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NativeModules as Record<string, unknown>).LiveTracking = mockNative;
    (Platform as { OS: string }).OS = 'android';
    mockNative.start.mockResolvedValue({ started: true, backgroundLocation: true });
    mockNative.stop.mockResolvedValue(true);
    mockNative.hasBackgroundLocation.mockResolvedValue(true);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(granted(true));
    (cloudEndpoint as jest.Mock).mockReturnValue(endpoint);
    (getCloudAccessToken as jest.Mock).mockResolvedValue('jwt-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // O servico faz o upsert em Kotlin: sem token, userId, JWT, url ou anon key
  // nao ha linha para atualizar, e `readLiveSession` rejeitaria de volta.
  it('manda a sessao inteira para o servico assumir o push', async () => {
    const r = await startLiveTracking(request);
    expect(mockNative.start).toHaveBeenCalledWith({
      token: 'lnv-abc',
      userId: 'user-1',
      accessToken: 'jwt-1',
      url: endpoint.url,
      anonKey: endpoint.anonKey,
      expiresAt: 1_800_000,
    });
    expect(r.owner).toBe('service');
    expect(r.foreground).toBe(true);
  });

  it('deixa o JS como dono quando o servico nao sobe', async () => {
    mockNative.start.mockResolvedValue({ started: false, backgroundLocation: true });
    const r = await startLiveTracking(request);
    expect(r.foreground).toBe(false);
    expect(r.owner).toBe('js');
    expect(r.backgroundLocation).toBe(true);
  });

  it('deixa o JS como dono quando o servico lancar', async () => {
    mockNative.start.mockRejectedValue(new Error('boom'));
    const r = await startLiveTracking(request);
    expect(r.foreground).toBe(false);
    expect(r.owner).toBe('js');
  });

  // Push nativo sem JWT volta 401 a cada 10 s sem ninguem ver. E ai que o JS
  // assume: ele pelo menos aventa que so funciona com o app aberto.
  it('deixa o JS como dono quando nao ha JWT na sessao', async () => {
    (getCloudAccessToken as jest.Mock).mockResolvedValue(null);
    const r = await startLiveTracking(request);
    expect(mockNative.start).not.toHaveBeenCalled();
    expect(r.owner).toBe('js');
  });

  it('deixa o JS como dono quando a nuvem nao esta configurada', async () => {
    (cloudEndpoint as jest.Mock).mockReturnValue(null);
    const r = await startLiveTracking(request);
    expect(mockNative.start).not.toHaveBeenCalled();
    expect(r.owner).toBe('js');
  });

  it('sobe o foreground service quando a permissao ja esta concedida', async () => {
    const r = await startLiveTracking(request);
    expect(mockNative.start).toHaveBeenCalledTimes(1);
    expect(r.backgroundLocation).toBe(true);
    // Sem precisar de dialogo: ja estava concedido
    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  });

  it('pede a permissao de background antes de subir o servico', async () => {
    mockNative.hasBackgroundLocation.mockResolvedValue(false);
    await startLiveTracking(request);
    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      expect.objectContaining({ buttonPositive: 'Permitir' }),
    );
    expect(mockNative.start).toHaveBeenCalledTimes(1);
  });

  // Sem isto o usuario acha que o rastreio funciona com a tela apagada.
  it('nao sobe o servico e reporta quando a permissao e negada', async () => {
    mockNative.hasBackgroundLocation.mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(granted(false));
    const r = await startLiveTracking(request);
    expect(mockNative.start).not.toHaveBeenCalled();
    expect(r.foreground).toBe(false);
    expect(r.backgroundLocation).toBe(false);
    expect(r.owner).toBe('js');
  });

  // Nao guardamos a negativa: quem concesse nas Configuracoes depois precisa
  // que o proximo rastreio suba sem novo dialogo.
  it('reavalia a permissao a cada inicio de sessao', async () => {
    mockNative.hasBackgroundLocation.mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(granted(false));
    await startLiveTracking(request);
    expect(mockNative.start).not.toHaveBeenCalled();

    // usuario concede nas Configuracoes
    mockNative.hasBackgroundLocation.mockResolvedValue(true);
    const r = await startLiveTracking({ ...request, expiresAt: 2_000_000 });
    expect(PermissionsAndroid.request).toHaveBeenCalledTimes(1);
    expect(mockNative.start).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: 2_000_000 }),
    );
    expect(r.foreground).toBe(true);
  });

  it('nao quebra se o servico lancar ao pedir o estado da permissao', async () => {
    mockNative.hasBackgroundLocation.mockRejectedValue(new Error('boom'));
    const r = await startLiveTracking(request);
    expect(PermissionsAndroid.request).toHaveBeenCalled();
    expect(r.owner).toBe('service');
  });

  it('ignora falha do stop', async () => {
    mockNative.stop.mockRejectedValue(new Error('boom'));
    await expect(stopLiveTracking()).resolves.toBeUndefined();
  });

  it('nao faz nada fora do android', async () => {
    (Platform as { OS: string }).OS = 'ios';
    const r = await startLiveTracking(request);
    expect(mockNative.start).not.toHaveBeenCalled();
    expect(r.foreground).toBe(false);
    expect(r.owner).toBe('js');
    await stopLiveTracking();
    expect(mockNative.stop).not.toHaveBeenCalled();
  });

  it('nao quebra se o modulo nativo nao existir', async () => {
    delete (NativeModules as Record<string, unknown>).LiveTracking;
    const r = await startLiveTracking(request);
    expect(r).toEqual({
      foreground: false,
      backgroundLocation: false,
      owner: 'js',
    });
    await expect(hasBackgroundLocation()).resolves.toBe(false);
  });
});