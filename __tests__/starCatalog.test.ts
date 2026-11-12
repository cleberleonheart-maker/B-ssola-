import { BRIGHT_STARS, CRUX_CENTRE, POLARIS_STAR } from '../src/utils/starCatalog';

/**
 * O catálogo de estrelas (ideia #13).
 *
 * São dados, e dados errados não dão erro nenhum: uma declinação trocada
 * põe a estrela no lado errado do céu e a mira aponta para o ar. O que se
 * verifica aqui é a integridade do catálogo — e o que ele não pode deixar de
 * ter: os ids são únicos (o id é o que a app usa para escolher o alvo), as
 * coordenadas estão nos intervalos do céu e a Polaris está onde tem de estar.
 */

describe('o catálogo de estrelas', () => {
  it('tem estrelas para escolher', () => {
    expect(BRIGHT_STARS.length).toBeGreaterThanOrEqual(40);
  });

  it('cada estrela tem o seu id', () => {
    const ids = BRIGHT_STARS.map(s => s.id);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repetidos).toEqual([]);
  });

  it('o id da Polaris e o da Cruz não colidem com as estrelas', () => {
    const ids = BRIGHT_STARS.map(s => s.id);
    expect(ids).not.toContain(POLARIS_STAR.id);
    expect(ids).not.toContain(CRUX_CENTRE.id);
  });

  it('as coordenadas estão dentro do céu', () => {
    for (const star of BRIGHT_STARS) {
      expect({ id: star.id, ra: star.ra }).toEqual({
        id: star.id,
        ra: expect.any(Number),
      });
      expect(star.ra).toBeGreaterThanOrEqual(0);
      expect(star.ra).toBeLessThan(360);
      expect(star.dec).toBeGreaterThanOrEqual(-90);
      expect(star.dec).toBeLessThanOrEqual(90);
      expect(Number.isFinite(star.dec)).toBe(true);
      expect(Number.isFinite(star.magnitude)).toBe(true);
    }
  });

  it('cada estrela tem nome', () => {
    for (const star of BRIGHT_STARS) {
      expect(star.name.length).toBeGreaterThan(0);
      expect(star.id.length).toBeGreaterThan(0);
    }
  });

  it('as estrelas mais brilhantes estão no topo', () => {
    // O catálogo é usado para escolher o alvo: as mais brilhantes são as
    // mais fáceis de reconhecer a olho nu.
    const magnitudes = BRIGHT_STARS.map(s => s.magnitude);
    const maisBrilhante = Math.min(...magnitudes);
    expect(magnitudes.filter(m => m === maisBrilhante).length).toBe(1);
    expect(BRIGHT_STARS[0].magnitude).toBe(maisBrilhante);
  });

  it('a Polaris está junto ao polo celeste norte', () => {
    expect(POLARIS_STAR.dec).toBeGreaterThan(89);
    expect(POLARIS_STAR.dec).toBeLessThan(90);
  });

  it('o catalogo tem estrelas dos dois hemisferios', () => {
    // Sem estrelas do sul, a calibracao no Brasil so tinha a Cruz — e a Cruz
    // nem sempre esta bem posta.
    expect(BRIGHT_STARS.some(s => s.dec > 0)).toBe(true);
    expect(BRIGHT_STARS.some(s => s.dec < 0)).toBe(true);
  });
});
