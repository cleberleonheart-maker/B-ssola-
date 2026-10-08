import fs from 'fs';
import path from 'path';

/**
 * O `compileDebugKotlin` garante que o `LiveTrackingService` compila, e isso é
 * tudo. O caminho que ninguém vê — o serviço a assumir o push quando o processo
 * morre — só falha em produção, e falha em silêncio das duas maneiras:
 *
 *   - `pushLivePosition` e `pushLivePoint` devolvem só um booleano e não
 *     lançam. Um payload com uma coluna errada dá 400 do PostgREST, o `post()`
 *     escreve um `Log.w` e devolve false. Quem vê é quem está a ser seguido: o
 *     link congela a meio de uma emergência, sem mensagem.
 *   - `START_REDELIVER_INTENT` reentrega o Intent original. Se um dos seis
 *     extras não voltar, `readLiveSession` devolve null, o serviço faz `stopSelf`
 *     e ninguém vê nada — pior: o JS continua a enviar e o link fica parado.
 *
 * Nenhum dos dois é um problema de Kotlin. São contratos entre ficheiros que
 * só o TypeScript não atravessa, porque o `ReadableMap` e o `Intent` não têm
 * tipo do lado de lá:
 *
 *   - as chaves do payload (`LiveTrackingSession.kt`) têm de existir como
 *     colunas nas tabelas (`scripts/live_rls.sql`, `scripts/live_points.sql`) —
 *     renomear uma coluna de um lado só dá 400 em produção;
 *   - as seis credenciais que `writeTo` grava no Intent têm de ser as mesmas
 *     seis que `readLiveSession` vai buscar;
 *   - as chaves que `liveTracking.ts` manda no `config` têm de ser as mesmas que
 *     `liveSessionConfig` lê do `ReadableMap`.
 *
 * Cada comparação tira as duas pontas dos ficheiros reais em vez de as
 * reescrever aqui: uma lista escrita à mão neste teste seria uma terceira
 * cópia, e divergiria sem ninguém dar por isso — que é o defeito exacto que o
 * `liveHeadingParity` já foi escrito para apanhar.
 */

const RAIZ = path.join(__dirname, '..');
const KOTLIN_DIR = path.join(RAIZ, 'android', 'app', 'src', 'main', 'java', 'com', 'bussola', 'app');
const SQL_DIR = path.join(RAIZ, 'scripts');

const ler = (p: string) => fs.readFileSync(p, 'utf8');

const kotlinSession = ler(path.join(KOTLIN_DIR, 'LiveTrackingSession.kt'));
const kotlinModule = ler(path.join(KOTLIN_DIR, 'LiveTrackingModule.kt'));
const jsTracking = ler(path.join(RAIZ, 'src', 'services', 'liveTracking.ts'));

/**
 * O corpo de uma função ou método do Kotlin até ao fim da sua expressão.
 *
 * Devolve null quando o padrão não bate, e quem chama tem de falhar com essa
 * informação: um extrator que devolve `''` em silêncio transformaria uma
 * mudança de forma do ficheiro num teste que passa por não ter nada para ver.
 */
const corpoKotlin = (fonte: string, assinatura: RegExp, ate: RegExp): string | null => {
  const inicio = fonte.search(assinatura);
  if (inicio < 0) return null;
  const resto = fonte.slice(inicio);
  const limite = resto.search(ate);
  return limite < 0 ? null : resto.slice(0, limite);
};

/** As chaves que um `payload`/`pointPayload` põe no corpo JSON. */
const chavesDoPayload = (nome: string): string[] => {
  const corpo = corpoKotlin(
    kotlinSession,
    new RegExp('fun ' + nome + '\\('),
    /\n  \}/, // fecha no fim do método (dois espaços de indentação)
  );
  if (corpo === null) {
    throw new Error(
      `LiveTrackingSession.kt: não encontrei o corpo de "${nome}". ` +
        'A extracção deste teste já não acompanha o ficheiro — e um extractor ' +
        'que devolve vazio faz este teste passar sem estar a ver nada.',
    );
  }
  const chaves = [...corpo.matchAll(/\.put\("([^"]+)"/g)].map(m => m[1]);
  if (chaves.length === 0) {
    throw new Error(`"${nome}" não põe nenhuma chave: o parser deixou de ver o JSONObject()`);
  }
  return chaves;
};

/** Colunas de um `create table if not exists` do `scripts/*.sql`. */
type Coluna = { nome: string; notNull: boolean; obrigatoria: boolean };

const colunasDe = (ficheiro: string, tabela: string): Coluna[] => {
  const sql = ler(path.join(SQL_DIR, ficheiro));
  const corpo = sql.match(
    new RegExp(`create table if not exists public\\.${tabela}\\s*\\(([\\s\\S]*?)\\n\\);`),
  );
  if (!corpo) {
    throw new Error(`${ficheiro}: não encontrei o create table de ${tabela}`);
  }
  return corpo[1]
    .split('\n')
    .map(linha => linha.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .filter(linha => !/^(constraint|primary key|unique|check|foreign key)\b/i.test(linha))
    .map(linha => {
      const nome = linha.split(/\s+/)[0];
      const notNull = /not null/i.test(linha);
      // "Obrigatória" = `not null` sem `default` e sem `generated`. Uma coluna
      // com default não precisa de vir no payload — o Postgres preenche. Uma
      // `generated always as identity` também não, e no `live_points` essa é o
      // `id`, que é o que o viewer usa para pedir "o que há depois deste".
      //
      // `latitude`/`longitude` de `live_shares` são `not null default 0`: por
      // isso não são obrigatórias, e por isso o payload as manda na mesma — uma
      // posição sem coordenadas é pior do que um zero.
      const obrigatoria = notNull && !/\bdefault\b/i.test(linha) && !/generated/i.test(linha);
      return { nome, notNull, obrigatoria };
    });
};

/**
 * As chaves de um objecto literal do TypeScript, com o valor de cada uma.
 *
 * O `accessToken,` do `config` está em shorthand — sem `:` — porque a variável
 * local e o campo da credencial têm o mesmo nome. Um extractor que só aceite
 * `chave:` contava cinco chaves em vez de seis, e o contrato passava a provar
 * menos do que parece: faltava exactamente a credencial do JWT.
 *
 * Os valores também interessam. Um `accessToken: null` e um `accessToken,` têm
 * o mesmo nome de chave, portanto uma comparação só de nomes passa — e em
 * produção isso é pior do que uma coluna renomeada: `getString` devolve null,
 * o `?: ""` no Kotlin transforma em vazio, `isUsable()` falha, o serviço faz
 * `stopSelf` e o link fica parado sem mensagem. Foi a mutação que adivinhou
 * mal que expôs isto, na confiança de que o teste apanhava mais do que apanha.
 */
const paresDoObjecto = (fonte: string): { chave: string; valor: string }[] => {
  const corpo = fonte.match(/const config: NativeTrackingConfig = \{([\s\S]*?)\n  \};/);
  if (!corpo) {
    throw new Error(
      'liveTracking.ts: não encontrei o objecto `config`. A extracção deste ' +
        'teste já não acompanha o ficheiro.',
    );
  }
  return corpo[1]
    .split('\n')
    .map(linha => linha.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .map(linha => {
      const partes = linha.replace(/,$/, '').split(':');
      return {
        chave: partes[0].trim(),
        valor: partes.length > 1 ? partes.slice(1).join(':').trim() : partes[0].trim(),
      };
    })
    .filter(p => /^\w+$/.test(p.chave));
};

const chavesDoObjecto = (fonte: string): string[] => paresDoObjecto(fonte).map(p => p.chave);

const iguais = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();

describe('o payload que o serviço nativo envia', () => {
  const liveShares = colunasDe('live_rls.sql', 'live_shares');
  const livePoints = colunasDe('live_points.sql', 'live_points');

  it('pushLivePosition só manda chaves que são colunas de live_shares', () => {
    const colunas = liveShares.map(c => c.nome);
    const chaves = chavesDoPayload('payload');
    for (const chave of chaves) {
      expect(colunas).toContain(chave);
    }
    expect(chaves.length).toBeGreaterThanOrEqual(9);
  });

  it('pushLivePoint só manda chaves que são colunas de live_points', () => {
    const colunas = livePoints.map(c => c.nome);
    const chaves = chavesDoPayload('pointPayload');
    for (const chave of chaves) {
      expect(colunas).toContain(chave);
    }
  });

  it('a posição manda tudo o que live_shares exige sem default', () => {
    // A coluna que o Kotlin não manda e o `started_at`, que tem `default now()`
    // e que o `Prefer: resolution=merge-duplicates` faz ficar na do primeiro
    // insert. Se alguém tirar o default, tem de aparecer aqui a falhar.
    const exigidas = liveShares.filter(c => c.obrigatoria).map(c => c.nome);
    const chaves = chavesDoPayload('payload');
    for (const coluna of exigidas) {
      expect(chaves).toContain(coluna);
    }
  });

  it('o ponto do trajecto manda tudo o que live_points exige sem default', () => {
    const exigidas = livePoints.filter(c => c.obrigatoria).map(c => c.nome);
    const chaves = chavesDoPayload('pointPayload');
    for (const coluna of exigidas) {
      expect(chaves).toContain(coluna);
    }
  });

  it('o ponto do trajecto não manda recorded_at: o id é o que o viewer usa', () => {
    // Está escrito no próprio `pointPayload` e no `live_points.sql` — e é a
    // diferença entre uma sessão inteira desenhada e um link que salta pontos ou
    // repete o último.
    expect(chavesDoPayload('pointPayload')).not.toContain('recorded_at');
  });

  it('a bateria do serviço vai nos dois payloads e existe nas duas tabelas', () => {
    // A bateria (ideia #103) só nasce no Kotlin, e um payload com uma coluna que
    // a tabela não tem dá 400 do PostgREST em silêncio — a falha é um link que
    // congela. O caminho oposto, uma coluna que ninguém envia, também passa
    // despercebido: o viewer fica sem a % para sempre.
    const chavesPosicao = chavesDoPayload('payload');
    const chavesPonto = chavesDoPayload('pointPayload');
    expect(chavesPosicao).toContain('battery_level');
    expect(chavesPonto).toContain('battery_level');
    expect(liveShares.map(c => c.nome)).toContain('battery_level');
    expect(livePoints.map(c => c.nome)).toContain('battery_level');
  });

  it('as duas tabelas proíbem coordenadas nulas', () => {
    // O único dado que o app não pode perder. Um `null` aqui sai como
    // `JSONObject.NULL` e o Postgres rejeita com 23502 — a mesma classe de erro
    // que matou o `rls.sql` quando o CI passou a correr os ficheiros na nuvem.
    // Em `live_shares` a coluna tem `default 0`, por isso o teste acima não a
    // conta como obrigatória: continua a ser `not null`, e é isso que se quer.
    for (const colunas of [liveShares, livePoints]) {
      for (const nome of ['latitude', 'longitude']) {
        expect(colunas.find(c => c.nome === nome)?.notNull).toBe(true);
      }
    }
  });
});

describe('o Intent que o START_REDELIVER_INTENT reentrega', () => {
  const escritos = [...kotlinSession.matchAll(/putExtra\(LiveTracking\.(EXTRA_\w+),/g)].map(
    m => m[1],
  );
  const lidos = [...kotlinSession.matchAll(/get(?:String|Long)Extra\(LiveTracking\.(EXTRA_\w+)/g)].map(
    m => m[1],
  );

  it('o que writeTo grava e o que readLiveSession vai buscar é o mesmo', () => {
    expect(escritos.length).toBe(6);
    expect(iguais(escritos, lidos)).toBe(true);
  });

  it('o prazo é lido como número, não como texto', () => {
    // `getStringExtra` sobre um `putExtra` de Long dá null, o `expiresAt` fica a
    // 0, `isUsable()` falha e o serviço faz `stopSelf` — um Intent entregue
    // correctamente que mesmo assim não sobe.
    const chavesComoTexto = [
      ...kotlinSession.matchAll(/getStringExtra\(LiveTracking\.(EXTRA_\w+)\)/g),
    ].map(m => m[1]);
    expect(chavesComoTexto).not.toContain('EXTRA_EXPIRES_AT');
    // O `, 0L` do default é o que distingue este do outro: sem ele o nome da
    // constante não aparecia e o teste passava sem estar a ver nada.
    const chavesComoNumero = [
      ...kotlinSession.matchAll(/getLongExtra\(LiveTracking\.(EXTRA_\w+),\s*0L\)/g),
    ].map(m => m[1]);
    expect(chavesComoNumero).toEqual(['EXTRA_EXPIRES_AT']);
  });

  it('todas as constantes EXTRA_ que o serviço declara são usadas', () => {
    // Uma constante nova declarada em `LiveTracking` e nunca lida nem escrita é
    // a forma mais barata de alguém se enganar a achar que a credencial vai no
    // Intent.
    const declaradas = [...kotlinModule.matchAll(/const val (EXTRA_\w+)/g)].map(m => m[1]);
    expect(declaradas.length).toBeGreaterThanOrEqual(6);
    for (const constante of declaradas) {
      const usadaEmAlgumSitio = new RegExp(constante).test(kotlinSession);
      expect({ constante, usada: usadaEmAlgumSitio }).toEqual({ constante, usada: true });
    }
  });

  it('o serviço devolve START_REDELIVER_INTENT, e não STICKY', () => {
    // Com `STICKY` o Intent chega nulo quando o Android recria o processo e o
    // serviço sobe sem token, sem credencial e sem prazo — ou seja, não sobe.
    const corpo = corpoKotlin(
      kotlinSession,
      /fun pushLivePosition\(/,
      /\n\}/,
    );
    expect(corpo).not.toBeNull();
    const servico = ler(path.join(KOTLIN_DIR, 'LiveTrackingModule.kt'));
    expect(servico).toMatch(/return START_REDELIVER_INTENT/);
    expect(servico).not.toMatch(/return START_STICKY/);
  });
});

describe('a ponte do JavaScript para o serviço', () => {
  const lidasDoMap = [
    ...kotlinSession.matchAll(/m\.get(?:String|Double|Int|Boolean)\("([^"]+)"/g),
  ].map(m => m[1]);
  const lidasDoMapMaisHasKey = [
    ...new Set([...lidasDoMap, ...[...kotlinSession.matchAll(/m\.hasKey\("([^"]+)"/g)].map(m => m[1])]),
  ];

  it('o config que o JS monta tem as chaves que o Kotlin lê do ReadableMap', () => {
    const mandadas = chavesDoObjecto(jsTracking);
    expect(mandadas.length).toBe(6);
    expect(iguais(mandadas, lidasDoMapMaisHasKey)).toBe(true);
  });

  it('o tipo NativeTrackingConfig declara o mesmo que o objecto monta', () => {
    // `NativeTrackingConfig` é o que documenta a ponte; o objecto `config` é o
    // que a cumpre. Se o tipo ganhar um campo e o objecto não, o TypeScript
    // deixa passar (o objecto é o que tem de ter todos) e o Kotlin recebe um
    // `ReadableMap` sem a chave.
    const tipo = jsTracking.match(/type NativeTrackingConfig = \{([\s\S]*?)\n\};/);
    if (!tipo) throw new Error('liveTracking.ts: não encontrei NativeTrackingConfig');
    const declaradas = [...tipo[1].matchAll(/^\s*(\w+)\??:/gm)].map(m => m[1]);
    expect(declaradas.length).toBe(6);
    expect(iguais(declaradas, chavesDoObjecto(jsTracking))).toBe(true);
  });

  it('o isUsable do Kotlin não pede nada que o JS não mande', () => {
    // Um campo que `isUsable()` exige e o JS não manda dá `cfg == null`, o
    // serviço faz `stopSelf`, e o `startLiveTracking` devolve owner 'js' — que
    // é a degradação silenciosa que o aviso de permissão cobre mas não explica.
    // As cinco credenciais de texto e o prazo: o `isUsable` é o único sítio que
    // decide se o serviço sobe, e ele espreita campos por nome.
    const usavel = kotlinSession.match(/fun isUsable\(\): Boolean =([\s\S]*?)\n\n  fun writeTo/);
    if (!usavel) throw new Error('LiveTrackingSession.kt: não encontrei isUsable');
    const camposObrigatorios = ['token', 'userId', 'accessToken', 'anonKey', 'url', 'expiresAt'];
    const mandadas = chavesDoObjecto(jsTracking);
    for (const campo of camposObrigatorios) {
      // O nome tem de aparecer no `isUsable` *e* no objecto do JS: um dos dois
      // lados a faltar é um `cfg == null` garantido em produção.
      expect(usavel[1]).toContain(campo);
      expect(mandadas).toContain(campo);
    }
    expect(usavel[1]).toContain('url.startsWith("https://")');
  });

  it('nenhuma credencial do config pode ser null, undefined ou uma cadeia vazia', () => {
    // O `getString(...) ?: ""` do Kotlin transforma qualquer coisa que não seja
    // texto em vazio, e o `isUsable` deita fora a sessão. Do lado do JS os
    // valores chegam de fontes que devolvem `null` na boa: `getCloudAccessToken`
    // tem um `.catch(() => null)` e o `cloudEndpoint()` devolve `null` com a
    // cloud desligada. O guarda-corpo existe (`if (!endpoint || !accessToken)`),
    // mas é uma linha acima do objecto, e o objecto é o que manda.
    const nulos = new Set(['null', 'undefined', "''", '""', 'null!', 'undefined!']);
    for (const { chave, valor } of paresDoObjecto(jsTracking)) {
      expect({ chave, valor, aceitavel: !nulos.has(valor) }).toEqual({
        chave,
        valor,
        aceitavel: true,
      });
    }
  });

  it('cada credencial vem de uma fonte que o próprio ficheiro garante não nula', () => {
    // Não basta o valor não ser `null` na linha: tem de vir de uma chamada que
    // devolve `string`. `token`/`userId` vêm do `req` (o `LiveTrackingRequest`),
    // `accessToken` de um `await ... .catch(() => null)` já guardado em
    // variável, e `url`/`anonKey` de um `endpoint` que o guarda-corpo acima
    // testou. Cada um destes nomes tem de existir no ficheiro — se alguém
    // trocar `accessToken` por `getCloudAccessToken()` directo no objecto, o
    // `.catch` desaparece e o valor chega ao Kotlin sem ninguém o ter visto.
    const valores = paresDoObjecto(jsTracking).map(p => p.valor);
    const fontes = new Set<string>();
    for (const valor of valores) {
      // `endpoint.url` -> `endpoint`; `accessToken` -> `accessToken`; `req.x` -> `req`.
      const base = valor.split('.')[0];
      expect(base.length).toBeGreaterThan(0);
      fontes.add(base);
    }
    for (const base of fontes) {
      // Ou é uma variável que existe no ficheiro, ou `req`, que é o parametro.
      const declarada =
        base === 'req' || new RegExp(`(const|let)\\s+${base}\\b`).test(jsTracking);
      expect({ base, declarada }).toEqual({ base, declarada: true });
    }
    // E o guarda-corpo tem de estar *antes* do objecto: um `if` depois do
    // `config` já não protege o `config`.
    const guarda = jsTracking.indexOf('if (!endpoint || !accessToken)');
    const objecto = jsTracking.indexOf('const config: NativeTrackingConfig');
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(objecto);
  });
});
