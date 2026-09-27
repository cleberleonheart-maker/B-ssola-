import {
  verifyStatus,
  solarDelta,
  solarOk,
  SOLAR_TOLERANCE,
  VERIFY_INTERVAL_DAYS,
} from '../src/services/calibrationService';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const at = (daysAgo: number) => NOW - daysAgo * DAY;

describe('verifyStatus', () => {
  it('trata "nunca conferido" como never', () => {
    expect(verifyStatus(null, NOW)).toEqual({ state: 'never', days: 0 });
  });

  it('trata dado corrompido como never em vez de propagar NaN', () => {
    expect(verifyStatus(NaN, NOW).state).toBe('never');
    expect(verifyStatus(Infinity, NOW).state).toBe('never');
    expect(verifyStatus(-Infinity, NOW).state).toBe('never');
  });

  it('considera fresco logo após conferir', () => {
    expect(verifyStatus(at(0), NOW).state).toBe('fresh');
  });

  it('considera fresco no meio do intervalo', () => {
    expect(verifyStatus(at(15), NOW).state).toBe('fresh');
  });

  it('fica stale exatamente no limite, não depois', () => {
    expect(verifyStatus(at(VERIFY_INTERVAL_DAYS - 1), NOW).state).toBe('fresh');
    expect(verifyStatus(at(VERIFY_INTERVAL_DAYS), NOW).state).toBe('stale');
  });

  it('conta os dias desde a última conferência', () => {
    expect(verifyStatus(at(45), NOW)).toEqual({ state: 'stale', days: 45 });
  });

  // floor e round so divergem a partir de meia hora: 1.6 dias tem que
  // contar como 1 dia, nao 2.
  it('trunca em dias inteiros, sem arredondar', () => {
    expect(verifyStatus(NOW - 1.6 * DAY, NOW).days).toBe(1);
    expect(verifyStatus(NOW - 1.9 * DAY, NOW).days).toBe(1);
    expect(verifyStatus(NOW - 2.0 * DAY, NOW).days).toBe(2);
    expect(verifyStatus(NOW - 0.4 * DAY, NOW).days).toBe(0);
  });

  // Relógio andou para trás: trocar de data ou de fuso não deve virar nagging.
  it('nao reclama quando o carimbo está no futuro', () => {
    expect(verifyStatus(NOW + 5 * DAY, NOW)).toEqual({
      state: 'fresh',
      days: 0,
    });
  });

  it('aceita intervalo customizado', () => {
    expect(verifyStatus(at(8), NOW, 7).state).toBe('stale');
    expect(verifyStatus(at(6), NOW, 7).state).toBe('fresh');
  });
});

describe('solarDelta', () => {
  it('mede o desvio no intervalo -180..180', () => {
    expect(solarDelta({ avg: 10, expected: 350 })).toBe(20);
    expect(solarDelta({ avg: 350, expected: 10 })).toBe(-20);
  });

  it('trata exatamente 180 sem virar o sinal', () => {
    expect(solarDelta({ avg: 0, expected: 180 })).toBe(-180);
    expect(solarDelta({ avg: 0, expected: -180 })).toBe(180);
  });

  it('da zero quando a leitura bate com o esperado', () => {
    expect(solarDelta({ avg: 123.4, expected: 123.4 })).toBe(0);
  });
});

describe('solarOk', () => {
  it('aceita dentro da tolerancia, incluindo a borda', () => {
    expect(solarOk({ avg: 10, expected: 10 + SOLAR_TOLERANCE })).toBe(true);
    expect(solarOk({ avg: 10, expected: 10 - SOLAR_TOLERANCE })).toBe(true);
  });

  it('recusa um grau alem da tolerancia', () => {
    expect(solarOk({ avg: 10, expected: 10 + SOLAR_TOLERANCE + 1 })).toBe(false);
    expect(solarOk({ avg: 10, expected: 10 - SOLAR_TOLERANCE - 1 })).toBe(false);
  });

  it('trata desvio grande que atravessa o zero', () => {
    // 300 contra 5 dá 65° de desvio, mesmo passando por 0 no caminho
    expect(solarDelta({ avg: 300, expected: 5 })).toBe(-65);
    expect(solarOk({ avg: 300, expected: 5 })).toBe(false);
    // 2° atravessando o zero continua dentro da tolerancia
    expect(solarOk({ avg: 359, expected: 1 })).toBe(true);
    expect(solarOk({ avg: 0, expected: 2 })).toBe(true);
  });
});
