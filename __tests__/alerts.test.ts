import {
  inmetRings,
  pointInRing,
  parseInmetSeverity,
} from '../src/services/alertsService';

describe('inmetRings', () => {
  it('extrai o anel de um Polygon', () => {
    const rings = inmetRings(
      '{"type":"Polygon","coordinates":[[[-51,-30],[-50,-30],[-50,-29],[-51,-29],[-51,-30]]]}',
    );
    expect(rings.length).toBe(1);
    expect(rings[0].length).toBe(5);
  });

  it('extrai os aneis de um MultiPolygon', () => {
    const rings = inmetRings(
      '{"type":"MultiPolygon","coordinates":[[[[-51,-30],[-50,-30],[-50,-29],[-51,-29],[-51,-30]]],[[[-49,-28],[-48,-28],[-48,-27],[-49,-27],[-49,-28]]]]}',
    );
    expect(rings.length).toBe(2);
  });

  it('retorna [] para JSON invalido', () => {
    expect(inmetRings('not json')).toEqual([]);
    expect(inmetRings('{"type":"Polygon"}')).toEqual([]);
    expect(inmetRings('')).toEqual([]);
  });
});

describe('pointInRing', () => {
  const ring = [
    [-51, -30],
    [-50, -30],
    [-50, -29],
    [-51, -29],
  ];

  it('detecta ponto dentro', () => {
    expect(pointInRing(-29.5, -50.5, ring)).toBe(true);
  });

  it('detecta ponto fora', () => {
    expect(pointInRing(-25, -49, ring)).toBe(false);
    expect(pointInRing(-31, -50.5, ring)).toBe(false);
  });
});

describe('parseInmetSeverity', () => {
  it('mapeia Grande Perigo -> red', () => {
    expect(parseInmetSeverity('Grande Perigo')).toBe('red');
  });

  it('mapeia Perigo (sem Potencial) -> orange', () => {
    expect(parseInmetSeverity('Perigo')).toBe('orange');
  });

  it('mapeia Perigo Potencial -> yellow', () => {
    expect(parseInmetSeverity('Perigo Potencial')).toBe('yellow');
  });

  it('usa a cor quando a severidade e inconclusiva', () => {
    expect(parseInmetSeverity(undefined, '#FF0000')).toBe('red');
  });

  it('desconhecido -> green', () => {
    expect(parseInmetSeverity('qualquer coisa')).toBe('green');
  });
});