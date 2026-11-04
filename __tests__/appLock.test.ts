import AsyncStorage from '@react-native-async-storage/async-storage';
import { RELOCK_GRACE_MS, shouldRelock } from '../src/utils/appLock';
import {
  loadLockBiometric,
  saveLockBiometric,
} from '../src/services/preferencesService';

describe('shouldRelock — quando o app volta a pedir o PIN', () => {
  const base = { hasPin: true, backgroundedAt: 1_000, now: 1_000 };

  it('sem PIN não há nada para trancar', () => {
    expect(
      shouldRelock({ ...base, hasPin: false, now: 1_000 + RELOCK_GRACE_MS * 10 }),
    ).toBe(false);
  });

  it('sem ter estado em segundo plano não se tranca', () => {
    expect(shouldRelock({ ...base, backgroundedAt: null })).toBe(false);
  });

  it('dentro da janela de tolerância o app fica aberto', () => {
    expect(shouldRelock({ ...base, now: 1_000 + RELOCK_GRACE_MS - 1 })).toBe(false);
  });

  it('passada a janela, volta a trancar', () => {
    expect(shouldRelock({ ...base, now: 1_000 + RELOCK_GRACE_MS })).toBe(true);
  });

  it('a janela é medida a partir do momento em que o app foi para o fundo', () => {
    expect(
      shouldRelock({ hasPin: true, backgroundedAt: 50_000, now: 50_000 + 1_000 }),
    ).toBe(false);
  });

  it('relógio para trás conta como tempo passado: o bloqueio não depende do relógio', () => {
    expect(shouldRelock({ ...base, now: 0 })).toBe(true);
  });

  it('aceita uma janela à medida', () => {
    expect(
      shouldRelock({ ...base, now: 1_000 + 5_000, graceMs: 10_000 }),
    ).toBe(false);
    expect(
      shouldRelock({ ...base, now: 1_000 + 10_000, graceMs: 10_000 }),
    ).toBe(true);
  });
});

describe('preferência da biometria', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('entra ligada quando nunca foi tocada', async () => {
    expect(await loadLockBiometric()).toBe(true);
  });

  it('guarda e lê o estado', async () => {
    await saveLockBiometric(false);
    expect(await loadLockBiometric()).toBe(false);
    await saveLockBiometric(true);
    expect(await loadLockBiometric()).toBe(true);
  });

  it('storage quebrado não deixa o app sem biometria nem sem ecrã', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValue(new Error('disco cheio'));
    expect(await loadLockBiometric()).toBe(true);
    spy.mockRestore();
  });
});
