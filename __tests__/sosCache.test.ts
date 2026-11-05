import { NativeModules } from 'react-native';

/**
 * O cache nativo do modo de assalto (ideia #107).
 *
 * A tile do SOS dispara o aviso com o telemóvel bloqueado e a app morta: o
 * nativo precisa de saber para quem avisar, onde a pessoa estava e quanto
 * bateria havia. O JavaScript escreve isso no cache — e o que se prova aqui é
 * que o cache é mesmo escrito, e que a sua falta nunca estraga o resto.
 */

type SosNative = {
  cacheContact?: jest.Mock;
  cacheFix?: jest.Mock;
  cacheBattery?: jest.Mock;
  cachedState?: jest.Mock;
};

const loadSos = (native: SosNative) => {
  (NativeModules as Record<string, unknown>).SosSender = native;
  let mod!: typeof import('../src/services/sosSender');
  jest.isolateModules(() => {
    mod = require('../src/services/sosSender');
  });
  return mod;
};

const nativeMock = (): SosNative => ({
  cacheContact: jest.fn().mockResolvedValue(true),
  cacheFix: jest.fn().mockResolvedValue(true),
  cacheBattery: jest.fn().mockResolvedValue(true),
  cachedState: jest.fn().mockResolvedValue({}),
});

describe('o cache do modo de assalto', () => {
  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).SosSender;
  });

  it('guarda o contacto de emergência', async () => {
    const native = nativeMock();
    const sos = loadSos(native);

    await sos.cacheEmergencyContact('+351919999999');

    expect(native.cacheContact).toHaveBeenCalledWith('+351919999999');
  });

  it('guarda a última posição', async () => {
    const native = nativeMock();
    const sos = loadSos(native);

    await sos.cacheFix({
      latitude: 38.7223,
      longitude: -9.1393,
      accuracy: 12,
      altitude: 40,
      updatedAt: 1762360000000,
    });

    expect(native.cacheFix).toHaveBeenCalledWith(38.7223, -9.1393, 12, 40, 1762360000000);
  });

  it('sem precisão nem altitude, o nativo recebe NaN (que ele lê como "não há")', async () => {
    const native = nativeMock();
    const sos = loadSos(native);

    await sos.cacheFix({
      latitude: 38.7223,
      longitude: -9.1393,
      accuracy: null,
      altitude: null,
      updatedAt: 1762360000000,
    });

    const chamada = native.cacheFix.mock.calls[0];
    expect(Number.isNaN(chamada[2])).toBe(true);
    expect(Number.isNaN(chamada[3])).toBe(true);
  });

  it('guarda a bateria', async () => {
    const native = nativeMock();
    const sos = loadSos(native);

    await sos.cacheBattery(63);

    expect(native.cacheBattery).toHaveBeenCalledWith(63);
  });

  it('uma posição sem coordenadas não vai para o cache', async () => {
    const native = nativeMock();
    const sos = loadSos(native);

    await sos.cacheFix({
      latitude: NaN,
      longitude: -9.1393,
      accuracy: null,
      altitude: null,
      updatedAt: 1762360000000,
    });

    expect(native.cacheFix).not.toHaveBeenCalled();
  });

  it('sem módulo nativo, nada rebenta', async () => {
    // O `SosSender` é capturado no import: o mock tem de estar lá antes.
    let mod!: typeof import('../src/services/sosSender');
    jest.isolateModules(() => {
      mod = require('../src/services/sosSender');
    });

    await expect(mod.cacheEmergencyContact('+351919999999')).resolves.toBeUndefined();
    await expect(mod.cacheBattery(50)).resolves.toBeUndefined();
    await expect(mod.getCachedSosState()).resolves.toBeNull();
  });

  it('se o nativo falhar, a app continua a funcionar', async () => {
    const native = nativeMock();
    native.cacheContact.mockRejectedValue(new Error('morto'));
    const sos = loadSos(native);

    await expect(sos.cacheEmergencyContact('+351919999999')).resolves.toBeUndefined();
  });

  it('lê o estado que o nativo tem', async () => {
    const native = nativeMock();
    native.cachedState.mockResolvedValue({
      contact: '+351919999999',
      battery: 63,
      pending: false,
      lat: 38.7223,
      lon: -9.1393,
      fixAt: 1762360000000,
    });
    const sos = loadSos(native);

    const state = await sos.getCachedSosState();

    expect(state?.contact).toBe('+351919999999');
    expect(state?.battery).toBe(63);
    expect(state?.lat).toBe(38.7223);
  });
});
