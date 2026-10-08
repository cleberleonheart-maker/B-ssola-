import { createStepDetector } from '../src/utils/stepDetector';

describe('createStepDetector', () => {
  it('não dispara nenhum passo com o telefone parado', () => {
    const detector = createStepDetector();
    let steps = 0;
    for (let i = 0; i < 50; i++) {
      if (detector.push(i * 20, 0, 0, 1)) steps++;
    }
    expect(steps).toBe(0);
  });

  it('dispara um passo quando a magnitude sobe acima do limiar e rearma ao descer', () => {
    const detector = createStepDetector({
      threshold: 0.05,
      release: 0.01,
      minStepGapMs: 0,
    });
    expect(detector.push(0, 0, 0, 1)).toBe(false); // repouso
    expect(detector.push(10, 0, 0, 1.2)).toBe(true); // primeiro passo
    expect(detector.push(20, 0, 0, 1.2)).toBe(false); // ainda alto: sem re-subida
    expect(detector.push(30, 0, 0, 0.8)).toBe(false); // desce: rearma
    expect(detector.push(40, 0, 0, 1.2)).toBe(true); // segundo passo
  });

  it('magnitude alta mantida não dispara de novo (histerese)', () => {
    const detector = createStepDetector({
      threshold: 0.05,
      release: 0.01,
      minStepGapMs: 0,
    });
    detector.push(0, 0, 0, 1);
    expect(detector.push(10, 0, 0, 1.3)).toBe(true);
    let more = 0;
    for (let i = 20; i <= 200; i += 20) {
      if (detector.push(i, 0, 0, 1.3)) more++;
    }
    expect(more).toBe(0);
  });

  it('suprime um segundo disparo dentro do intervalo mínimo', () => {
    const detector = createStepDetector({
      threshold: 0.05,
      release: 0.01,
      minStepGapMs: 1000,
    });
    detector.push(0, 0, 0, 1);
    expect(detector.push(10, 0, 0, 1.2)).toBe(true);
    detector.push(20, 0, 0, 0.8); // rearma
    expect(detector.push(30, 0, 0, 1.2)).toBe(false); // ainda dentro de 1000 ms
    detector.push(1000, 0, 0, 0.8); // mantém o repouso
    expect(detector.push(1010, 0, 0, 1.2)).toBe(true); // intervalo cumprido
  });

  it('conta as passadas de uma caminhada sintética', () => {
    const detector = createStepDetector({
      gravityAlpha: 0.7,
      threshold: 0.18,
      release: 0.06,
      minStepGapMs: 250,
    });
    // ciclo de passada a cada 500 ms: pico de 1,35 g, vale de 0,68 g
    const cycle = [1.02, 1.35, 1.02, 0.68, 1.02];
    let steps = 0;
    let now = 0;
    for (let k = 0; k < 6; k++) {
      for (const g of cycle) {
        if (detector.push(now, 0, 0, g)) steps++;
        now += 100;
      }
    }
    // os picos contam como passos; os trechos sem impacto não
    expect(steps).toBe(6);
  });
});