import {
  fastPressureDrop,
  recordPressure,
  clearPressureHistory,
  subscribePressureHistory,
  type BaroEntry,
} from '../src/services/pressureHistoryService';

const H = 3600000;
const MIN = 60000;

/**
 * A regra de campo da ideia #104 é pura de propósito: a queda de pressão que
 * interessa acontece dentro de uma tenda à noite, e ninguém vai estar a olhar
 * para um gráfico quando ela acontece — mas o teste não precisa de tenda nem de
 * barómetro para confirmar a conta.
 */
describe('fastPressureDrop — a regra de campo', () => {
  const base = 1_700_000_000_000;

  it('não dispara com menos de duas amostras', () => {
    expect(fastPressureDrop([], base)).toBeNull();
    expect(fastPressureDrop([{ ts: base, p: 1013 }], base)).toBeNull();
  });

  it('dispara numa queda de 4 hPa em 3 h', () => {
    const series: BaroEntry[] = [
      { ts: base - 3 * H, p: 1013 },
      { ts: base - 2 * H, p: 1011 },
      { ts: base - 1 * H, p: 1010 },
      { ts: base, p: 1009 },
    ];
    const drop = fastPressureDrop(series, base);
    expect(drop).not.toBeNull();
    expect(drop!.dropHpa).toBeCloseTo(-4, 5);
    expect(drop!.windowH).toBeCloseTo(3, 5);
  });

  it('não dispara numa queda de apenas 3 hPa em 3 h', () => {
    const series: BaroEntry[] = [
      { ts: base - 3 * H, p: 1013 },
      { ts: base, p: 1010 },
    ];
    expect(fastPressureDrop(series, base)).toBeNull();
  });

  it('dispara numa queda abrupta de 2 hPa em 1 h, que a média de 3 h diluía', () => {
    const series: BaroEntry[] = [
      { ts: base - 3 * H, p: 1009 },
      { ts: base - 2 * H, p: 1012 }, // subiu antes
      { ts: base - 1 * H, p: 1012 },
      { ts: base - 30 * MIN, p: 1010 },
    ];
    // Na janela de 3 h a variação é +1 hPa (não dispara); na de 1 h é -2 hPa.
    const drop = fastPressureDrop(series, base);
    expect(drop).not.toBeNull();
    expect(drop!.dropHpa).toBeCloseTo(-2, 5);
    expect(drop!.windowH).toBeCloseTo(0.5, 5);
    expect(drop!.rate).toBeCloseTo(-4, 5);
  });

  it('não dispara quando a pressão sobe', () => {
    const series: BaroEntry[] = [
      { ts: base - 3 * H, p: 1000 },
      { ts: base, p: 1010 },
    ];
    expect(fastPressureDrop(series, base)).toBeNull();
  });

  it('ignora amostras mais antigas que a janela', () => {
    const series: BaroEntry[] = [
      { ts: base - 10 * H, p: 1050 }, // fora da janela
      { ts: base - 3 * H, p: 1013 },
      { ts: base, p: 1009 },
    ];
    const drop = fastPressureDrop(series, base);
    expect(drop).not.toBeNull();
    expect(drop!.dropHpa).toBeCloseTo(-4, 5);
  });

  it('ignora amostras com timestamp no futuro (relógio adiantado)', () => {
    const series: BaroEntry[] = [
      { ts: base - 3 * H, p: 1013 },
      { ts: base + H, p: 1000 }, // futuro
      { ts: base, p: 1009 },
    ];
    const drop = fastPressureDrop(series, base);
    expect(drop!.dropHpa).toBeCloseTo(-4, 5);
  });
});

describe('recordPressure — a série partilhada', () => {
  const t0 = 1_700_000_000_000;

  beforeEach(() => {
    clearPressureHistory();
  });

  it('acrescenta a primeira leitura imediatamente', () => {
    const series = recordPressure(1013, t0);
    expect(series).toHaveLength(1);
    expect(series[0]).toEqual({ ts: t0, p: 1013 });
  });

  it('não guarda duas amostras no mesmo intervalo de 10 s', () => {
    recordPressure(1013, t0);
    const series = recordPressure(1012, t0 + 5000);
    expect(series).toHaveLength(1);
  });

  it('guarda a leitura seguinte depois do intervalo', () => {
    recordPressure(1013, t0);
    const series = recordPressure(1012, t0 + 12000);
    expect(series).toHaveLength(2);
    expect(series[1]).toEqual({ ts: t0 + 12000, p: 1012 });
  });

  it('ignora leituras não finitas', () => {
    recordPressure(1013, t0);
    const series = recordPressure(NaN, t0 + 12000);
    expect(series).toHaveLength(1);
  });

  it('avisa os assinantes logo com o que existe e a cada mudança', () => {
    const vistos: number[] = [];
    const parar = subscribePressureHistory(s => vistos.push(s.length));
    recordPressure(1013, t0);
    recordPressure(1012, t0 + 12000);
    parar();
    recordPressure(1011, t0 + 24000);
    expect(vistos).toEqual([0, 1, 2]);
  });
});
