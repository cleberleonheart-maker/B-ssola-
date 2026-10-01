import fs from 'fs';
import path from 'path';
import { STRINGS } from '../src/i18n/strings';

const LANGS = ['pt', 'en', 'es'] as const;

/**
 * O teste antigo comparava só a *quantidade* de chaves: `new Set(counts).size
 * === 1`. Isso passa com uma chave faltando em `en` e uma sobrando em `es` — a
 * troca é invisível. Como o tradutor cai em `table[key] ?? ptTable[key] ??
 * key`, a falha também não aparece na tela: o usuário inglês vê português sem
 * nenhum aviso. Aqui a comparação é de conjunto de nomes, que é o que a
 * paridade significa.
 */
describe('paridade das tabelas de tradução', () => {
  const keys = (lang: (typeof LANGS)[number]) => Object.keys(STRINGS[lang]).sort();

  it('pt, en e es têm exatamente as mesmas chaves', () => {
    const pt = keys('pt');
    expect(pt.length).toBeGreaterThan(0);
    expect(keys('en')).toEqual(pt);
    expect(keys('es')).toEqual(pt);
  });

  it('nenhuma tabela tem chave sobrando em relação ao pt', () => {
    const pt = new Set(keys('pt'));
    for (const lang of LANGS) {
      const extra = keys(lang).filter(k => !pt.has(k));
      expect({ lang, extra }).toEqual({ lang, extra: [] });
    }
  });

  it('nenhuma tradução é string vazia', () => {
    for (const lang of LANGS) {
      const empty = Object.keys(STRINGS[lang])
        .filter(k => STRINGS[lang][k].trim().length === 0)
        .sort();
      expect({ lang, empty }).toEqual({ lang, empty: [] });
    }
  });

  /**
   * `{time}` em pt e `{tempo}` em es não quebram nenhuma das verificações
   * acima: as chaves batem e os textos não estão vazios. Mas o `{tempo}` no
   * espanhol nunca é substituído, e o usuário vê o placeholder cru na tela.
   */
  it('os mesmos placeholders {…} em todos os idiomas', () => {
    // Tolerante a `undefined` de propósito: se uma chave sumiu de `en`, o
    // teste de paridade acima já reprova. Aqui o objetivo é só listar os
    // placeholders divergentes, e um `TypeError` no meio esconderia a lista.
    const placeholders = (value: string | undefined) =>
      value === undefined ? null : (value.match(/\{(\w+)\}/g) ?? []).map(m => m.slice(1, -1)).sort();

    const divergent: { key: string; lang: string; expected: unknown; got: unknown }[] = [];
    for (const key of keys('pt')) {
      const expected = placeholders(STRINGS.pt[key]);
      for (const lang of LANGS) {
        const got = placeholders(STRINGS[lang][key]);
        if (JSON.stringify(got) !== JSON.stringify(expected)) {
          divergent.push({ key, lang, expected, got });
        }
      }
    }
    expect(divergent).toEqual([]);
  });
});

/**
 * Uma chave usada no código e ausente no pt é a falha mais cara das três: o
 * `t('ui_algo_que_nao_existe')` passa pelo TypeScript (o tradutor recebe
 * `string`), passa pelo teste de contagem e mostra a chave crua na tela. Varrer
 * `src/` é o que fecha isso.
 */
describe('chaves usadas no código existem no pt', () => {
  const SRC = path.join(__dirname, '..', 'src');

  const collectFiles = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFiles(full, out);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  };

  const files = collectFiles(SRC).filter(f => !f.endsWith(path.join('i18n', 'strings.ts')));

  const usedKeys = new Set<string>();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*'([a-z0-9_]+)'/g)) {
      usedKeys.add(match[1]);
    }
    for (const match of source.matchAll(/\bt\(\s*"([a-z0-9_]+)"/g)) {
      usedKeys.add(match[1]);
    }
  }

  it('a varredura encontrou chaves para conferir', () => {
    expect(usedKeys.size).toBeGreaterThan(50);
  });

  it('toda chave chamada no código está na tabela pt', () => {
    const missing = [...usedKeys].filter(k => !(k in STRINGS.pt)).sort();
    expect(missing).toEqual([]);
  });
});
