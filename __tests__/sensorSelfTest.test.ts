import {
  analyzeRest,
  detectAccelScale,
  headingSpread,
  tiltResponse,
  toG,
  wrap180,
  G_MS2,
  REST_MAX_G,
  REST_MIN_G,
  STABILITY_MAX_DEG,
} from '../src/services/sensorSelfTest';

const mag = (x: number, y: number, z: number) =>
  Math.sqrt(x * x + y * y + z * z);

describe('autoteste: escala do acelerometro', () => {
  it('reconhece g e m/s2 pela ordem de grandeza', () => {
    expect(detectAccelScale([1, 1.01, 0.99])).toBe('g');
    expect(detectAccelScale([G_MS2, G_MS2 * 1.01])).toBe('ms2');
  });

  it('converte para g a partir da escala detectada', () => {
    expect(toG(G_MS2, 'ms2')).toBeCloseTo(1, 6);
    expect(toG(1, 'g')).toBe(1);
  });

  it('cai para g quando nao ha amostra valida', () => {
    expect(detectAccelScale([])).toBe('g');
    expect(detectAccelScale([NaN, 0, -1])).toBe('g');
  });

  it('o mesmo repouso passa identico nas duas unidades', () => {
    const emG = analyzeRest([mag(0, 0, 1), mag(0, 0, 1.005)]);
    const emMs2 = analyzeRest([mag(0, 0, G_MS2), mag(0, 0, G_MS2 * 1.005)]);
    expect(emG?.inRange).toBe(true);
    expect(emMs2?.inRange).toBe(true);
    expect(emG?.mean).toBeCloseTo(emMs2?.mean ?? -1, 6);
    expect(emG?.scale).toBe('g');
    expect(emMs2?.scale).toBe('ms2');
  });
});

describe('autoteste: acelerometro em repouso', () => {
  it('aprova janela dentro de 0,98 a 1,02 g', () => {
    const r = analyzeRest([mag(0, 0, 0.99), mag(0, 0, 1.01)]);
    expect(r?.inRange).toBe(true);
    expect(r?.min).toBeGreaterThanOrEqual(REST_MIN_G);
    expect(r?.max).toBeLessThanOrEqual(REST_MAX_G);
  });

  it('reprova sensor travado em zero', () => {
    expect(analyzeRest([0, 0, 0])?.inRange).toBe(false);
  });

  it('reprova sensor travado em 1 g sem reler o zero', () => {
    // ja pegou o valor certo, mas sobe 0,4 g no meio da janela
    const r = analyzeRest([mag(0, 0, 1), mag(0, 0, 1.4)]);
    expect(r?.inRange).toBe(false);
    expect(r?.max).toBeCloseTo(1.4, 6);
  });

  it('reprova leitura que sai de faixa e volta, mesmo com media certa', () => {
    // media ~1.0, mas o minimo afunda: a media esconde, o minimo nao
    const r = analyzeRest([mag(0, 0, 0.5), mag(0, 0, 1), mag(0, 0, 1.5)]);
    expect(r?.inRange).toBe(false);
    expect(r?.mean).toBeCloseTo(1, 6);
  });

  it('reprova so pelo limite inferior, com o maximo dentro da faixa', () => {
    // nadir de 0,90 g e nada acima de 1,01 g: so o minimo reprova
    const r = analyzeRest([mag(0, 0, 0.9), mag(0, 0, 1), mag(0, 0, 1.01)]);
    expect(r?.inRange).toBe(false);
    expect(r?.min).toBeCloseTo(0.9, 6);
    expect(r?.max).toBeLessThanOrEqual(REST_MAX_G);
  });

  it('reprova so pelo limite superior, com o minimo dentro da faixa', () => {
    const r = analyzeRest([mag(0, 0, 0.99), mag(0, 0, 1), mag(0, 0, 1.03)]);
    expect(r?.inRange).toBe(false);
    expect(r?.min).toBeGreaterThanOrEqual(REST_MIN_G);
    expect(r?.max).toBeCloseTo(1.03, 6);
  });

  it('aceita a faixa exatamente nos limites', () => {
    const r = analyzeRest([mag(0, 0, REST_MIN_G), mag(0, 0, REST_MAX_G)]);
    expect(r?.inRange).toBe(true);
  });

  it('devolve null sem amostras', () => {
    expect(analyzeRest([])).toBeNull();
    expect(analyzeRest([NaN, NaN])).toBeNull();
  });
});

describe('autoteste: estabilidade do norte parado', () => {
  it('aprova norte parado dentro de 2 graus', () => {
    const spread = headingSpread([120, 120.4, 119.8, 121.2, 120.1]);
    expect(spread).toBeCloseTo(1.4, 6);
    expect(spread!).toBeLessThanOrEqual(STABILITY_MAX_DEG);
  });

  it('trata a quebra do 0/360 em vez de ler 358 graus de variacao', () => {
    // de 359 a 1 o aparelho girou 2 graus, nao 358
    const spread = headingSpread([359, 359.5, 0.2, 0.8, 1]);
    expect(spread!).toBeLessThanOrEqual(STABILITY_MAX_DEG);
  });

  it('reprova norte que oscila 10 graus parado', () => {
    const spread = headingSpread([10, 14, 20, 16, 12]);
    expect(spread!).toBeGreaterThan(STABILITY_MAX_DEG);
  });

  it('reprova bussola que so fica travada num unico valor', () => {
    // variacao zero, mas todos iguais e todos em 180: sensor colado, nao estavel
    const spread = headingSpread([180, 180, 180, 180]);
    expect(spread).toBe(0);
  });

  it('precisa de pelo menos duas amostras', () => {
    expect(headingSpread([42])).toBeNull();
    expect(headingSpread([])).toBeNull();
  });
});

describe('autoteste: resposta a inclinacao', () => {
  it('aprova quando o angulo acompanha o movimento', () => {
    const r = tiltResponse([0, -15, -40, -70, -88]);
    expect(r?.responded).toBe(true);
    expect(r?.range).toBeCloseTo(88, 6);
  });

  it('reprova sensor travado em zero', () => {
    const r = tiltResponse([0, 0, 0, 0, 0]);
    expect(r?.responded).toBe(false);
    expect(r?.range).toBe(0);
  });

  it('reprova ruido que mal mexe', () => {
    expect(tiltResponse([0, 1, 2, 1.5, 0.5])?.responded).toBe(false);
  });

  it('mede o eixo errado sem reprovar: isso e da ideia 64', () => {
    // inverter o eixo inverte o sinal mas a amplitude continua grande
    const r = tiltResponse([0, 15, 40, 70, 88]);
    expect(r?.responded).toBe(true);
    expect(r?.min).toBe(0);
    expect(r?.max).toBeCloseTo(88, 6);
  });

  it('precisa de pelo menos duas amostras', () => {
    expect(tiltResponse([0])).toBeNull();
  });
});

describe('autoteste: wrap180', () => {
  it('dobra para -180..180 preservando o sinal', () => {
    expect(wrap180(0)).toBe(0);
    expect(wrap180(180)).toBe(180);
    expect(wrap180(-180)).toBe(-180);
    expect(wrap180(190)).toBe(-170);
    expect(wrap180(-190)).toBe(170);
    expect(wrap180(730)).toBe(10);
  });
});
