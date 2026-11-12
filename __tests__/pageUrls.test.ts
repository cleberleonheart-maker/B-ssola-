import fs from 'fs';
import path from 'path';

import { GPX_PAGE_URL, LIVE_PAGE_URL, SITE_BASE_URL } from '../src/services/pageUrls';

/**
 * O endereço das páginas é uma coisa só, escrita em dois lados.
 *
 * O link do rastreio ao vivo é montado em três sítios (o app, o cache nativo do
 * modo de assalto e o `live.html` que a serve) e o da trilha em mais dois. Uma
 * segunda cópia do endereço — seja em TypeScript, seja em Kotlin — diverge em
 * silêncio: o link partido só se vê quando alguém o abre, que é tarde demais
 * para quem estava a ser seguido.
 *
 * O Kotlin não tem cópia nenhuma: recebe a do JavaScript, pelo `SosPrefs`.
 * Estes testes verificam que essa promessa continua a ser verdadeira — a
 * regra é simples de cumprir e fácil de quebrar sem dar por isso.
 */

const RAIZ = path.join(__dirname, '..');
const SRC_DIR = path.join(RAIZ, 'src');
const KOTLIN_DIR = path.join(
  RAIZ,
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'bussola',
  'app',
);

const ler = (p: string) => fs.readFileSync(p, 'utf8');

/** Todos os ficheiros de código que podem conter um endereço. */
const ficheirosDeCodigo = (dir: string, ext: RegExp): string[] => {
  const out: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      out.push(...ficheirosDeCodigo(caminho, ext));
    } else if (ext.test(entrada.name)) {
      out.push(caminho);
    }
  }
  return out;
};

describe('os endereços das páginas', () => {
  it('as duas páginas saem da mesma base', () => {
    expect(LIVE_PAGE_URL.startsWith(SITE_BASE_URL)).toBe(true);
    expect(GPX_PAGE_URL.startsWith(SITE_BASE_URL)).toBe(true);
    expect(LIVE_PAGE_URL).not.toBe(GPX_PAGE_URL);
  });

  it('as páginas são as que o GitHub Pages serve', () => {
    expect(LIVE_PAGE_URL).toBe('https://cleberleonheart-maker.github.io/B-ssola-/live.html');
    expect(GPX_PAGE_URL).toBe('https://cleberleonheart-maker.github.io/B-ssola-/gpx.html');
  });

  it('o TypeScript só tem uma cópia do endereço', () => {
    // O `pageUrls.ts` é a fonte da verdade; qualquer outro ficheiro com o
    // host é uma segunda cópia a divergir.
    const comHost = ficheirosDeCodigo(SRC_DIR, /\.(ts|tsx|js|jsx)$/).filter(f =>
      ler(f).includes('cleberleonheart-maker.github.io'),
    );
    expect(comHost.map(f => path.relative(RAIZ, f))).toEqual([
      path.join('src', 'services', 'pageUrls.ts'),
    ]);
  });

  it('o Kotlin não tem cópia nenhuma do endereço', () => {
    // O nativo recebe a URL pelo `SosPrefs` (ver o teste seguinte): um
    // endereço escrito em Kotlin seria uma terceira cópia, e o único sítio
    // onde ninguém repara numa divergência.
    const comHost = ficheirosDeCodigo(KOTLIN_DIR, /\.kt$/).filter(f =>
      ler(f).includes('github.io'),
    );
    expect(comHost).toEqual([]);
  });

  it('o nativo tira a página do cache que o JavaScript escreve', () => {
    const sosCloud = ler(path.join(KOTLIN_DIR, 'SosCloud.kt'));
    expect(sosCloud).toContain('SosPrefs.livePageUrl(context)');
    expect(sosCloud).not.toContain('DEFAULT_PAGE_URL');
    // Sem a URL não há link — e o aviso sai na mesma, que é o que interessa.
    expect(sosCloud).toMatch(/if \(pageUrl\.isBlank\(\)\) return null/);
  });

  it('o JavaScript escreve sempre a página no cache do nativo', () => {
    // O `cacheCloud` grava a URL da página ao lado das credenciais: é o que
    // garante ao modo de assalto que a página do link é a mesma que o app
    // partilha.
    const cloud = ler(path.join(SRC_DIR, 'services', 'cloud.ts'));
    expect(cloud).toContain('livePageUrl: LIVE_PAGE_URL');

    const sosSender = ler(path.join(SRC_DIR, 'services', 'sosSender.ts'));
    expect(sosSender).toContain('creds.livePageUrl');
  });
});
