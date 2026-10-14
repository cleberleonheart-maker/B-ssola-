import {
  buildCommandCatalog,
  levenshtein,
  similarity,
  suggestCommand,
  SUGGEST_THRESHOLD,
  type CommandEntry,
} from '../src/assistant/suggest';
import { skillCatalog } from '../src/assistant/skills';
import { KeferaEngine } from '../src/assistant/engine';
import { normalizeText } from '../src/assistant/normalizer';

// `loadMemory` fala com a nuvem; aqui só queremos o motor local, então o
// módulo de nuvem é neutralizado para não pendurar o `init()` na rede.
jest.mock('../src/services/cloud', () => ({
  ensureCloudUser: jest.fn(async () => null),
  fetchCloudMemory: jest.fn(async () => null),
  pushCloudMemory: jest.fn(async () => undefined),
}));

describe('levenshtein', () => {
  it('mede a distância de edição clássica', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('casa', 'caza')).toBe(1);
  });

  it('é simétrica', () => {
    expect(levenshtein('trilha', 'triba')).toBe(levenshtein('triba', 'trilha'));
  });
});

describe('similarity', () => {
  it('vale 1 para textos idênticos', () => {
    expect(similarity('que horas sao', 'que horas sao')).toBe(1);
  });

  it('aproxima erros pequenos e afasta frases sem relação', () => {
    const perto = similarity('que horas sao', 'que hora sao');
    const longe = similarity('que horas sao', 'capital da franca');
    expect(perto).toBeGreaterThan(SUGGEST_THRESHOLD);
    expect(longe).toBeLessThan(SUGGEST_THRESHOLD);
    expect(perto).toBeGreaterThan(longe);
  });
});

describe('buildCommandCatalog', () => {
  it('descarta padrões abertos (com curinga ou escolha)', () => {
    const catalog = buildCommandCatalog([
      { id: 'm', patterns: ['muda para ...', '* piada', 'que horas', 'modo {a|b}'] },
    ]);
    expect(catalog.map(e => e.normalized)).toEqual(['que horas']);
  });

  it('remove duplicados normalizados e guarda a primeira ocorrência', () => {
    const catalog = buildCommandCatalog([
      { id: 'a', patterns: ['Bom Dia'] },
      { id: 'b', patterns: ['bom dia'] },
    ]);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].skillId).toBe('a');
    expect(catalog[0].display).toBe('Bom Dia');
  });

  it('apresenta a sugestão com a primeira letra maiúscula', () => {
    const catalog = buildCommandCatalog([{ id: 'x', patterns: ['que horas sao'] }]);
    expect(catalog[0].display).toBe('Que horas sao');
    expect(catalog[0].normalized).toBe('que horas sao');
  });
});

describe('suggestCommand', () => {
  const catalog: CommandEntry[] = buildCommandCatalog([
    { id: 'time', patterns: ['que horas sao'] },
    { id: 'greeting', patterns: ['bom dia', 'oi'] },
    { id: 'joke', patterns: ['conte uma piada'] },
  ]);

  it('sugere o comando mais próximo de um quase-acerto', () => {
    expect(suggestCommand('que hora e', catalog)?.skillId).toBe('time');
    expect(suggestCommand('conte uma piada', catalog)?.skillId).toBe('joke');
  });

  it('devolve null quando nada está perto o bastante', () => {
    expect(suggestCommand('qual a capital da franca', catalog)).toBeNull();
    expect(suggestCommand('xyzzy plugh', catalog)).toBeNull();
  });

  it('devolve null para entrada vazia ou catálogo vazio', () => {
    expect(suggestCommand('', catalog)).toBeNull();
    expect(suggestCommand('   ', catalog)).toBeNull();
    expect(suggestCommand('que hora e', [])).toBeNull();
  });

  it('respeita o limiar informado', () => {
    // um limiar impossível nunca sugere, mesmo para um quase-acerto
    expect(suggestCommand('que hora e', catalog, 0.999)).toBeNull();
  });

  it('inclui a pontuação no resultado', () => {
    const hit = suggestCommand('que hora e', catalog);
    expect(hit?.score).toBeGreaterThanOrEqual(SUGGEST_THRESHOLD);
    expect(hit?.score).toBeLessThanOrEqual(1);
  });
});

describe('catálogo real dos skills', () => {
  it('só contém comandos concretos', () => {
    for (const entry of skillCatalog) {
      expect(entry.normalized.length).toBeGreaterThan(0);
      expect(entry.display.length).toBeGreaterThan(0);
      expect(entry.normalized).not.toContain('*');
      expect(entry.normalized).not.toContain('...');
      expect(entry.normalized).not.toContain('{');
    }
  });

  it('inclui comandos conhecidos com o skill certo', () => {
    const byNormalized = new Map(skillCatalog.map(e => [e.normalized, e.skillId]));
    expect(byNormalized.get(normalizeText('que horas sao'))).toBe('time');
    expect(byNormalized.get(normalizeText('bom dia'))).toBe('greeting');
  });
});

describe('segunda chance no motor', () => {
  it('oferece a alternativa quando o comando passa perto', async () => {
    const engine = new KeferaEngine();
    await engine.init();
    const res = await engine.handle('que hora e');
    expect(res.kind).toBe('help');
    expect(res.text).toMatch(/quis dizer/i);
    expect(res.text).toMatch(/que hora/i);
  });

  it('mantém o fallback genérico para ruído sem relação', async () => {
    const engine = new KeferaEngine();
    await engine.init();
    const res = await engine.handle('xyzzy plugh qwerty');
    expect(res.text).not.toMatch(/quis dizer/i);
  });

  it('não interfere nos comandos que já casam', async () => {
    const engine = new KeferaEngine();
    await engine.init();
    const res = await engine.handle('que horas sao');
    expect(res.kind).toBe('answer');
    expect(res.text).not.toMatch(/quis dizer/i);
  });
});
