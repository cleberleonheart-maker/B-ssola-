import {
  heightFromAngles,
  meanAngle,
  isInvertedConvention,
  applyConvention,
  CONVENTION_THRESHOLD,
} from '../src/utils/height';

describe('meanAngle', () => {
  it('devolve a média aritmética', () => {
    expect(meanAngle([10, 20, 30])).toBeCloseTo(20, 6);
  });

  it('ignora leituras não finitas', () => {
    expect(meanAngle([10, NaN, 30, Infinity])).toBeCloseTo(20, 6);
  });

  it('sem leituras válidas devolve 0 em vez de NaN', () => {
    expect(meanAngle([])).toBe(0);
    expect(meanAngle([NaN, Infinity])).toBe(0);
  });

  it('uma só leitura é ela mesma', () => {
    expect(meanAngle([-7.5])).toBeCloseTo(-7.5, 6);
  });
});

describe('heightFromAngles', () => {
  it('altura por dois ângulos e a distância', () => {
    // topo a 45°, base a 0° e 10 m de distância: 10 * (1 - 0) = 10 m
    expect(heightFromAngles(45, 0, 10)).toBeCloseTo(10, 6);
  });

  it('base abaixo do horizonte soma as duas alturas', () => {
    // topo 30° (0.577), base -30° (-0.577): 10 * (0.577 - (-0.577)) ≈ 11.55
    expect(heightFromAngles(30, -30, 10)).toBeCloseTo(
      10 * (Math.tan(Math.PI / 6) * 2),
      6,
    );
  });

  it('sem uma das capturas devolve null', () => {
    expect(heightFromAngles(null, 0, 10)).toBeNull();
    expect(heightFromAngles(45, null, 10)).toBeNull();
  });

  it('distância não positiva devolve null', () => {
    expect(heightFromAngles(45, 0, 0)).toBeNull();
    expect(heightFromAngles(45, 0, -3)).toBeNull();
  });

  it('base acima do topo devolve null (convenção invertida)', () => {
    expect(heightFromAngles(0, 45, 10)).toBeNull();
  });

  it('valores não finitos devolvem null', () => {
    expect(heightFromAngles(NaN, 0, 10)).toBeNull();
    expect(heightFromAngles(45, 0, Infinity)).toBeNull();
  });

  it('base e topo na mesma altura dá zero, não null', () => {
    expect(heightFromAngles(20, 20, 10)).toBeCloseTo(0, 6);
  });
});

describe('tilt convention auto-detection (#65)', () => {
  it('reconhece convenção invertida ao apontar o topo ao céu com ângulo negativo', () => {
    expect(isInvertedConvention(-70)).toBe(true);
    expect(isInvertedConvention(CONVENTION_THRESHOLD)).toBe(true);
  });

  it('não inverte quando apontar para cima já dá positivo', () => {
    expect(isInvertedConvention(45)).toBe(false);
    expect(isInvertedConvention(0)).toBe(false);
    expect(isInvertedConvention(-30)).toBe(false);
  });

  it('ignora valores não finitos', () => {
    expect(isInvertedConvention(NaN)).toBe(false);
    expect(isInvertedConvention(Infinity)).toBe(false);
  });

  it('aplica a correção trocando o sinal', () => {
    expect(applyConvention(-60, true)).toBeCloseTo(60, 6);
    expect(applyConvention(30, false)).toBeCloseTo(30, 6);
    expect(applyConvention(-5, true)).toBeCloseTo(5, 6);
  });
});
