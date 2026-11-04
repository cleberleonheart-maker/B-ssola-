import { polarisPosition } from '../src/utils/astro';
import {
  angleDelta,
  declinationFromPolaris,
  expectedMagneticHeading,
  polarisAim,
  polarisUsable,
  POLARIS_AZIMUTH_TOLERANCE,
  POLARIS_ELEVATION_TOLERANCE,
  POLARIS_MAX_LATITUDE,
} from '../src/utils/polaris';

const SAO_PAULO = { lat: -23.55, lon: -46.63 };
const LISBOA = { lat: 38.72, lon: -9.14 };

describe('onde está a Polaris', () => {
  it('a altura é a latitude, mais a distância dela ao polo', () => {
    // Em São Paulo (23.55°S) a Polaris está a ~23° de altitude; a diferença
    // para a latitude é a distância da estrela ao polo celeste (meio grau).
    const p = polarisPosition(
      new Date('2026-11-04T03:00:00Z'),
      SAO_PAULO.lat,
      SAO_PAULO.lon,
    );
    expect(p.elevation).toBeGreaterThan(SAO_PAULO.lat);
    expect(Math.abs(p.elevation - SAO_PAULO.lat)).toBeLessThan(1.5);
  });

  it('o azimute é o norte verdadeiro', () => {
    for (const when of [
      '2026-11-04T03:00:00Z',
      '2026-11-04T15:00:00Z',
      '2026-01-15T02:00:00Z',
    ]) {
      const p = polarisPosition(new Date(when), SAO_PAULO.lat, SAO_PAULO.lon);
      const dist = Math.min(p.azimuth, 360 - p.azimuth);
      expect(dist).toBeLessThan(1);
    }
  });

  it('em Lisboa a altitude é a latitude', () => {
    const p = polarisPosition(
      new Date('2026-11-04T00:00:00Z'),
      LISBOA.lat,
      LISBOA.lon,
    );
    expect(Math.abs(p.elevation - LISBOA.lat)).toBeLessThan(1.5);
  });

  it('a precessão move a estrela: em J2000 estava mais longe do polo', () => {
    const j2000 = polarisPosition(
      new Date('2000-01-01T12:00:00Z'),
      SAO_PAULO.lat,
      SAO_PAULO.lon,
    );
    const agora = polarisPosition(
      new Date('2026-11-04T03:00:00Z'),
      SAO_PAULO.lat,
      SAO_PAULO.lon,
    );
    // Aproximar-se do polo significa a altitude mais perto da latitude.
    expect(Math.abs(agora.elevation - SAO_PAULO.lat)).toBeLessThan(
      Math.abs(j2000.elevation - SAO_PAULO.lat),
    );
  });
});

describe('a mira', () => {
  const polaris = { azimuth: 359.9, elevation: 22.9, visible: true };

  it('diz quanto falta para virar e para levantar', () => {
    const aim = polarisAim(350, 20, polaris);
    expect(aim.azimuthError).toBeCloseTo(9.9, 1);
    expect(aim.elevationError).toBeCloseTo(2.9, 1);
    expect(aim.onTarget).toBe(false);
  });

  it('dá o alvo como acertado quando o erro é pequeno', () => {
    const aim = polarisAim(359.9, 22.9, polaris);
    expect(aim.onTarget).toBe(true);
  });

  it('a tolerância é de poucos graus', () => {
    const dentro = polarisAim(
      polaris.azimuth + POLARIS_AZIMUTH_TOLERANCE,
      polaris.elevation - POLARIS_ELEVATION_TOLERANCE,
      polaris,
    );
    expect(dentro.onTarget).toBe(true);
    const fora = polarisAim(
      polaris.azimuth + POLARIS_AZIMUTH_TOLERANCE + 1,
      polaris.elevation,
      polaris,
    );
    expect(fora.onTarget).toBe(false);
  });
});

describe('a declinação medida pela estrela', () => {
  it('vale o azimute verdadeiro menos o magnético', () => {
    // Em São Paulo o norte magnético está ~21° a leste do verdadeiro: a
    // estrela está a 0°, o magnetómetro lê 21°, e a declinação dá −21.
    expect(declinationFromPolaris(0, 21)).toBeCloseTo(-21, 5);
  });

  it('se o magnético e o verdadeiro coincidem, a declinação é zero', () => {
    expect(declinationFromPolaris(120, 120)).toBeCloseTo(0, 5);
  });

  it('o resultado fica no intervalo de uma declinação', () => {
    expect(declinationFromPolaris(350, 10)).toBeCloseTo(-20, 5);
    expect(declinationFromPolaris(10, 350)).toBeCloseTo(20, 5);
  });
});

describe('comparar com o que o ecrã mostra', () => {
  it('com a declinação ligada, o esperado é o azimute menos a declinação', () => {
    expect(expectedMagneticHeading(0, true, -21)).toBeCloseTo(21, 5);
  });

  it('com a declinação desligada, o esperado é o azimute da estrela', () => {
    expect(expectedMagneticHeading(0, false, -21)).toBeCloseTo(0, 5);
  });
});

describe('onde a calibração é válida', () => {
  it('dá para latitudes de média', () => {
    expect(polarisUsable(SAO_PAULO.lat)).toBe(true);
    expect(polarisUsable(LISBOA.lat)).toBe(true);
    expect(polarisUsable(0)).toBe(true);
  });

  it('não dá acima dos 44° (a estrela ficaria alta demais para o telefone)', () => {
    expect(polarisUsable(POLARIS_MAX_LATITUDE)).toBe(true);
    expect(polarisUsable(POLARIS_MAX_LATITUDE + 1)).toBe(false);
    expect(polarisUsable(60)).toBe(false);
  });
});

describe('diferença com sinal entre azimutes', () => {
  it('dá o caminho mais curto', () => {
    expect(angleDelta(350, 10)).toBeCloseTo(20, 5);
    expect(angleDelta(10, 350)).toBeCloseTo(-20, 5);
    expect(angleDelta(0, 180)).toBeCloseTo(180, 5);
  });
});
