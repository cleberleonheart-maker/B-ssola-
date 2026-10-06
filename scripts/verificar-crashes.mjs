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
 * Não entra no `pretest`: precisa de rede e escreve em produção. Corre de
 * semana em semana, a cada commit que toque no caminho do crash e à mão — o
 * `.github/workflows/verificar-crashes.yml` (ideia #97) é quem faz os dois
 * primeiros, para uma regressão de RLS não ficar à espera de alguém se
 * lembrar de correr isto. Sem segredo nenhum: a URL e a anon key vêm do
 * próprio `cloud.ts`, que são públicas.
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

// A limpeza do prazo, que é a parte perigosa — e que se verifica em
// `live_points` e não em `crashes`: os pontos crescem seis linhas por minuto,
// é lá que um filtro a mais apagaria o trajecto de quem está a ver o link, e o
// caminho do código é o mesmo (`deleteExpired*` em `cloud.ts`). Duas linhas
// nossas, uma caducada e outra a decorrer, e uma de outra pessoa.
//
// A caducada tem de ir. A outra tem de ficar, porque é a sessão que está a
// decorrer e apagá-la deixa quem está a ver o link sem trajecto a meio. E a do
// outro tem de ficar porque não é nossa — para a criar é preciso mesmo outra
// sessão: a primeira versão tentou inserir com um `user_id` inventado e a RLS
// respondeu 42501, que é a resposta certa e a razão de o teste ter de usar uma
// segunda pessoa a sério.
{
  const caducada = new Date(Date.now() - 200 * 864e5).toISOString();
  const aDecorrer = new Date(Date.now() + 60 * 60e3).toISOString();

  const outro = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: sessao2, error: erroSessao2 } = await outro.auth.signInAnonymously();
  if (erroSessao2 || !sessao2?.user?.id) {
    falhas.push(`não se conseguiu uma segunda sessão (${erroSessao2?.message}): a limpeza não dá para verificar`);
  } else {
    const ponto = (userId, expira) => ({
      token: `verificacao-${userId.slice(0, 6)}`,
      user_id: userId,
      latitude: 0,
      longitude: 0,
      expires_at: expira,
    });
    const { error: erroMeu1 } = await client
      .from('live_points')
      .insert(ponto(sessao.user.id, caducada));
    const { error: erroMeu2 } = await client
      .from('live_points')
      .insert(ponto(sessao.user.id, aDecorrer));
    const { error: erroAlheio } = await outro
      .from('live_points')
      .insert(ponto(sessao2.user.id, caducada));

    if (erroMeu1 || erroMeu2 || erroAlheio) {
      const erro = erroMeu1 ?? erroMeu2 ?? erroAlheio;
      falhas.push(
        `não se conseguiram inserir pontos de teste (${erro?.code}): ${erro?.message}`,
      );
    } else {
      ok.push('pontos de teste inseridos (nosso caducado, nosso a decorrer, e o de outra pessoa)');

      const { error: erroLimpeza } = await client
        .from('live_points')
        .delete()
        .eq('user_id', sessao.user.id)
        .lt('expires_at', new Date().toISOString());
      if (erroLimpeza) {
        falhas.push(`a limpeza foi recusada (${erroLimpeza.code}): ${erroLimpeza.message}`);
      } else {
        const { data: meus } = await client
          .from('live_points')
          .select('expires_at')
          .eq('token', `verificacao-${sessao.user.id.slice(0, 6)}`);
        const sobrou = (meus ?? []).length;
        // Olhar para a linha que ficou, e não só para quantas ficaram. Contar
        // linhas dá a resposta errada com meia verdade: com a comparação trocada
        // fica uma linha — a errada — e "ficou uma" parece o resultado certo.
        const sobrouACaducar =
          (meus ?? []).length > 0 && (meus ?? []).every(r => Date.parse(r.expires_at) <= Date.now());
        if (sobrou === 1 && !sobrouACaducar) {
          ok.push('a limpeza levou o caducado e deixou o que está a decorrer');
        } else {
          const quais = (meus ?? [])
            .map(r => (Date.parse(r.expires_at) <= Date.now() ? 'caducado' : 'a decorrer'))
            .join(' e ');
          falhas.push(
            sobrou === 0
              ? 'a limpeza levou o caducado e também o que está a decorrer — quem vê o link fica sem trajecto'
              : `esperava ficar só o ponto a decorrer e ficaram ${sobrou} (${quais || 'sem prazo legível'})`,
          );
        }

        const { data: dele } = await outro
          .from('live_points')
          .select('id')
          .eq('token', `verificacao-${sessao2.user.id.slice(0, 6)}`);
        if ((dele ?? []).length === 1) {
          ok.push("a limpeza não tocou no ponto de outra pessoa (caducado e tudo)");
        } else {
          falhas.push(
            `a limpeza apanhou o ponto de outra pessoa — a RLS de DELETE está aberta`,
          );
        }
      }
    }
    // Apanha tudo o que sobrou, para o teste não deixar pontos na tabela. Isto
    // corre em cada execução, incluindo nas que acabaram por falhar a meio, e
    // este script aponta para a base de produção — um teste que deixa lixo é
    // pior do que um teste que não existe.
    await client.from('live_points').delete().eq('user_id', sessao.user.id);
    await outro.from('live_points').delete().eq('user_id', sessao2.user.id);
    const { data: sobrou } = await client
      .from('live_points')
      .select('id, token')
      .like('token', 'verificacao-%');
    if ((sobrou ?? []).length > 0) {
      falhas.push(
        `o teste deixou ${(sobrou ?? []).length} pontos na tabela (tokens ` +
          `${(sobrou ?? []).map(r => r.token).join(', ')})`,
      );
    } else {
      ok.push('o teste não deixou nenhum ponto para trás');
    }
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
