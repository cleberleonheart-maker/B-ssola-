import { normalizeHeading, cardinalOf } from '../src/utils/compass';
import { applyDeclination, DEFAULT_DECLINATION } from '../src/utils/declination';

describe('normalizeHeading', () => {
  it('normaliza para 0-360', () => {
    expect(normalizeHeading(365)).toBe(5);
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(700)).toBe(340);
    expect(normalizeHeading(0)).toBe(0);
    expect(normalizeHeading(360)).toBe(0);
  });
});

describe('cardinalOf', () => {
  it('retorna ponto cardeal correspondente', () => {
    expect(cardinalOf(0).short).toBe('N');
    expect(cardinalOf(90).short).toBe('L');
    expect(cardinalOf(180).short).toBe('S');
    expect(cardinalOf(270).short).toBe('O');
    expect(cardinalOf(359).short).toBe('N');
    expect(cardinalOf(200).full).toBe('Sul');
  });
});

describe('applyDeclination', () => {
  it('retorna o heading se desabilitado', () => {
    expect(applyDeclination(10, DEFAULT_DECLINATION)).toBe(10);
  });

  it('soma a declinacao quando habilitada', () => {
    expect(
      applyDeclination(10, { enabled: true, degrees: 15 }),
    ).toBe(25);
    expect(
      applyDeclination(355, { enabled: true, degrees: 15 }),
    ).toBe(10);
  });
});