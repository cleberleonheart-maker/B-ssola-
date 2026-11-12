import {
  AXES,
  calibrationQuality,
  dominantAxis,
  magnitude,
} from '../src/utils/sensorDiagnostics';

/**
 * O painel de diagnóstico dos sensores (ideia #64).
 *
 * A app assume a convenção de eixos do telemóvel — X para a direita, Y para o
 * topo, Z para fora do ecrã — mas cada aparelho pode ter outra, e a leitura
 * errada de um eixo passa por "bússola mal calibrada". O painel diz ao
 * utilizador como está a ler, para ele poder dizer se é o telemóvel ou a
 * app que estão errados.
 */

describe('a magnitude', () => {
  it('é o comprimento do vector', () => {
    expect(magnitude({ x: 3, y: 4, z: 0 })).toBe(5);
    expect(magnitude({ x: 0, y: 0, z: 0 })).toBe(0);
  });

  it('um acelerómetro quieto lê 1 g', () => {
    expect(magnitude({ x: 0, y: 0, z: 1 })).toBeCloseTo(1, 6);
  });
});

describe('o eixo dominante', () => {
  it('é o de maior valor absoluto', () => {
    expect(dominantAxis({ x: 1, y: 5, z: 2 })).toBe('y');
    expect(dominantAxis({ x: 9, y: 1, z: 2 })).toBe('x');
    expect(dominantAxis({ x: 1, y: 2, z: 8 })).toBe('z');
  });

  it('o sinal nao interessa: o eixo aponta para os dois lados', () => {
    expect(dominantAxis({ x: 0, y: -5, z: 1 })).toBe('y');
  });

  it('um vector todo zero nao tem eixo dominante', () => {
    expect(dominantAxis({ x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('uma leitura sem numero nao tem eixo dominante', () => {
    expect(dominantAxis({ x: NaN, y: 1, z: 2 })).toBeNull();
    expect(dominantAxis({ x: 1, y: Infinity, z: 2 })).toBeNull();
  });

  it('os eixos do painel sao sempre os tres', () => {
    expect(AXES).toEqual(['x', 'y', 'z']);
  });
});

describe('a qualidade da calibração', () => {
  it('sem calibração nao ha nada para medir', () => {
    expect(calibrationQuality(null)).toEqual({
      calibrated: false,
      hardIron: 0,
      softIron: 0,
      samples: 0,
    });
  });

  it('o hard iron é o desvio do centro do campo', () => {
    const q = calibrationQuality({
      offsets: { x: 3, y: 4, z: 0 },
      scales: { x: 1, y: 1, z: 1 },
      samples: 120,
    });

    expect(q.calibrated).toBe(true);
    expect(q.hardIron).toBe(5);
    expect(q.softIron).toBe(0);
    expect(q.samples).toBe(120);
  });

  it('o soft iron é a diferença entre o maior e o menor fator de escala', () => {
    const q = calibrationQuality({
      offsets: { x: 0, y: 0, z: 0 },
      scales: { x: 1.2, y: 0.9, z: 1.0 },
      samples: 80,
    });

    expect(q.softIron).toBeCloseTo(0.3, 6);
    expect(q.hardIron).toBe(0);
  });

  it('uma escala com nan nao estraga a leitura', () => {
    const q = calibrationQuality({
      offsets: { x: 0, y: 0, z: 0 },
      scales: { x: 1, y: NaN, z: 1 },
      samples: 10,
    });

    expect(Number.isFinite(q.softIron)).toBe(true);
    expect(q.softIron).toBe(0);
  });
});
