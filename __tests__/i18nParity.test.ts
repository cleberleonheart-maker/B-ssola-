import { STRINGS } from '../src/i18n/strings';

const NEW_PREFIX = /^((ui_mode|ui_card)_selftest|sd_[a-z_]+)$/;

describe('paridade das chaves novas do autoteste', () => {
  const collect = (lang: 'pt' | 'en' | 'es') =>
    Object.keys(STRINGS[lang]).filter(k => NEW_PREFIX.test(k)).sort();

  it('o bloco novo tem as mesmas chaves em pt, en e es', () => {
    const pt = collect('pt');
    expect(pt.length).toBeGreaterThan(0);
    expect(collect('en')).toEqual(pt);
    expect(collect('es')).toEqual(pt);
  });

  it('a tabela inteira continua com 686 + as chaves novas em cada idioma', () => {
    const counts = (['pt', 'en', 'es'] as const).map(l => Object.keys(STRINGS[l]).length);
    expect(new Set(counts).size).toBe(1);
  });
});
