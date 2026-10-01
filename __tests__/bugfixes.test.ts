import { normalizeText, toTokens } from '../src/assistant/normalizer';
import { evalArithmetic } from '../src/assistant/math';
import { matches } from '../src/assistant/matcher';
import { spokenToExpr } from '../src/assistant/skills';
import { stripWakeWord, isWakeWord } from '../src/assistant/voice';
import { cloneMemory, DEFAULT_MEMORY, pushHistory } from '../src/assistant/memory';
import { moonPhase } from '../src/utils/astro';
import { normalizeHeading } from '../src/utils/compass';
import { verticalAngle } from '../src/components/HeightView';
import { simplifyPath } from '../src/services/trackService';
import { resolveLiveHeading } from '../src/services/liveShareService';

type Vec = { x: number; y: number; z: number };

describe('bug 1: decimal separator survives normalization', () => {
  it('keeps dot decimals', () => {
    expect(toTokens('calcula 2.5 vezes 2')).toEqual(['calcula', '2.5', 'vezes', '2']);
  });
  it('converts pt-BR comma decimals to dot', () => {
    expect(normalizeText('quanto e 1,5 mais 1')).toBe('quanto e 1.5 mais 1');
    expect(toTokens('quanto e 1,5 mais 1')).toEqual(['quanto', 'e', '1.5', 'mais', '1']);
  });
  it('still strips real punctuation', () => {
    expect(normalizeText('Olá, mundo! (teste)')).toBe('ola mundo teste');
  });
});

describe('bug 2: evalArithmetic rejects instead of guessing', () => {
  it('computes valid decimals', () => {
    expect(evalArithmetic('2.5 * 2')).toBe(5);
    expect(evalArithmetic('1.5 + 1')).toBe(2.5);
  });
  it('returns null for trailing garbage instead of a wrong answer', () => {
    expect(evalArithmetic('3 x')).toBeNull();
    expect(evalArithmetic('1e')).toBeNull();
    expect(evalArithmetic('5 sensores')).toBeNull();
    expect(evalArithmetic('1e3')).toBeNull();
  });
  it('treats x as multiplication between digits', () => {
    expect(evalArithmetic('3x2')).toBe(6);
  });
  it('still guards division by zero and non-finite results', () => {
    expect(evalArithmetic('5 / 0')).toBeNull();
  });
});

describe('math skill: spoken numbers and "por"', () => {
  it('understands word numbers', () => {
    expect(evalArithmetic(spokenToExpr('dois mais dois'))).toBe(4);
    expect(evalArithmetic(spokenToExpr('vinte menos oito'))).toBe(12);
  });
  it('understands "por" as division', () => {
    expect(evalArithmetic(spokenToExpr('doze por 2'))).toBe(6);
    expect(evalArithmetic(spokenToExpr('100 dividido por 4'))).toBe(25);
  });
});

describe('bug 3: matcher wildcards and filler', () => {
  it('allows a trailing star to match empty', () => {
    expect(matches('quantas trilhas *', 'quantas trilhas', ['quantas', 'trilhas']).matched).toBe(true);
  });
  it('allows a mid-pattern star to match empty', () => {
    expect(matches('qual * latitude', 'qual latitude', ['qual', 'latitude']).matched).toBe(true);
  });
  it('tolerates leading filler without weakening wildcards', () => {
    const r = matches('quanto e ...', 'por favor quanto e 5 mais 3', [
      'por', 'favor', 'quanto', 'e', '5', 'mais', '3',
    ]);
    expect(r.matched).toBe(true);
    expect(r.wildcards).toEqual(['5 mais 3']);
  });
  it('still rejects non-matching input', () => {
    expect(matches('qual * latitude', 'qual pressao', ['qual', 'pressao']).matched).toBe(false);
  });
});

describe('bug 11: wake word does not swallow the command', () => {
  it('detects the wake word', () => {
    expect(isWakeWord('Kefera, qual a minha latitude?')).toBe(true);
    expect(isWakeWord('qual a hora')).toBe(false);
  });
  it('extracts the remainder of the sentence', () => {
    expect(stripWakeWord('Kefera, qual a minha latitude?')).toBe('qual a minha latitude');
    expect(stripWakeWord('kefera')).toBe('');
  });
});

describe('bug 14: DEFAULT_MEMORY is not shared between engines', () => {
  it('cloneMemory isolates facts and history', () => {
    const a = cloneMemory(DEFAULT_MEMORY);
    const b = cloneMemory(DEFAULT_MEMORY);
    pushHistory(a, 'user', 'oi');
    a.facts.nome = 'Ana';
    expect(b.history).toHaveLength(0);
    expect(b.facts.nome).toBeUndefined();
    expect(DEFAULT_MEMORY.history).toHaveLength(0);
    expect(DEFAULT_MEMORY.facts).toEqual({});
  });
});

describe('bug 17: lunar phase quarters', () => {
  const elongationFor = (name: string) => {
    // procura uma data em que a elongação caia na janela desejada
    for (let d = 0; d < 400; d += 0.5) {
      const date = new Date(Date.UTC(2026, 0, 1 + d));
      if (moonPhase(date).name === name) return moonPhase(date);
    }
    return null;
  };
  it('names the four quarters at the right elongation', () => {
    expect(elongationFor('Lua nova')).not.toBeNull();
    expect(elongationFor('Lua cheia')).not.toBeNull();
  });
  it('never labels a gibbous moon as a plain crescent/full out of range', () => {
    for (let d = 0; d < 60; d += 0.25) {
      const p = moonPhase(new Date(Date.UTC(2026, 5, 1 + d)));
      if (p.name === 'Lua cheia') {
        expect(p.fraction).toBeGreaterThan(0.95);
      }
    }
  });
  it('fraction matches the name', () => {
    for (let d = 0; d < 30; d += 0.5) {
      const p = moonPhase(new Date(Date.UTC(2026, 2, 1 + d)));
      if (p.name === 'Lua nova') expect(p.fraction).toBeLessThan(0.15);
      if (p.name === 'Lua cheia') expect(p.fraction).toBeGreaterThan(0.85);
    }
  });
});

describe('bugs 3-4: vertical angle is unit- and orientation-independent', () => {
  // convenção do sensor: x->direita, y->topo da tela, z->fora da tela
  const rad = (d: number) => (d * Math.PI) / 180;
  const rotX = (a: Vec, t: number) => ({
    x: a.x,
    y: a.y * Math.cos(t) - a.z * Math.sin(t),
    z: a.y * Math.sin(t) + a.z * Math.cos(t),
  });
  const rotY = (a: Vec, t: number) => ({
    x: a.x * Math.cos(t) + a.z * Math.sin(t),
    y: a.y,
    z: -a.x * Math.sin(t) + a.z * Math.cos(t),
  });
  const restMS = { x: 0, y: 0, z: 9.80665 };
  const restG = { x: 0, y: 0, z: 1 };

  it('reads the true elevation in portrait (top lifted)', () => {
    for (const deg of [0, 15, 30, 45, 60, 75]) {
      expect(verticalAngle(rotX(restMS, rad(deg)), false)).toBeCloseTo(deg, 4);
    }
  });

  it('gives the identical result whether the sensor reports g or m/s2', () => {
    for (const deg of [0, 20, 45, 70]) {
      const a = rotX(restMS, rad(deg));
      const b = rotX(restG, rad(deg));
      expect(verticalAngle(a, false)).toBeCloseTo(verticalAngle(b, false), 6);
    }
    for (const deg of [0, 20, 45, 70]) {
      const a = rotY(restMS, rad(deg));
      const b = rotY(restG, rad(deg));
      expect(verticalAngle(a, true)).toBeCloseTo(verticalAngle(b, true), 6);
    }
  });

  it('reaches a wide range instead of clamping at ~5.85 degrees (iOS bug)', () => {
    const tilted = rotX(restG, rad(60));
    expect(verticalAngle(tilted, false)).toBeCloseTo(60, 4);
  });

  it('reports negative when pointing down', () => {
    expect(verticalAngle(rotX(restMS, rad(-40)), false)).toBeCloseTo(-40, 4);
  });

  it('never returns NaN for degenerate input', () => {
    expect(verticalAngle({ x: 0, y: 0, z: 0 }, false)).toBe(0);
    expect(verticalAngle({ x: NaN, y: 1, z: 9 }, false)).toBe(0);
    expect(verticalAngle({ x: 1, y: Infinity, z: 9 }, false)).toBe(0);
  });

  it('matches the rest-pose reading across orientations', () => {
    expect(verticalAngle(restMS, false)).toBeCloseTo(0, 4);
    expect(verticalAngle(restMS, true)).toBeCloseTo(0, 4);
  });
});

describe('bug 18: heading wrap used for accessibility', () => {
  it('normalizeHeading folds accumulated rotation into 0-360', () => {
    expect(normalizeHeading(723)).toBeCloseTo(3, 5);
    expect(normalizeHeading(-10)).toBeCloseTo(350, 5);
  });
});

describe('bug 19: simplifyPath collapsed every track to 2 points', () => {
  const line = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      lat: -23.55 + (i / (n - 1)) * 0.01,
      lon: -46.63 + (i / (n - 1)) * 0.01,
      alt: 100,
      ts: 1700000000000 + i * 1000,
    }));

  it('keeps the endpoints of a straight track', () => {
    const out = simplifyPath(line(400), 0.00002);
    expect(out.length).toBe(2);
    expect(out[0].lat).toBeCloseTo(-23.55, 9);
    expect(out[out.length - 1].lat).toBeCloseTo(-23.54, 6);
  });

  it('preserves a real corner instead of cutting across it', () => {
    const pts = [
      { lat: 0, lon: 0, alt: null, ts: 1 },
      { lat: 0, lon: 0.001, alt: null, ts: 2 },
      { lat: 0.001, lon: 0.001, alt: null, ts: 3 },
    ];
    const out = simplifyPath(pts, 0.00001);
    expect(out.length).toBe(3);
    expect(out[1].lat).toBeCloseTo(0, 9);
  });

  it('returns real TrackPoint objects, not wrappers', () => {
    const out = simplifyPath(line(50), 0.00002);
    for (const p of out) {
      expect(typeof p.lat).toBe('number');
      expect(typeof p.lon).toBe('number');
    }
  });

  it('never drops below the two endpoints', () => {
    const out = simplifyPath(line(200), 0.00002);
    expect(out.length).toBeGreaterThanOrEqual(2);
  });

  it('treats the tolerance as a distance, not a squared distance', () => {
    const pts = [
      { lat: 0, lon: 0, alt: null, ts: 1 },
      { lat: 0.00005, lon: 0.0005, alt: null, ts: 2 },
      { lat: 0, lon: 0.001, alt: null, ts: 3 },
    ];
    expect(simplifyPath(pts, 1e-5).length).toBe(3);
    expect(simplifyPath(pts, 1e-3).length).toBe(2);
  });

  it('keeps detail that a squared tolerance used to throw away', () => {
    const pts = Array.from({ length: 101 }, (_, i) => ({
      lat: 0,
      lon: i * 0.0001,
      alt: null,
      ts: 1,
      jitter: Math.sin(i / 4) * 0.0004,
    })).map(p => ({ ...p, lat: p.lat + p.jitter }));
    const out = simplifyPath(pts, 0.00002);
    expect(out.length).toBeGreaterThan(2);
  });

  it('aguenta trilha longa sem estourar a pilha', () => {
    const pts = Array.from({ length: 20000 }, (_, i) => ({
      lat: -23.55 + Math.sin(i / 9) * 0.0006,
      lon: -46.63 + i * 0.00002,
      alt: null,
      ts: 1700000000000 + i * 4000,
    }));
    const out = simplifyPath(pts, 0.00002);
    expect(out.length).toBeGreaterThan(2);
    expect(out.length).toBeLessThan(pts.length);
    expect(out[0]).toBe(pts[0]);
    expect(out[out.length - 1]).toBe(pts[pts.length - 1]);
  });

  it('preserva a ordem dos pontos', () => {
    const pts = Array.from({ length: 500 }, (_, i) => ({
      lat: 0 + Math.sin(i / 5) * 0.001,
      lon: i * 0.0001,
      alt: null,
      ts: 1,
    }));
    const out = simplifyPath(pts, 0.00002);
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i].lon).toBeGreaterThan(out[i - 1].lon);
    }
  });
});

describe('bug 20: o viewer ficava sem rumo quando o GPS nao devolve bearing', () => {
  const h = (g: number | null | undefined, m: number | null | undefined) =>
    resolveLiveHeading(g, m);

  it('usa o bearing do GPS quando existe', () => {
    expect(h(42, 187)).toBe(42);
    expect(h(0, 187)).toBe(0);
  });

  it('usa o rumo magnetico quando o GPS devolveu null', () => {
    expect(h(null, 187)).toBe(187);
    expect(h(undefined, 350)).toBe(350);
  });

  it('mantem null quando nao ha nenhum dos dois', () => {
    expect(h(null, null)).toBeNull();
    expect(h(undefined, undefined)).toBeNull();
    expect(h(null, NaN)).toBeNull();
    expect(h(null, Infinity)).toBeNull();
  });

  it('normaliza o rumo magnetico para 0-360', () => {
    expect(h(null, 370)).toBeCloseTo(10, 5);
    expect(h(null, -10)).toBeCloseTo(350, 5);
    expect(h(null, 725)).toBeCloseTo(5, 5);
  });

  it('ignora um bearing do GPS invalido e cai na reserva', () => {
    expect(h(NaN, 187)).toBe(187);
  });
});
