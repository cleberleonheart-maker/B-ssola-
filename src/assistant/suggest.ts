import { normalizeText } from './normalizer';

/**
 * Segunda chance para comandos quase certos (ideia #67).
 *
 * O `matcher` é exato: ou o comando casa com um padrão, ou cai no fallback
 * genérico e a pessoa fica sem saber porquê. Um erro de uma sílaba ("que hora
 * e" em vez de "que horas sao") some no silêncio. Aqui comparamos o que foi dito
 * com um catálogo de comandos concretos e, se houver um vizinho próximo o
 * bastante, oferecemos essa alternativa em vez da resposta vazia de sempre.
 *
 * Tudo é puro e sem I/O — o motor chama isto só depois de falhar todos os
 * skills, e os testes cobrem a fronteira do limiar sem tocar em voz nem rede.
 */

export type CommandEntry = {
  /** Texto original do padrão, para mostrar na sugestão. */
  display: string;
  /** O mesmo padrão normalizado, para comparar. */
  normalized: string;
  skillId: string;
};

export type CommandSuggestion = {
  display: string;
  skillId: string;
  score: number;
};

/**
 * Só entram padrões "fechados": sem curingas (`*`, `...`) e sem escolhas
 * (`{a|b}`). Um padrão aberto como "abre ..." não é um comando que se possa
 * sugerir — falta-lhe o alvo — e sugerir um fragmento confundiria mais do que
 * ajudaria.
 */
const isConcrete = (pattern: string): boolean =>
  !pattern.includes('*') &&
  !pattern.includes('...') &&
  !pattern.includes('{');

export const buildCommandCatalog = (
  skills: { id: string; patterns: string[] }[],
): CommandEntry[] => {
  const out: CommandEntry[] = [];
  const seen = new Set<string>();
  for (const skill of skills) {
    for (const pattern of skill.patterns) {
      if (!isConcrete(pattern)) continue;
      const normalized = normalizeText(pattern);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      const display = pattern.trim();
      out.push({
        display: display.charAt(0).toUpperCase() + display.slice(1),
        normalized,
        skillId: skill.id,
      });
    }
  }
  return out;
};

/** Distância de edição clássica, iterativa e sem dependências. */
export const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev: number[] = new Array(n + 1);
  let curr: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;

  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j += 1) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
};

const tokensOf = (s: string): string[] => s.split(' ').filter(Boolean);

const jaccard = (a: string[], b: string[]): number => {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let shared = 0;
  for (const token of sa) {
    if (sb.has(token)) shared += 1;
  }
  const union = sa.size + sb.size - shared;
  return union === 0 ? 0 : shared / union;
};

/**
 * Semelhança entre 0 e 1 combinando edição por caractere (tolerante a erros de
 * transcrição) com a sobreposição de palavras (tolerante a ordem e a palavras
 * a mais). O peso maior fica na edição, que é o que pega o erro de uma letra.
 */
export const similarity = (a: string, b: string): number => {
  const maxLen = Math.max(a.length, b.length);
  const editScore = maxLen === 0 ? 1 : 1 - levenshtein(a, b) / maxLen;
  const tokenScore = jaccard(tokensOf(a), tokensOf(b));
  return 0.65 * editScore + 0.35 * tokenScore;
};

/**
 * Abaixo disto, é ruído: sugerir um comando qualquer para uma frase que nada
 * tem a ver seria pior do que o fallback. Calibrado com casos reais nos testes.
 */
export const SUGGEST_THRESHOLD = 0.5;

export const suggestCommand = (
  input: string,
  catalog: CommandEntry[],
  threshold = SUGGEST_THRESHOLD,
): CommandSuggestion | null => {
  const normalized = normalizeText(input);
  if (!normalized || catalog.length === 0) return null;

  let best: CommandSuggestion | null = null;
  for (const entry of catalog) {
    const score = similarity(normalized, entry.normalized);
    if (!best || score > best.score) {
      best = { display: entry.display, skillId: entry.skillId, score };
    }
  }
  if (!best || best.score < threshold) return null;
  return best;
};
