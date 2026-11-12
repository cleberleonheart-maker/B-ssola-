import { createFallDetector, FALL_DEFAULTS } from '../src/utils/fallDetector';

/**
 * A detecção de queda (ideia #7).
 *
 * O que o aviso oferece é o SOS, não o envio automático: quem caiu e pode
 * tocar é quem decide. Por isso o detector só tem de ser preciso a não
 * avisar quando ninguém caiu — atirar o telemóvel para a mesa dá um embate
 * igual, e um telemóvel pousado dá imobilidade igual. O que separa a queda
 * disto é o embate *e logo a seguir* a imobilidade.
 *
 * A imobilidade conta a partir da primeira leitura quieta depois do embate —
 * não a partir do embate. Por isso os testes passam por duas leituras: a
 * primeira começa a contar, a segunda confirma.
 */

const G = 1; // o acelerómetro lê 1 g quando o telemóvel está quieto

describe('o detector de queda', () => {
  it('sem embate nao ha queda, por mais tempo que o aparelho fique parado', () => {
    const det = createFallDetector();

    expect(det.push(G, 0)).toBe(false);
    expect(det.push(G, 5000)).toBe(false);
    expect(det.push(G, 10_000)).toBe(false);
  });

  it('o embate sozinho nao avisa', () => {
    const det = createFallDetector();

    expect(det.push(3.5, 0)).toBe(false);
    expect(det.state().impacted).toBe(true);
  });

  it('embate e depois imobilidade avisam uma vez', () => {
    const det = createFallDetector();

    det.push(3.5, 0); // o embate
    expect(det.push(G, 1000)).toBe(false); // ainda não ficou parado o tempo suficiente
    expect(det.push(G, 1000 + FALL_DEFAULTS.stillHoldMs)).toBe(true);
    // E só uma vez: quem continua no chão não é uma queda nova.
    expect(det.push(G, 1000 + FALL_DEFAULTS.stillHoldMs + 100)).toBe(false);
  });

  it('mexer o aparelho cancela a imobilidade', () => {
    const det = createFallDetector();

    det.push(3.5, 0);
    det.push(G, 1000); // começa a contar
    det.push(1.8, 1200); // mexeu-se: a contagem recomeça
    det.push(G, 1300); // volta a ficar quieto: conta a partir de agora
    expect(det.push(G, 1300 + FALL_DEFAULTS.stillHoldMs)).toBe(true);
  });

  it('um episodio nao sobrevive para sempre ao embate', () => {
    const det = createFallDetector();

    det.push(3.5, 0);
    // Muito depois da janela, o aparelho quieto já não é a queda: o embate
    // caducou e o que resta é um telemóvel pousado.
    expect(
      det.push(G, FALL_DEFAULTS.impactWindowMs + FALL_DEFAULTS.stillHoldMs + 10),
    ).toBe(false);
    expect(det.state().impacted).toBe(false);
  });

  it('um embate novo dentro da janela e do mesmo episodio', () => {
    const det = createFallDetector();

    det.push(3.5, 0); // a queda
    det.push(4.0, 300); // o ressalto: continua a ser o mesmo episódio
    det.push(G, 500); // o aparelho fica quieto
    expect(det.push(G, 500 + FALL_DEFAULTS.stillHoldMs)).toBe(true);
  });

  it('um embate velho demais ja nao vale', () => {
    const det = createFallDetector();

    det.push(3.5, 0);
    // Passou a janela do embate mais a da imobilidade: o que ficou foi um
    // telemóvel atirado para a mesa há muito tempo.
    expect(det.push(G, FALL_DEFAULTS.impactWindowMs + FALL_DEFAULTS.stillHoldMs + 1)).toBe(false);
    expect(det.state().impacted).toBe(false);
  });

  it('duas quedas seguidas nao dão dois avisos', () => {
    const det = createFallDetector();

    det.push(3.5, 0);
    det.push(G, 1000);
    expect(det.push(G, 1000 + FALL_DEFAULTS.stillHoldMs)).toBe(true);

    // A segunda queda, dentro do tempo de espera.
    det.push(3.5, 5000);
    det.push(G, 6000);
    expect(det.push(G, 6000 + FALL_DEFAULTS.stillHoldMs)).toBe(false);
  });

  it('depois do tempo de espera, outra queda avisa', () => {
    const det = createFallDetector();

    det.push(3.5, 0);
    det.push(G, 1000);
    expect(det.push(G, 1000 + FALL_DEFAULTS.stillHoldMs)).toBe(true);

    const depois = 1000 + FALL_DEFAULTS.stillHoldMs + FALL_DEFAULTS.cooldownMs + 1000;
    det.push(3.5, depois);
    det.push(G, depois + 1000);
    expect(det.push(G, depois + 1000 + FALL_DEFAULTS.stillHoldMs)).toBe(true);
  });

  it('uma leitura sem numero nao conta', () => {
    const det = createFallDetector();

    expect(det.push(NaN, 0)).toBe(false);
    expect(det.push(Infinity, 0)).toBe(false);
    expect(det.state().impacted).toBe(false);
  });

  it('o reset limpa o embate a meio', () => {
    const det = createFallDetector();

    det.push(3.5, 0);
    expect(det.state().impacted).toBe(true);
    det.reset();
    expect(det.state().impacted).toBe(false);
    expect(det.push(G, FALL_DEFAULTS.stillHoldMs)).toBe(false);
  });

  it('as opcoes mudam os limiares', () => {
    const det = createFallDetector({ impactG: 1.5, stillHoldMs: 500 });

    det.push(1.6, 0);
    det.push(G, 100);
    expect(det.push(G, 100 + 500)).toBe(true);
  });

  it('o estado guarda quando foi o ultimo aviso', () => {
    const det = createFallDetector();

    det.push(3.5, 0);
    expect(det.state().lastTriggerAt).toBeNull();
    det.push(G, 1000);
    det.push(G, 1000 + FALL_DEFAULTS.stillHoldMs);
    expect(det.state().lastTriggerAt).toBe(1000 + FALL_DEFAULTS.stillHoldMs);
  });
});
