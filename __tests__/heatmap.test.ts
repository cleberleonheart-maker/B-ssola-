import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildHeatGrid,
  DEFAULT_CELL_METERS,
  filterSince,
  heatColor,
  startOfDay,
} from '../src/utils/heatmap';
import {
  appendWhereabouts,
  clearWhereabouts,
  createWhereaboutsId,
  loadWhereabouts,
  saveWhereabouts,
  type WhereaboutsPoint,
} from '../src/services/whereaboutsService';

const point = (over: Partial<WhereaboutsPoint> = {}): WhereaboutsPoint => ({
  id: createWhereaboutsId(),
  lat: 38.7223,
  lon: -9.1393,
  // Agora: o registo só guarda o que tem menos de uma semana.
  ts: Date.now(),
  ...over,
});

describe('grelha do mapa de calor', () => {
  it('agrupa pontos vizinhos na mesma célula', () => {
    // 10 m de diferença: muito menos do que o lado da célula (40 m).
    const cells = buildHeatGrid([
      { lat: 38.7223, lon: -9.1393 },
      { lat: 38.72231, lon: -9.13931 },
    ]);
    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(2);
  });

  it('separa pontos longe', () => {
    const cells = buildHeatGrid([
      { lat: 38.7223, lon: -9.1393 },
      { lat: 38.8, lon: -9.2 },
    ]);
    expect(cells).toHaveLength(2);
  });

  it('a célula fica centrada nos pontos que a compõem', () => {
    const cells = buildHeatGrid([
      { lat: 38.7223, lon: -9.1393 },
      { lat: 38.7224, lon: -9.1394 },
    ]);
    expect(cells[0].lat).toBeCloseTo(38.72235, 6);
    expect(cells[0].lon).toBeCloseTo(-9.13935, 6);
  });

  it('o peso é a raiz da densidade relativa', () => {
    const cells = buildHeatGrid([
      { lat: 38.7223, lon: -9.1393 },
      { lat: 38.72231, lon: -9.13931 },
      { lat: 38.72232, lon: -9.13932 },
      { lat: 38.8, lon: -9.2 },
    ]);
    const cheia = cells.find(c => c.count === 3);
    const cheiaEsperada = Math.sqrt(3 / 3);
    expect(cheia?.weight).toBeCloseTo(cheiaEsperada, 5);
    const fraca = cells.find(c => c.count === 1);
    expect(fraca?.weight).toBeCloseTo(Math.sqrt(1 / 3), 5);
  });

  it('atira fora pontos sem coordenadas válidas', () => {
    const cells = buildHeatGrid([
      { lat: Number.NaN, lon: -9.1393 },
      { lat: 38.7223, lon: Number.POSITIVE_INFINITY },
      { lat: 38.7223, lon: -9.1393 },
    ]);
    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(1);
  });

  it('uma lista vazia não dá grelha', () => {
    expect(buildHeatGrid([])).toEqual([]);
  });

  it('a célula tem 40 m por omissão', () => {
    expect(DEFAULT_CELL_METERS).toBe(40);
  });
});

describe('cor do mapa de calor', () => {
  it('vai de azul a vermelho, com amarelo ao meio', () => {
    expect(heatColor(0)).toBe('#2f6fd0');
    expect(heatColor(0.5)).toBe('#f5c542');
    expect(heatColor(1)).toBe('#e04b4b');
  });

  it('não se escapa da escala', () => {
    expect(heatColor(-2)).toBe(heatColor(0));
    expect(heatColor(5)).toBe(heatColor(1));
  });
});

describe('filtros de tempo', () => {
  it('a meia-noite local é o começo do dia', () => {
    const ts = new Date(2026, 0, 15, 13, 45, 0).getTime();
    expect(startOfDay(ts)).toBe(new Date(2026, 0, 15, 0, 0, 0).getTime());
  });

  it('filtra o que é mais recente que o limite', () => {
    const pontos = [{ ts: 100 }, { ts: 200 }, { ts: 300 }];
    expect(filterSince(pontos, 200)).toEqual([{ ts: 200 }, { ts: 300 }]);
  });
});

describe('registo de "onde estive"', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('começa vazio', async () => {
    expect(await loadWhereabouts()).toEqual([]);
  });

  it('guarda e volta a ler', async () => {
    await saveWhereabouts([point({ lat: 1 }), point({ lat: 2 })]);
    const list = await loadWhereabouts();
    expect(list).toHaveLength(2);
    expect(list[0].lat).toBe(1);
  });

  it('acrescenta mantendo a ordem', async () => {
    await appendWhereabouts(point({ lat: 1 }));
    await appendWhereabouts(point({ lat: 2 }));
    expect((await loadWhereabouts()).map(p => p.lat)).toEqual([1, 2]);
  });

  it('deita fora o que tem mais de uma semana', async () => {
    const velho = point({ ts: Date.now() - 8 * 24 * 60 * 60 * 1000 });
    const novo = point({ ts: Date.now() - 60 * 1000 });
    await saveWhereabouts([velho, novo]);
    const list = await loadWhereabouts();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(novo.id);
  });

  it('atira fora entradas que não são pontos', async () => {
    await AsyncStorage.setItem(
      '@bussola/whereabouts',
      JSON.stringify([{ lat: 1 }, point({ lat: 2 })]),
    );
    const list = await loadWhereabouts();
    expect(list).toHaveLength(1);
    expect(list[0].lat).toBe(2);
  });

  it('limpa tudo', async () => {
    await appendWhereabouts(point());
    await clearWhereabouts();
    expect(await loadWhereabouts()).toEqual([]);
  });
});
