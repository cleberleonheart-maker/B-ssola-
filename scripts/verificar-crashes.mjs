/**
 * Prova que um crash consegue mesmo chegar à tabela `crashes` — e não é o que
 * os outros verificadores dizem.
 *
 * O `verificar-nuvem.sh` confirma que a tabela existe e que o `anon` a consegue
 * ler. Isso não prova nada sobre *escrever*, que é o que o reporter faz. Uma
 * tabela sem política de INSERT dá 42501; uma política sem `auth.uid()` deixa
 * qualquer pessoa escrever em nome de outra. As duas dão zero sinal no
 * repositório, e a segunda é silenciosa de uma forma feia: `pushCrashReport`
 * não lança, devolve falso, o reporter guarda o relatório e desiste ao fim de
 * três tentativas. Um erro de política de RLS transforma-se em silêncio, e a
 * app continua a funcionar toda.
 *
 * Por isso este script escreve. Uma linha, e apaga-a a seguir.
 *
 * Não entra no `pretest`: precisa de rede e escreve em produção. Corre-se à mão
 * quando se mexe em `crashes.sql`, em `cloud.ts`, ou depois de mexer nas
 * políticas. É a mesma ideia do `verificar-nuvem.sh`, com o corpo.
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const raiz = new URL('../', import.meta.url).pathname;
const cloudTs = readFileSync(`${raiz}src/services/cloud.ts`, 'utf8');
const sql = readFileSync(`${raiz}scripts/crashes.sql`, 'utf8');

const falhas = [];
const ok = [];

const campo = (re) => {
  const m = cloudTs.match(re);
  if (!m) throw new Error(`não encontrei ${re} em cloud.ts`);
  return m[1];
};

const url = campo(/const SUPABASE_URL: string = '(.*)';/);
const anonKey = campo(/const SUPABASE_ANON_KEY: string = '(.*)';/);

// ---------------------------------------------------------------------------
// Primeiro o que não precisa de rede: as colunas que o `cloud.ts` envia têm de
// ser as colunas que existem. Se alguém renomear uma coluna no SQL e não no
// TypeScript, o `insert` leva 42703 em produção e o relatório é descartado —
// e isso apanha-se aqui, sem escrever nada.
// ---------------------------------------------------------------------------

const blocoInsert = cloudTs.match(/from\('crashes'\)\s*\.insert\(\{([\s\S]*?)\n {6}\}\)/);
if (!blocoInsert) throw new Error('não encontrei o insert na tabela crashes em cloud.ts');
const enviadas = [...blocoInsert[1].matchAll(/^\s{8}(\w+):/gm)].map(m => m[1]);

const corpoTabela = sql.slice(sql.indexOf('create table'), sql.indexOf(');'));
const colunas = [...corpoTabela.matchAll(/^\s{2}(\w+)\s+(text|integer|timestamptz|bigint)/gm)].map(
  m => ({ nome: m[1], tipo: m[2] }),
);
const nomesColuna = colunas.map(c => c.nome);

for (const c of colunas) {
  const notNull = new RegExp(`^\\s{2}${c.nome}\\s+[^\\n]*not null`, 'm').test(corpoTabela);
  if (enviadas.includes(c.nome)) {
    ok.push(`cloud.ts envia ${c.nome}`);
  } else if (notNull && c.nome !== 'id') {
    falhas.push(
      `a coluna ${c.nome} é NOT NULL e o cloud.ts não a envia — todo o crash levaria 23502`,
    );
  }
}
for (const e of enviadas) {
  if (!nomesColuna.includes(e)) {
    falhas.push(`o cloud.ts envia ${e}, que não existe em crashes.sql — 42703 em todo o crash`);
  }
}

// ---------------------------------------------------------------------------
// Agora a rede, pelo mesmo caminho que a app: sessão anónima, `insert`, leitura
// de volta e apanhar a linha. Também prova a política de DELETE, que o
// `crashes.sql` cria e que — se isto correr — deixa de ser código morto.
// ---------------------------------------------------------------------------

const marca = `[verificação ${new Date().toISOString()}]`;
const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: sessao, error: erroSessao } = await client.auth.signInAnonymously();
if (erroSessao || !sessao?.user?.id) {
  console.log(`  FALHA sessão anónima: ${erroSessao?.message ?? 'sem user id'}`);
  console.log(`\nA app não conseguiria um user_id, e sem user_id nada chega à tabela.`);
  process.exit(1);
}
ok.push(`sessão anónima (${sessao.user.id.slice(0, 8)}…)`);

const linha = {
  user_id: sessao.user.id,
  message: `${marca} teste automático do caminho do crash`,
  stack: 'Error: verificação\n    at scripts/verificar-crashes.mjs',
  fingerprint: 'aaaa0000',
  app_version: 'verificacao',
  version_code: 0,
  happened_at: new Date().toISOString(),
  reported_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 90 * 864e5).toISOString(),
};

const { data: inserida, error: erroInsert } = await client
  .from('crashes')
  .insert(linha)
  .select('id, message, fingerprint, version_code')
  .single();

if (erroInsert) {
  // Este é o caso que o resto do repositório não vê: 42501 é falta de política
  // de INSERT, 23502 é uma coluna NOT NULL a faltar, 42703 é uma coluna que
  // não existe. Todos são "um crash desaparece em silêncio".
  falhas.push(
    `o insert foi recusado (${erroInsert.code ?? erroInsert.message}) — ` +
      'é isto que o reporter veria em produção, e que descartava o relatório',
  );
} else {
  ok.push(`insert aceite (linha ${inserida.id})`);
}

// Só depois de o insert ser aceite é que vale a pena ler: se foi recusado, a
// seguir viria "não encontrei a linha" e o erro real ficava enterrado no meio.
if (!erroInsert && inserida?.id) {
  const { data: lida, error: erroLeitura } = await client
    .from('crashes')
    .select('id, message, version_code')
    .eq('id', inserida.id)
    .single();
  if (erroLeitura || !lida) {
    falhas.push(`a linha entrou mas não se consegue ler: ${erroLeitura?.message ?? 'não encontrada'}`);
  } else {
    ok.push('a linha lê-se de volta com a RLS do dono');
    if (lida.version_code !== 0) {
      falhas.push(`version_code voltou ${lida.version_code} em vez de 0 — o tipo da coluna não é o do insert`);
    }
  }

  const { error: erroDelete } = await client
    .from('crashes')
    .delete()
    .eq('id', inserida.id);
  if (erroDelete) {
    falhas.push(`não se conseguiu apagar a linha de teste: ${erroDelete.message}`);
  } else {
    const { data: resto } = await client
      .from('crashes')
      .select('id')
      .eq('id', inserida.id);
    if (resto && resto.length === 0) ok.push('a linha de teste apagou-se (política de DELETE boa)');
    else falhas.push('a linha de teste continua lá depois do DELETE');
  }
}

// Uma sessão nova, sem o utilizador de cima, tem de ver zero linhas. Se a RLS de
// SELECT deixasse passar alguém, isto era o lugar onde se via.
//
// Só quando o insert foi aceite. Se não houver linha nenhuma, "outra sessão não
// vê nada" é verdade por não haver nada para ver, e um check que passa por isso
// é pior do que não ter check: na primeira versão deste script, a mutação do
// payload imprimiu esta linha de "ok" com a inserção já recusada três linhas
// acima. Um "ok" que não mediu nada é a forma mais cara de dormir descansado.
if (!erroInsert && inserida?.id) {
  const outro = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: alheias } = await outro
    .from('crashes')
    .select('id')
    .eq('message', `${marca} teste automático do caminho do crash`);
  if (alheias && alheias.length > 0) {
    falhas.push(
      'outra sessão consegue ler a linha de outro utilizador — a RLS de SELECT está aberta',
    );
  } else {
    ok.push('outra sessão não vê a linha de ninguém');
  }
}

for (const linhaOk of ok) console.log(`  ok    ${linhaOk}`);
for (const linhaFalha of falhas) console.log(`  FALHA ${linhaFalha}`);
console.log();
console.log(
  falhas.length === 0
    ? 'Um crash chega mesmo à tabela crashes. As escritas da #56 funcionam de ponta a ponta.'
    : 'Um crash NÃO chega à tabela. Não assumes que a #56 está a funcionar enquanto isto estiver a falhar.',
);
process.exit(falhas.length === 0 ? 0 : 1);
