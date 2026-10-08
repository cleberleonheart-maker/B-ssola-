#!/usr/bin/env node
/**
 * Apaga as linhas caducadas de quem nunca mais volta — a ideia #98.
 *
 * A limpeza do prazo já existe e já é cumprida: `deleteExpiredCrashReports` e
 * `deleteExpiredLivePoints`, no `cloud.ts`, correm do lado de quem tem sessão
 * e apagam só as linhas desse utilizador (a RLS obriga a isso mesmo que o
 * código o esqueça). O que ficava por apanhar é o que ninguém consegue apagar:
 * linhas de uma conta apagada, e linhas de uma sessão que acabou sem a pessoa
 * nunca mais abrir a app. Nesse caso o `auth.uid()` que o DELETE exige já não
 * é o dela, e a linha fica para sempre — hoje isso faz-se à mão no Table
 * Editor, como está escrito no PUBLICACAO-ATUALIZACAO.md.
 *
 * O único filtro é `expires_at` no passado, e é esse o guarda-corpo: uma
 * sessão a decorrer tem o prazo no futuro e é intocável por construção. As
 * tabelas estão numa lista branca com o corte de cada uma escrito à mão, e
 * uma tabela nova que entre sem corte próprio derruba o script em vez de ser
 * apagada a eito — `expires_at < now()` numa tabela cujo prazo é mais curto do
 * que a retenção prometida apaga linhas que ainda deviam estar lá.
 *
 * `live_shares` guarda a linha expirada de propósito: é ela que permite ao
 * `get_live_status` responder "expirou" em vez de "encerrado" no viewer, e
 * apagá-la no instante em que o prazo vence devolvia a mentira que o #86
 * existia para acabar. Guardam-se 90 dias além do prazo, o tempo de quem
 * recebeu o link ainda conseguir perguntar "foi eu que parei, ou expirou?".
 *
 * Precisa de `SUPABASE_SERVICE_ROLE_KEY` (no ambiente, ou em
 * `~/.supabase-service-key`). É a única coisa neste repositório que apaga
 * linha de alguém: a service_role salta a RLS, e é exactamente o que as
 * linhas sem dono precisam — o caminho do cliente, com `auth.uid()`, não as
 * alcança. Corre de madrugada pelo `.github/workflows/limpar-orfaos.yml`;
 * sem a chave, sai com erro em vez de dizer que limpou.
 *
 *   node scripts/limpar-orfaos.mjs                  # apaga
 *   node scripts/limpar-orfaos.mjs --apenas-contar  # só conta, não escreve
 */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { createClient } from '@supabase/supabase-js';

const NOVENTA_DIAS = 90 * 24 * 60 * 60 * 1000;

/**
 * Lista branca: só estas três tabelas têm `expires_at`, e é por isso que
 * estão aqui. As restantes (`notes`, `tracks`, `virgin_memory`) não expiram —
 * o órfão delas é a conta apagada sem apagar dados, que é a #101 e não esta.
 */
const TABELAS = [
  {
    tabela: 'crashes',
    porquê: 'os 90 dias de retenção já vêm no próprio expires_at',
    corte: agora => new Date(agora),
  },
  {
    tabela: 'live_points',
    porquê: 'depois do prazo o trajecto não serve para nada',
    corte: agora => new Date(agora),
  },
  {
    tabela: 'live_shares',
    porquê: 'a linha expirada responde "expirou" no viewer — fica 90 dias além do prazo',
    corte: agora => new Date(agora - NOVENTA_DIAS),
  },
];

const sóContar = process.argv.includes('--apenas-contar');

const raiz = new URL('../', import.meta.url).pathname;
const cloudTs = readFileSync(`${raiz}src/services/cloud.ts`, 'utf8');
const url = cloudTs.match(/const SUPABASE_URL: string = '(.*)';/)?.[1];
if (!url) {
  console.error('  FALHA não encontrei SUPABASE_URL em cloud.ts');
  process.exit(1);
}

let chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!chave) {
  try {
    chave = readFileSync(`${homedir()}/.supabase-service-key`, 'utf8').trim();
  } catch {
    // sem ficheiro, a mensagem abaixo diz o que falta
  }
}
if (!chave) {
  console.error(
    '  FALHA SUPABASE_SERVICE_ROLE_KEY em falta (no ambiente, ou em ' +
      '~/.supabase-service-key). Sem a chave não se apaga nada, e este ' +
      'script não limpa nada em silêncio.',
  );
  process.exit(1);
}

const client = createClient(url, chave, { auth: { persistSession: false } });

const ok = [];
const falhas = [];
const agora = Date.now();

for (const { tabela, corte, porquê } of TABELAS) {
  const limite = corte(agora).toISOString();

  if (sóContar) {
    const { count, error } = await client
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .lt('expires_at', limite);
    if (error) {
      falhas.push(`${tabela}: a contagem falhou (${error.code ?? error.message})`);
    } else {
      ok.push(`${tabela}: ${count ?? 0} linhas caducadas por apagar (${porquê})`);
    }
    continue;
  }

  const { data, error } = await client.from(tabela).delete().lt('expires_at', limite).select('id');
  if (error) {
    falhas.push(`${tabela}: o DELETE foi recusado (${error.code ?? error.message})`);
  } else {
    const apagadas = (data ?? []).length;
    ok.push(`${tabela}: ${apagadas} linhas apagadas (${porquê})`);
  }
}

for (const linhaOk of ok) console.log(`  ok    ${linhaOk}`);
for (const linhaFalha of falhas) console.log(`  FALHA ${linhaFalha}`);
console.log();
console.log(
  falhas.length === 0
    ? sóContar
      ? 'Contagem feita sem escrever nada. O que estiver acima é o que a limpeza apagaria.'
      : 'As linhas sem dono passaram a ser apagadas por um schedule, e não à mão no Table Editor.'
    : 'A limpeza NÃO correu inteira. Não assumes que o prazo está a ser cumprido enquanto isto estiver a falhar.',
);
process.exit(falhas.length === 0 ? 0 : 1);
