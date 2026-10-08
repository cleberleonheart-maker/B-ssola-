/**
 * Os ficheiros em `scripts/*.sql` são a única cópia do schema do Supabase, e
 * durante onze dias ninguém reparou que o `rls.sql` não corria: tinha
 * ` melting scope` dentro de um `create table`, e `oria persistente da
 * assistente` solto no meio de um cabeçalho. O ficheiro era lixo e mesmo assim
 * parecia documentação — que é o pior estado em que um ficheiro de schema pode
 * estar, porque deixa de ser um programa e passa a ser uma promessa.
 *
 * Isto corre cada ficheiro duas vezes contra um Postgres a sério (PGlite, o
 * motor em WASM). Duas, porque o cabeçalho de todos eles promete idempotência e
 * o que interessa no dia a seguir a uma aplicação é a segunda.
 *
 * Não chega a correr: no fim pergunta ao catálogo se os objectos de que o app e
 * a página web do rastreio dependem existem mesmo. Um ficheiro que corre e não
 * cria o que promete passaria num teste que só olhasse para o código de saída —
 * e foi exactamente assim que a `get_live_status` passou: corre, e não criou
 * nada.
 *
 * Corre no `pretest` (ver package.json) e portanto em cada `npm test` e em cada
 * build do CI. Não é um teste do Jest porque o PGlite se carrega com `import()`
 * dinâmico do seu próprio wasm, e dentro do ambiente do Jest isso rebenta
 * (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`) — foi por isso que isto é um
 * script e não `__tests__/sqlScripts.test.ts`.
 *
 *   node scripts/verificar-sql.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const SQL_DIR = join(dirname(fileURLToPath(import.meta.url)));

/** A ordem importa: `live_points.sql` dá `get_live_track` e a tabela de que a
 *  `live_rls.sql` não sabe que existem. Correr o directório por ordem
 *  alfabética seria correr na sorte. */
const FICHEIROS = [
  'rls.sql',
  'live_rls.sql',
  'live_points.sql',
  'app_version.sql',
  'app_version_sha.sql',
  'crashes.sql',
  'account_delete.sql',
];

/** O que o `cloud.ts` toca, e o que o `web/live.html` chama sem login.
 *  Das funções comparo a assinatura com o nome do argumento (`p_token`), e não
 *  só o tipo: o PostgREST casa por nome, portanto um argumento renomeado no SQL
 *  e no `live.html` desemparelhados dão 404 em produção sem erro nenhum no
 *  repositório — que é o que o `verificar-nuvem.sh` vê. */
const TABELAS = [
  'app_version',
  'live_shares',
  'live_points',
  'virgin_memory',
  'tracks',
  'notes',
  'crashes',
];
const FUNCOES = [
  'get_live_position(p_token text)',
  'get_live_status(p_token text)',
  'get_live_track(p_token text, p_after bigint)',
  'delete_my_account()',
];

const falhas = [];
const ok = [];

const db = await PGlite.create();

// O que o Supabase traz e o Postgres não: o schema `auth` (as políticas de RLS
// comparam `user_id` com `auth.uid()`) e as três roles. Sem este stub o
// ficheiro nem é o mesmo que o dono vai colar no SQL Editor.
await db.exec(`
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
`);

// Um .sql novo que ninguém Acrescentou à lista acima passaria sem nunca ser
// corrido — que é a forma mais fácil de um teste mentir.
const noDisco = readdirSync(SQL_DIR).filter(f => f.endsWith('.sql')).sort();
const conhecidos = [...FICHEIROS].sort();
if (noDisco.join() !== conhecidos.join()) {
  falhas.push(
    `scripts/ tem ${noDisco.join(', ')} e a lista do verificar-sql tem ${conhecidos.join(', ')}.\n` +
      '        Um .sql novo que não esteja na lista nunca é corrido.',
  );
} else {
  ok.push(`a lista de ficheiros cobre os ${noDisco.length} .sql de scripts/`);
}

for (const ficheiro of FICHEIROS) {
  const sql = readFileSync(join(SQL_DIR, ficheiro), 'utf8');
  try {
    // A primeira passagem é a que cria; a segunda é a que um dia real de
    // republicação vai fazer, e é a que rebenta se alguém pôs `create table`
    // sem `if not exists` a meio.
    await db.exec(sql);
    await db.exec(sql);
    ok.push(`${ficheiro} corre, e corre outra vez`);
  } catch (e) {
    const frase = String(e?.message ?? e).split('\n')[0];
    falhas.push(`${ficheiro} não corre: ${frase}`);
  }
}

const { rows: tabelas } = await db.query(
  `select tablename as tabela from pg_tables where schemaname = 'public'`,
);
for (const tabela of TABELAS) {
  if (tabelas.some(t => t.tabela === tabela)) ok.push(`tabela ${tabela}`);
  else falhas.push(`a tabela ${tabela} não existe depois de correr os ficheiros`);
}

const { rows: funcoes } = await db.query(
  `select p.proname as nome,
          pg_get_function_identity_arguments(p.oid) as args
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'`,
);
const assinaturas = funcoes.map(f => `${f.nome}(${f.args})`);
for (const assinatura of FUNCOES) {
  if (assinaturas.includes(assinatura)) ok.push(`função ${assinatura}`);
  else falhas.push(`a função ${assinatura} não existe — quem a chama leva 404 do PostgREST`);
}

const { rows: colunas } = await db.query(
  `select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'app_version'`,
);
if (colunas.some(c => c.column_name === 'apk_sha256')) ok.push('coluna app_version.apk_sha256');
else falhas.push('app_version.apk_sha256 não existe — o CI publicaria o update sem a segunda fonte do hash');

// O `anon` lê `app_version` (é público de propósito: é o que faz o app saber que
// há update). Nas outras, uma política de leitura para o `anon` ou para todos
// que não mencione `auth.uid()` seria a mesma coisa que publicar a tabela — e
// nenhuma delas tem, o que é o estado certo e vale dizer em voz alta.
const { rows: politicas } = await db.query(
  `select tablename as tabela, cmd, roles, qual
     from pg_policies
    where schemaname = 'public' and cmd = 'SELECT' and 'anon' = any(roles)`,
);
for (const tabela of TABELAS) {
  const doAnon = politicas.filter(p => p.tabela === tabela);
  if (tabela === 'app_version') {
    if (doAnon.length === 0) {
      falhas.push('app_version não é legível pelo anon — o app nunca descobre que há update');
    } else {
      ok.push('app_version é legível pelo anon (de propósito)');
    }
    continue;
  }
  for (const p of doAnon) {
    if (!/auth\.uid\(\)/.test(p.qual ?? '')) {
      falhas.push(
        `${tabela} tem política de SELECT para o anon sem auth.uid(): ` +
          'quem tiver a app lê as linhas dos outros',
      );
    } else {
      ok.push(`${tabela}: o anon só lê o que é dele`);
    }
  }
  if (doAnon.length === 0) {
    ok.push(`${tabela}: sem política de SELECT para o anon (quem não tem sessão não lê nada)`);
  }
}

// Escrever é a outra metade, e o SELECT de cima não a apanha. Uma tabela sem
// política de INSERT é um 42501 em produção; uma política de INSERT sem
// `auth.uid()` é pior — é qualquer pessoa a escrever linhas em nome de outra.
// Nenhum dos dois dá sinal no repositório: o `cloud.ts` vê um erro numa escrita
// que devia ter funcionado, e foi o que aconteceu com o `rls.sql`.
const { rows: comUserId } = await db.query(
  `select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'user_id'`,
);
const { rows: inserts } = await db.query(
  `select tablename as tabela, with_check from pg_policies
    where schemaname = 'public' and cmd = 'INSERT'`,
);
for (const { table_name: tabela } of comUserId) {
  const doTabela = inserts.filter(p => p.tabela === tabela);
  if (doTabela.length === 0) {
    falhas.push(
      `${tabela} tem coluna user_id mas nenhuma política de INSERT — ` +
        'toda escrita do app leva 42501 e o relatório nunca chega ao sítio',
    );
    continue;
  }
  for (const p of doTabela) {
    if (/auth\.uid\(\)/.test(p.with_check ?? '')) {
      ok.push(`${tabela}: só se escreve por conta própria (INSERT com auth.uid())`);
    } else {
      falhas.push(
        `${tabela} tem política de INSERT sem auth.uid(): ` +
          'quem tiver a app escreve linhas em nome de outra',
      );
    }
  }
}

for (const linha of ok) console.log(`  ok    ${linha}`);
for (const linha of falhas) console.log(`  FALHA ${linha}`);
console.log();

await db.close();

if (falhas.length > 0) {
  console.error(`${falhas.length} problema(s) em scripts/*.sql.`);
  process.exit(1);
}
console.log(`scripts/*.sql: ${ok.length} verificações, tudo como prometeram.`);
