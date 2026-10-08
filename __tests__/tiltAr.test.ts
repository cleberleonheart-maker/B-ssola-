import { pitchRollDeg, viewElevationDeg, verticalFovDeg, markerTopPct, type Vector3 } from '../src/utils/compass';
import { elevationAngle } from '../src/utils/geo';
import { dominantAxis, type AxisValues } from '../src/utils/emf';

/**
 * Convenção do sensor (a mesma do fixture `restMS` de bugfixes.test.ts):
 * x → direita, y → topo da tela, z → para fora da tela; em repouso com a tela
 * para cima o aparelho entrega z > 0 — a leitura aponta para cima, que é o
 * que o Android documenta ("empurrado em direção ao céu dá > 9,81").
 *
 * Derivada a partir daí, com G = 9,81 e o aparelho de bruços:
 *   topo levantado β  → y = +G·sen β, z = +G·cos β
 *   borda direita em baixo φ → x = −G·sen φ
 */
const G = 9.81;
const flat: Vector3 = { x: 0, y: 0, z: G };
const upright: Vector3 = { x: 0, y: G, z: 0 };
const topLifted = (deg: number): Vector3 => {
  const r = (deg * Math.PI) / 180;
  return { x: 0, y: G * Math.sin(r), z: G * Math.cos(r) };
};
const rightDown = (deg: number): Vector3 => {
  const r = (deg * Math.PI) / 180;
  return { x: -G * Math.sin(r), y: 0, z: G * Math.cos(r) };
};
const scale = (a: Vector3, k: number): Vector3 => ({
  x: a.x * k,
  y: a.y * k,
  z: a.z * k,
});

describe('pitchRollDeg', () => {
  it('é zero com o aparelho debruços na mesa', () => {
    expect(pitchRollDeg(flat).pitch).toBeCloseTo(0, 6);
    expect(pitchRollDeg(flat).roll).toBeCloseTo(0, 6);
  });

  it('pitch positivo quando o topo sobe', () => {
    expect(pitchRollDeg(topLifted(30)).pitch).toBeCloseTo(30, 4);
    expect(pitchRollDeg(topLifted(75)).pitch).toBeCloseTo(75, 4);
  });

  it('pitch negativo quando o topo desce', () => {
    expect(pitchRollDeg(topLifted(-40)).pitch).toBeCloseTo(-40, 4);
  });

  it('roll positivo quando a borda direita desce', () => {
    expect(pitchRollDeg(rightDown(20)).roll).toBeCloseTo(20, 4);
    expect(pitchRollDeg(rightDown(-25)).roll).toBeCloseTo(-25, 4);
  });

  it('retido na vertical mede 90° de pitch e 0 de roll', () => {
    expect(pitchRollDeg(upright).pitch).toBeCloseTo(90, 4);
    expect(pitchRollDeg(upright).roll).toBeCloseTo(0, 6);
  });

  it('não muda de resultado com a escala do sensor (g vs m/s²)', () => {
    for (const fixture of [topLifted(33), rightDown(17), upright]) {
      const ms2 = pitchRollDeg(scale(fixture, 1));
      const g = pitchRollDeg(scale(fixture, 1 / G));
      expect(ms2.pitch).toBeCloseTo(g.pitch, 6);
      expect(ms2.roll).toBeCloseTo(g.roll, 6);
    }
  });

  it('nunca devolve NaN para entrada degenerada', () => {
    expect(pitchRollDeg({ x: 0, y: 0, z: 0 })).toEqual({ pitch: 0, roll: 0 });
    expect(pitchRollDeg({ x: NaN, y: 1, z: 9 })).toEqual({ pitch: 0, roll: 0 });
    expect(pitchRollDeg({ x: 1, y: Infinity, z: 9 })).toEqual({ pitch: 0, roll: 0 });
  });
});

describe('viewElevationDeg', () => {
  it('é −90° debruços (a câmera traseira olha para o chão)', () => {
    expect(viewElevationDeg(flat)).toBeCloseTo(-90, 4);
  });

  it('é 0° retido na vertical (o horizonte no centro do ecrã)', () => {
    expect(viewElevationDeg(upright)).toBeCloseTo(0, 4);
  });

  it('é +90° de costas para o chão (a câmera olha para o céu)', () => {
    expect(viewElevationDeg({ x: 0, y: 0, z: -G })).toBeCloseTo(90, 4);
  });

  it('acompanha a inclinação: levantar o topo tira o eixo de visão do chão', () => {
    // topo +30° → a câmera (−Z) deixa de apontar a −90° e passa a −60°
    expect(viewElevationDeg(topLifted(30))).toBeCloseTo(-60, 4);
    expect(viewElevationDeg(topLifted(90))).toBeCloseTo(0, 4);
  });

  it('não depende da escala nem de X/Y', () => {
    const a = topLifted(48);
    expect(viewElevationDeg(scale(a, 1))).toBeCloseTo(viewElevationDeg(scale(a, 1 / G)), 6);
    expect(viewElevationDeg({ x: 9, y: -4, z: 0 })).toBeCloseTo(0, 6);
  });

  it('nunca devolve NaN para entrada degenerada', () => {
    expect(viewElevationDeg({ x: 0, y: 0, z: 0 })).toBe(0);
    expect(viewElevationDeg({ x: NaN, y: 0, z: 0 })).toBe(0);
    expect(viewElevationDeg({ x: 0, y: 0, z: Infinity })).toBe(0);
  });
});

describe('verticalFovDeg', () => {
  it('num ecrã quadrado o vertical é igual ao horizontal', () => {
    expect(verticalFovDeg(80, 400, 400)).toBeCloseTo(80, 4);
  });

  it('num ecrã alto (retrato) o vertical cresce em relação ao horizontal', () => {
    expect(verticalFovDeg(70, 360, 780)).toBeGreaterThan(70);
  });

  it('num ecrã largo (paisagem) o vertical encolhe', () => {
    expect(verticalFovDeg(70, 780, 360)).toBeLessThan(70);
  });

  it('sem ecrã medido cai na estimativa e nunca dá Infinity/NaN', () => {
    expect(verticalFovDeg(90, 0, 0)).toBeCloseTo(54, 6);
    expect(Number.isFinite(verticalFovDeg(90, -10, 300))).toBe(true);
    expect(Number.isFinite(verticalFovDeg(NaN, 300, 600))).toBe(true);
  });
});

describe('markerTopPct', () => {
  const vFov = 40;

  it('alvo no horizonte com a câmera nivelada fica no centro', () => {
    expect(markerTopPct(0, 0, vFov, 30)).toBeCloseTo(50, 6);
  });

  it('alvo acima do eixo de visão sobe (menor %), abaixo desce', () => {
    const up = markerTopPct(12, 0, vFov, 30);
    const down = markerTopPct(-12, 0, vFov, 30);
    expect(up).toBeCloseTo(20, 6);
    expect(down).toBeCloseTo(80, 6);
    expect(up).toBeLessThan(down);
  });

  it('levantar a câmera empurra o alvo fixo para baixo da tela', () => {
    // alvo a 30°, câmera a mirá-lo → cai no centro; câmera a 0° → fica acima
    expect(markerTopPct(30, 30, vFov, 30)).toBeCloseTo(50, 6);
    expect(markerTopPct(30, 0, vFov, 30)).toBeLessThan(50);
  });

  it('apara para dentro do ecrã quando o alvo está fora do campo', () => {
    expect(markerTopPct(80, 0, vFov, 30)).toBe(6);
    expect(markerTopPct(-80, 0, vFov, 30)).toBe(94);
  });

  it('sem elevação ou sem FOV usa o fallback fixo', () => {
    expect(markerTopPct(null, 0, vFov, 30)).toBe(30);
    expect(markerTopPct(10, 0, 0, 30)).toBe(30);
    expect(markerTopPct(NaN, 0, vFov, 30)).toBe(30);
    expect(markerTopPct(10, NaN, vFov, 30)).toBe(30);
  });
});

describe('elevationAngle', () => {
  it('alinha a hipotenusa certa: desnível igual à distância dá 45°', () => {
    expect(elevationAngle(100, 100)).toBeCloseTo(45, 6);
  });

  it('sinal positivo para o alvo acima de quem observa', () => {
    expect(elevationAngle(10, 100)).toBeGreaterThan(0);
    expect(elevationAngle(-10, 100)).toBeLessThan(0);
    expect(elevationAngle(0, 100)).toBeCloseTo(0, 6);
  });

  it('devolve null sem distância (ângulo indeterminado)', () => {
    expect(elevationAngle(10, 0)).toBeNull();
    expect(elevationAngle(10, -5)).toBeNull();
    expect(elevationAngle(10, NaN)).toBeNull();
    expect(elevationAngle(NaN, 100)).toBeNull();
  });
});

describe('dominantAxis', () => {
  const axes: AxisValues = { x: 12, y: 48, z: 9 };

  it('sem linha de base compara valores absolutos', () => {
    expect(dominantAxis(axes, null)).toBe('y');
    expect(dominantAxis({ x: -60, y: 4, z: 9 }, null)).toBe('x');
    expect(dominantAxis({ x: 1, y: 2, z: -70 }, null)).toBe('z');
  });

  it('com linha de base compara o desvio do ambiente', () => {
    // o valor absoluto maior é y, mas quem mais se afastou do ambiente foi x
    expect(dominantAxis({ x: 40, y: 48, z: 9 }, { x: 5, y: 45, z: 8 })).toBe('x');
    expect(dominantAxis({ x: 12, y: 48, z: 9 }, { x: 12, y: 12, z: 9 })).toBe('y');
  });

  it('empate fica com o primeiro eixo (x, y, z) e não oscila', () => {
    expect(dominantAxis({ x: 5, y: 5, z: 5 }, null)).toBe('x');
    expect(dominantAxis({ x: 5, y: 5, z: 1 }, null)).toBe('x');
    expect(dominantAxis({ x: 1, y: 5, z: 5 }, null)).toBe('y');
  });
});
