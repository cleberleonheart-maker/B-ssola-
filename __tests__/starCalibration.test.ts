import { crossCentrePosition, polarisPosition, starPosition } from '../src/utils/astro';
import {
  angleDelta,
  bestTarget,
  calibrationTargets,
  declinationFromStar,
  isDaytime,
  starAim,
  STAR_AZIMUTH_TOLERANCE,
  STAR_ELEVATION_TOLERANCE,
  TARGET_MAX_ELEVATION,
} from '../src/utils/starCalibration';

const SAO_PAULO = { lat: -23.55, lon: -46.63 };
const LISBOA = { lat: 38.72, lon: -9.14 };
/** 4 de novembro de 2026, 03:00 UTC — noite no Brasil, madrugada em Lisboa. */
const NOITE = new Date('2026-11-04T03:00:00Z');
/**
 * 4 de abril de 2026, 22:00 UTC = 19:00 em São Paulo: a Cruz do Sul está a
 * ~30° de altura a sudeste, com o Sol 14° abaixo do horizonte (noite cerrada).
 *
 * A Cruz muda muito com a estação — em novembro ela põe-se às 18:45 em São
 * Paulo e só se vê de madrugada, a ~30° a sudeste — por isso o instante de
 * teste tem de ser concreto.
 */
const CRUZ_ALTA = new Date('2026-04-04T22:00:00Z');

describe('a Polaris só existe no hemisfério norte', () => {
  it('em São Paulo está abaixo do horizonte', () => {
    const p = polarisPosition(NOITE, SAO_PAULO.lat, SAO_PAULO.lon);
    expect(p.elevation).toBeLessThan(0);
    expect(p.visible).toBe(false);
  });

  it('em Lisboa está à altura da latitude', () => {
    const p = polarisPosition(NOITE, LISBOA.lat, LISBOA.lon);
    expect(Math.abs(p.elevation - LISBOA.lat)).toBeLessThan(1.5);
    expect(p.visible).toBe(true);
  });

  it('o azimute da Polaris é o norte verdadeiro', () => {
    const p = polarisPosition(NOITE, LISBOA.lat, LISBOA.lon);
    const dist = Math.min(p.azimuth, 360 - p.azimuth);
    expect(dist).toBeLessThan(1);
  });
});

describe('o centro da Cruz do Sul', () => {
  it('em São Paulo está no céu e a norte do observador', () => {
    const c = crossCentrePosition(CRUZ_ALTA, SAO_PAULO.lat, SAO_PAULO.lon);
    expect(c.elevation).toBeGreaterThan(0);
    expect(c.visible).toBe(true);
    // O centro da Cruz fica a ~30° do polo sul: no Brasil, entre 20° e 70°
    // de altura, perto do meio do caminho para o sul.
    expect(c.elevation).toBeGreaterThan(20);
    expect(c.elevation).toBeLessThan(70);
  });

  it('em Lisboa está abaixo do horizonte', () => {
    const c = crossCentrePosition(CRUZ_ALTA, LISBOA.lat, LISBOA.lon);
    expect(c.elevation).toBeLessThan(0);
  });

  it('o azimute anda perto do sul verdadeiro', () => {
    const c = crossCentrePosition(CRUZ_ALTA, SAO_PAULO.lat, SAO_PAULO.lon);
    const dist = Math.min(Math.abs(c.azimuth - 180), 360 - Math.abs(c.azimuth - 180));
    expect(dist).toBeLessThan(35);
  });

  it('é de noite quando a Cruz está bem posta no Brasil', () => {
    expect(isDaytime(CRUZ_ALTA, SAO_PAULO.lat, SAO_PAULO.lon)).toBe(false);
  });
});

describe('as estrelas do catálogo', () => {
  it('o Sirius está no céu do Brasil, no hemisfério sul', () => {
    const s = starPosition(
      { rightAscension: 101.2872, declination: -16.7161 },
      NOITE,
      SAO_PAULO.lat,
      SAO_PAULO.lon,
    );
    expect(s.elevation).toBeGreaterThan(0);
    expect(s.visible).toBe(true);
  });
});

describe('os alvos que a app oferece', () => {
  it('no Brasil não oferece a Polaris, mas oferece a Cruz do Sul', () => {
    const targets = calibrationTargets(CRUZ_ALTA, SAO_PAULO.lat, SAO_PAULO.lon);
    const ids = targets.map(t => t.id);
    expect(ids).not.toContain('polaris');
    expect(ids).toContain('cross');
  });

  it('a Cruz do Sul bem posta fica utilizável', () => {
    const targets = calibrationTargets(CRUZ_ALTA, SAO_PAULO.lat, SAO_PAULO.lon);
    const cross = targets.find(t => t.id === 'cross');
    expect(cross).toBeDefined();
    expect(cross!.usable).toBe(true);
  });

  it('em Lisboa oferece a Polaris', () => {
    const targets = calibrationTargets(NOITE, LISBOA.lat, LISBOA.lon);
    expect(targets.map(t => t.id)).toContain('polaris');
  });

  it('no Brasil há estrelas do hemisfério sul bem colocadas', () => {
    const targets = calibrationTargets(NOITE, SAO_PAULO.lat, SAO_PAULO.lon);
    const boas = targets.filter(t => t.usable);
    expect(boas.length).toBeGreaterThan(3);
    expect(boas.map(t => t.id)).toContain('sirius');
  });

  it('escolhe o alvo mais bem colocado', () => {
    const targets = calibrationTargets(NOITE, SAO_PAULO.lat, SAO_PAULO.lon);
    const best = bestTarget(targets);
    expect(best).not.toBeNull();
    expect(best!.usable).toBe(true);
    expect(best!.position.elevation).toBeLessThanOrEqual(TARGET_MAX_ELEVATION);
  });

  it('só oferece estrelas acima do horizonte', () => {
    const targets = calibrationTargets(NOITE, SAO_PAULO.lat, SAO_PAULO.lon);
    expect(targets.every(t => t.position.elevation > 0)).toBe(true);
  });

  it('de dia avisa que é de dia', () => {
    const meioDia = new Date('2026-11-04T12:00:00Z');
    expect(isDaytime(meioDia, SAO_PAULO.lat, SAO_PAULO.lon)).toBe(true);
    expect(isDaytime(NOITE, SAO_PAULO.lat, SAO_PAULO.lon)).toBe(false);
  });
});

describe('a mira', () => {
  const star = { azimuth: 359.9, elevation: 22.9, visible: true };

  it('diz quanto falta para virar e para levantar', () => {
    const aim = starAim(350, 20, star);
    expect(aim.azimuthError).toBeCloseTo(9.9, 1);
    expect(aim.elevationError).toBeCloseTo(2.9, 1);
    expect(aim.onTarget).toBe(false);
  });

  it('dá o alvo como acertado quando o erro é pequeno', () => {
    const aim = starAim(359.9, 22.9, star);
    expect(aim.onTarget).toBe(true);
  });

  it('a tolerância é de poucos graus', () => {
    const dentro = starAim(
      star.azimuth + STAR_AZIMUTH_TOLERANCE,
      star.elevation - STAR_ELEVATION_TOLERANCE,
      star,
    );
    expect(dentro.onTarget).toBe(true);
    const fora = starAim(
      star.azimuth + STAR_AZIMUTH_TOLERANCE + 1,
      star.elevation,
      star,
    );
    expect(fora.onTarget).toBe(false);
  });
});

describe('a declinação medida pela estrela', () => {
  it('vale o azimute verdadeiro menos o magnético', () => {
    // Em São Paulo o norte magnético está ~21° a leste do verdadeiro: a
    // estrela está a 0°, o magnetómetro lê 21°, e a declinação dá −21.
    expect(declinationFromStar(0, 21)).toBeCloseTo(-21, 5);
  });

  it('se o magnético e o verdadeiro coincidem, a declinação é zero', () => {
    expect(declinationFromStar(120, 120)).toBeCloseTo(0, 5);
  });

  it('no hemisfério sul também dá (a estrela a sul, o magnético a oeste)', () => {
    // A estrela verdadeira está a 180° (sul) e o magnetómetro lê 160°:
    // o norte magnético está a leste do verdadeiro, declinação negativa.
    expect(declinationFromStar(180, 160)).toBeCloseTo(20, 5);
  });

  it('o resultado fica no intervalo de uma declinação', () => {
    expect(declinationFromStar(350, 10)).toBeCloseTo(-20, 5);
    expect(declinationFromStar(10, 350)).toBeCloseTo(20, 5);
  });
});

describe('diferença com sinal entre azimutes', () => {
  it('dá o caminho mais curto', () => {
    expect(angleDelta(350, 10)).toBeCloseTo(20, 5);
    expect(angleDelta(10, 350)).toBeCloseTo(-20, 5);
    expect(angleDelta(0, 180)).toBeCloseTo(180, 5);
  });
});
