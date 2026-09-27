import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import {
  startLiveTracking,
  stopLiveTracking,
  hasBackgroundLocation,
} from '../src/services/liveTracking';

const mockNative = {
  start: jest.fn(),
  stop: jest.fn(),
  hasBackgroundLocation: jest.fn(),
};

const granted = (v: boolean) =>
  v ? PermissionsAndroid.RESULTS.GRANTED : PermissionsAndroid.RESULTS.DENIED;

describe('liveTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NativeModules as Record<string, unknown>).LiveTracking = mockNative;
    (Platform as { OS: string }).OS = 'android';
    mockNative.start.mockResolvedValue({ started: true, backgroundLocation: true });
    mockNative.stop.mockResolvedValue(true);
    mockNative.hasBackgroundLocation.mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(granted(true));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sobe o foreground service quando a permissao ja esta concedida', async () => {
    mockNative.hasBackgroundLocation.mockResolvedValue(true);
    const r = await startLiveTracking(1000);
    expect(mockNative.start).toHaveBeenCalledWith(1000);
    expect(r.foreground).toBe(true);
    expect(r.backgroundLocation).toBe(true);
    // Sem precisar de dialogo: ja estava concedido
    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  });

  it('pede a permissao de background antes de subir o servico', async () => {
    mockNative.hasBackgroundLocation.mockResolvedValue(false);
    await startLiveTracking(1000);
    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      expect.objectContaining({ buttonPositive: 'Permitir' }),
    );
    expect(mockNative.start).toHaveBeenCalledWith(1000);
  });

  // Sem isto o usuario acha que o rastreio funciona com a tela apagada.
  it('nao sobe o servico e reporta quando a permissao e negada', async () => {
    mockNative.hasBackgroundLocation.mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(granted(false));
    const r = await startLiveTracking(1000);
    expect(mockNative.start).not.toHaveBeenCalled();
    expect(r.foreground).toBe(false);
    expect(r.backgroundLocation).toBe(false);
  });

  // Nao guardamos a negativa: quem concesse nas Configuracoes depois precisa
  // que o proximo rastreio suba sem novo dialogo.
  it('reavalia a permissao a cada inicio de sessao', async () => {
    mockNative.hasBackgroundLocation.mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(granted(false));
    await startLiveTracking(1000);
    expect(mockNative.start).not.toHaveBeenCalled();

    // usuario concede nas Configuracoes
    mockNative.hasBackgroundLocation.mockResolvedValue(true);
    const r = await startLiveTracking(2000);
    expect(PermissionsAndroid.request).toHaveBeenCalledTimes(1);
    expect(mockNative.start).toHaveBeenCalledWith(2000);
    expect(r.foreground).toBe(true);
  });

  it('reporta falha do servico sem prometer foreground', async () => {
    mockNative.hasBackgroundLocation.mockResolvedValue(true);
    mockNative.start.mockResolvedValue({ started: false, backgroundLocation: true });
    const r = await startLiveTracking(1000);
    expect(r.foreground).toBe(false);
    expect(r.backgroundLocation).toBe(true);
  });

  it('nao quebra se o servico lancar', async () => {
    mockNative.hasBackgroundLocation.mockResolvedValue(true);
    mockNative.start.mockRejectedValue(new Error('boom'));
    const r = await startLiveTracking(1000);
    expect(r.foreground).toBe(false);
  });

  it('ignora falha do stop', async () => {
    mockNative.stop.mockRejectedValue(new Error('boom'));
    await expect(stopLiveTracking()).resolves.toBeUndefined();
  });

  it('nao faz nada fora do android', async () => {
    (Platform as { OS: string }).OS = 'ios';
    const r = await startLiveTracking(1000);
    expect(mockNative.start).not.toHaveBeenCalled();
    expect(r.foreground).toBe(false);
    await stopLiveTracking();
    expect(mockNative.stop).not.toHaveBeenCalled();
  });

  it('nao quebra se o modulo nativo nao existir', async () => {
    delete (NativeModules as Record<string, unknown>).LiveTracking;
    const r = await startLiveTracking(1000);
    expect(r).toEqual({ foreground: false, backgroundLocation: false });
    await expect(hasBackgroundLocation()).resolves.toBe(false);
  });
});
