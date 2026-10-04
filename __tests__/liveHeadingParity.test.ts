import fs from 'fs';
import path from 'path';
import vm from 'vm';

import { resolveLiveHeading } from '../src/services/liveShareService';
import { normalizeHeading } from '../src/utils/compass';

/**
 * O rumo que vai para o link de rastreio é decidido em dois sítios:
 * `resolveLiveHeading` do JavaScript (`liveShareService.ts`), que manda o
 * primeiro fix da sessão, e o do Kotlin (`LiveTrackingSession.kt`), que passa a
 * mandar os seguintes quando o serviço assume.
 *
 * Duas cópias divergem em silêncio: o JavaScript continua a passar os testes, o
 * serviço continua a compilar, e a agulha no viewer dá um salto no instante em
 * que a troca acontece.
 *
 * O Kotlin não corre em Jest, e reescrevê-lo à mão no teste seria uma terceira
 * cópia, a pior das três: divergia sem ninguém dar por isso. O que se faz aqui
 * é transliterar o ficheiro real para JavaScript e correr as duas no mesmo
 * fixture. Cada passo da transliteração é conferido — se o Kotlin mudar de
 * forma e o padrão deixar de apanhar o código, o teste fica vermelho a pedir
 * atenção em vez de comparar duas coisas sem relação nenhuma.
 */

const KOTLIN_DIR = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'bussola',
  'app',
);

const kotlinSession = fs.readFileSync(path.join(KOTLIN_DIR, 'LiveTrackingSession.kt'), 'utf8');

/** `fun f(a: Double, b: Double?): Double? {` vira uma função de JS. */
const kotlinFunction = (nome: string): string => {
  const assinatura = new RegExp('fun ' + nome + '\\(([^)]*)\\)[^{]*\\{');
  const inicio = kotlinSession.search(assinatura);
  if (inicio < 0) {
    throw new Error(
      'LiveTrackingSession.kt: nao encontrei "fun ' +
        nome +
        '". A transliteracao deste teste ja nao acompanha o ficheiro.',
    );
  }
  const argumentos = kotlinSession
    .slice(inicio)
    .match(assinatura)![1]
    .split(',')
    .map(a => a.split(':')[0].trim())
    .filter(Boolean);

  // O corpo vai ate a chave no fim da linha, que e como estas duas funcoes
  // estao escritas: uma instrucao por linha, sem `when` nem lambdas.
  const corpo = kotlinSession.slice(kotlinSession.indexOf('{', inicio) + 1).split('\n}')[0];

  const js = corpo
    // `x.isFinite()` -> `Number.isFinite(x)`
    .replace(/([A-Za-z_$][\w$]*)\.isFinite\(\)/g, 'Number.isFinite($1)')
    // `val mag = magnetic ?: return null` -> o `if` que esta por tras
    .replace(
      /val (\w+) = (\w+) \?: return null/g,
      (_m, destino, fonte) =>
        'const ' +
        destino +
        ' = (' +
        fonte +
        ' == null) ? null : ' +
        fonte +
        ';\n  if (' +
        destino +
        ' == null) return null;',
    )
    .replace(/\bvar\b/g, 'let')
    .trim();

  // O que sobrar de Kotlin tem de ser erro: um `val` por traduzir chegar ao
  // `vm` e rebentar la dentro, ou pior, nao rebentar e comparar outra coisa.
  const sobrou = js.match(/\b(val|fun|when|else)\b|:\s*Double|\?\.|\?:/);
  if (sobrou) {
    throw new Error(
      'LiveTrackingSession.kt: sobrou sintaxe do Kotlin em ' +
        nome +
        ' ("' +
        sobrou[0] +
        '"). A transliteracao deste teste tem de ser actualizada antes de voltar a confiar nele.',
    );
  }

  return 'function ' + nome + '(' + argumentos.join(', ') + ') {\n' + js + '\n}';
};

type KotlinHeading = {
  resolveLiveHeading: (gps: number, magnetico: number | null) => number | null;
  normalizeDegrees: (v: number) => number | null;
};

const sandbox: { __kt?: KotlinHeading } = {};
vm.createContext(sandbox);
vm.runInContext(
  kotlinFunction('normalizeDegrees') +
    '\n' +
    kotlinFunction('resolveLiveHeading') +
    '\n__kt = { resolveLiveHeading: resolveLiveHeading, normalizeDegrees: normalizeDegrees };',
  sandbox,
);

const kt = sandbox.__kt!;
expect(typeof kt.resolveLiveHeading).toBe('function');

/**
 * "Não há bearing do GPS" não é a mesma coisa nos dois lados: o Kotlin recebe
 * `-1.0`, porque o parâmetro é `Double` e não anula (é o `LiveTrackingModule.kt`
 * que traduz o `hasBearing()` para o sentinel), e o JavaScript recebe `null`.
 * O fixture diz `gps: null` e cada lado recebe o seu.
 */
type Caso = { nome: string; gps: number | null; magnetico: number | null };

const CASOS: Caso[] = [
  { nome: 'bearing do GPS a meio do norte', gps: 42, magnetico: 187 },
  { nome: 'bearing do GPS a zero', gps: 0, magnetico: 187 },
  { nome: 'bearing do GPS quase a dar a volta', gps: 359.999, magnetico: null },
  { nome: 'bearing do GPS em 360, que e o norte de outra maneira', gps: 360, magnetico: 187 },
  { nome: 'bearing do GPS a dar a volta duas vezes', gps: 725, magnetico: null },
  { nome: 'bearing do GPS negativo, que e o sentinel do Android', gps: -1, magnetico: 187 },
  { nome: 'bearing do GPS negativo fora do sentinel', gps: -90, magnetico: 187 },
  { nome: 'sem bearing, com o magnetómetro a suprir', gps: null, magnetico: 187 },
  { nome: 'sem nada, o viewer fica sem rumo', gps: null, magnetico: null },
  { nome: 'bearing do GPS com NaN', gps: NaN, magnetico: 187 },
  { nome: 'magnetómetro com NaN', gps: null, magnetico: NaN },
  { nome: 'bearing do GPS infinito', gps: Infinity, magnetico: 90 },
  { nome: 'magnetómetro a dar a volta, para normalizar', gps: null, magnetico: 370 },
  { nome: 'magnetómetro negativo, que normaliza para o fim', gps: null, magnetico: -10 },
];

const rodar = (c: Pick<Caso, 'gps' | 'magnetico'>) => ({
  js: resolveLiveHeading(c.gps, c.magnetico),
  kt: kt.resolveLiveHeading(c.gps === null ? -1 : c.gps, c.magnetico),
});

describe('resolveLiveHeading — o JS e o Kotlin dão o mesmo rumo', () => {
  it.each(CASOS)('$nome', caso => {
    const { js, kt: nativo } = rodar(caso);

    if (nativo === null) {
      expect(js).toBeNull();
    } else {
      expect(js).not.toBeNull();
      expect(js).toBeCloseTo(nativo, 9);
    }
  });

  it('a reserva é a mesma nos dois, sem bearing e com magnetómetro', () => {
    // Fora da comparação principal porque o Kotlin só tem uma variável `magnetic`
    // e o JavaScript aceita `undefined` além de `null` — o `undefined` não tem
    // contraparte, mas tem de dar o mesmo resultado que `null`.
    expect(resolveLiveHeading(undefined, 187)).toBe(rodar({ gps: null, magnetico: 187 }).kt);
    expect(resolveLiveHeading(undefined, undefined)).toBeNull();
  });

  it('o normalizeDegrees do Kotlin é o normalizeHeading do app', () => {
    // O `resolveLiveHeading` do JS normaliza com o `normalizeHeading` de
    // `utils/compass.ts`; o do Kotlin tem o seu, que é a mesma aritmética
    // escrita outra vez. Esta é a comparação que fecha o círculo.
    for (const v of [0, 42, 359.9, 360, 370, 725, -10, -370]) {
      const kotlin = kt.normalizeDegrees(v)!;
      expect(kotlin).toBeCloseTo(normalizeHeading(v), 9);
      expect(kotlin).toBeGreaterThanOrEqual(0);
      expect(kotlin).toBeLessThan(360);
    }
    // O que não é ângulo não é rumo: os dois devolvem nada.
    expect(kt.normalizeDegrees(NaN)).toBeNull();
    expect(kt.normalizeDegrees(Infinity)).toBeNull();
  });

  it('o sentinel de "sem bearing" do Kotlin continua a ser -1.0', () => {
    // O fixture acima assume que o `LiveTrackingModule.kt` traduz `hasBearing()`
    // para -1.0. Se isso mudar, o fixture passa a mentir e a comparação passa a
    // dar verde por acidente.
    const modulo = fs.readFileSync(path.join(KOTLIN_DIR, 'LiveTrackingModule.kt'), 'utf8');
    expect(modulo).toMatch(/hasBearing\(\)\)\s*location\.bearing\.toDouble\(\)\s*else\s*-1\.0/);
  });
});
