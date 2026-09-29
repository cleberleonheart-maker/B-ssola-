import { normalizeText } from './normalizer';

export type PatternEntry =
  | { type: 'word'; value: string }
  | { type: 'star' }
  | { type: 'ellipsis' }
  | { type: 'choice'; options: string[][] };

export type MatchResult = {
  matched: boolean;
  wildcards: string[];
};

export const parsePattern = (pattern: string): PatternEntry[] => {
  const entries: PatternEntry[] = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '{') {
      const end = pattern.indexOf('}', i);
      if (end === -1) {
        break;
      }
      const options = pattern
        .slice(i + 1, end)
        .split('|')
        .map(opt =>
          normalizeText(opt)
            .split(' ')
            .filter(Boolean),
        )
        .filter(opt => opt.length > 0);
      entries.push({ type: 'choice', options });
      i = end + 1;
      continue;
    }
    if (c === ' ') {
      i += 1;
      continue;
    }
    const start = i;
    while (i < pattern.length && pattern[i] !== ' ' && pattern[i] !== '{') {
      i += 1;
    }
    let token = pattern.slice(start, i);
    if (token === '...') {
      entries.push({ type: 'ellipsis' });
    } else if (token === '*') {
      entries.push({ type: 'star' });
    } else if (token) {
      entries.push({ type: 'word', value: normalizeText(token) });
    }
  }
  return entries;
};

const matchEntries = (
  entries: PatternEntry[],
  input: string[],
  pos: number,
  epos: number,
  wildcards: string[],
): { ok: boolean; wildcards: string[] } => {
  if (epos === entries.length) {
    return { ok: pos === input.length, wildcards };
  }
  const entry = entries[epos];

  if (entry.type === 'ellipsis') {
    for (let k = input.length; k >= pos; k -= 1) {
      const next = [...wildcards, input.slice(pos, k).join(' ')];
      const r = matchEntries(entries, input, k, epos + 1, next);
      if (r.ok) {
        return r;
      }
    }
    return { ok: false, wildcards };
  }

  if (entry.type === 'star') {
    // exige ao menos um token, exceto quando o curinga é o último item do
    // padrão ("quantas trilhas *"), onde casar vazio é o comportamento válido
    const minTokens = pos;
    for (let k = input.length; k >= minTokens; k -= 1) {
      const r = matchEntries(entries, input, k, epos + 1, wildcards);
      if (r.ok) {
        return r;
      }
    }
    return { ok: false, wildcards };
  }

  if (entry.type === 'word') {
    if (pos < input.length && input[pos] === entry.value) {
      return matchEntries(entries, input, pos + 1, epos + 1, wildcards);
    }
    return { ok: false, wildcards };
  }

  for (const option of entry.options) {
    let ok = true;
    for (let k = 0; k < option.length; k += 1) {
      if (pos + k >= input.length || input[pos + k] !== option[k]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const r = matchEntries(entries, input, pos + option.length, epos + 1, wildcards);
      if (r.ok) {
        return r;
      }
    }
  }
  return { ok: false, wildcards };
};

// ruído comum na fala ("por favor", "ei", "me diz") que não deve impedir um
// padrão de casar; removido das pontas antes do casamento
const FILLER = new Set([
  'por',
  'favor',
  'ei',
  'e',
  'olha',
  'ola',
  'hey',
  'me',
  'diz',
  'me diz',
  'me fala',
  'fala',
  'pra',
  'pro',
  'please',
  'ok',
  'entao',
  'agora',
]);

const stripFiller = (tokens: string[]): string[] => {
  let start = 0;
  let end = tokens.length;
  while (start < end && FILLER.has(tokens[start])) {
    start += 1;
  }
  while (end > start && FILLER.has(tokens[end - 1])) {
    end -= 1;
  }
  return tokens.slice(start, end);
};

export const matches = (
  pattern: string,
  normalizedInput: string,
  inputTokens: string[],
): MatchResult => {
  if (!normalizedInput) {
    return { matched: false, wildcards: [] };
  }
  const entries = parsePattern(pattern);
  const result = matchEntries(entries, inputTokens, 0, 0, []);
  if (result.ok) {
    return { matched: true, wildcards: result.wildcards };
  }
  const stripped = stripFiller(inputTokens);
  if (stripped.length === inputTokens.length) {
    return { matched: false, wildcards: [] };
  }
  const retry = matchEntries(entries, stripped, 0, 0, []);
  return { matched: retry.ok, wildcards: retry.wildcards };
};

export const phraseMatch = (
  pattern: string,
  normalizedInput: string,
  inputTokens: string[],
): MatchResult => matches(pattern, normalizedInput, inputTokens);