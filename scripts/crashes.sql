-- ============================================================
-- Relatório de crash (ideia #56)
-- ============================================================
-- Problema: um erro em produção é invisível. A pessoa vê a app fechar e não há
-- nada — nem stack, nem versão, nem quando. E o custo de um bug ser descoberto
-- por quem usa é o mais caro que há numa app de bússola e de SOS.
--
-- Solução: o crash vai para uma tabela, e o dono lê no Table Editor. Sem conta
-- nova, sem serviço de terceiros, sem DSN.
--
-- Porquê não o Sentry, que a ideia mencionava:
--   - o stack e o dispositivo de quem usa a app de emergência iam para fora, e
--     isso é uma decisão do dono, não uma conversa de implementação;
--   - uma conta nova, um DSN e um processador a facturar para substituir uma
--     tabela que já existe e que o CI já sabe aplicar e verificar.
--
-- Quem escreve: o `crashReporter.ts`, no `ErrorUtils.setGlobalHandler` e nos
-- boundaries do React. Ele grava em `AsyncStorage` e envia no arranque
-- seguinte — uma app que morreu não tem rede garantida para reportar antes de
-- morrer outra vez.
--
-- O que se guarda, e o que não:
--   guarda-se  mensagem, stack, versão do build, quando, e um `fingerprint`
--           (hash da mensagem) que é o que permite contar "isto happenceu 400
--           vezes" sem guardar 400 linhas;
--   não se guarda o device id, nem o nome, nem email, nem coordenadas, nem
--           nada que identifique quem instalou. Um relatório de crash não precisa
--           de saber quem é a pessoa para dizer o que é que o erro é — e uma
--           tabela de erros que também é uma lista de utilizadores é uma tabela
--           que um dia vaza.
--
-- `user_id` fica presente porque a RLS é por utilizador e é o que impede que
-- o crash de uma pessoa vá parar à linha de outra; e porque o `auth.uid()` da
-- sessão anónima identifica o aparelho sem dizer nada sobre a pessoa.
--
-- Idempotente. Rode no Supabase > SQL Editor > New query (ou deixe o CI
-- aplicar: este ficheiro entra na lista do `verificar-sql.mjs`).
-- ============================================================

create table if not exists public.crashes (
  id bigint generated always as identity primary key,
  -- O mesmo que o dono da sessão. A política compara com auth.uid().
  user_id text not null,
  -- `AppError.message` / o que o handler recebeu.
  message text not null,
  -- `AppError.stack`, sem o device id nem caminhos que não interessam.
  stack text,
  -- `7.33` e `164`: sem isto um erro de uma versão antiga é indistinguível do
  -- mesmo erro na actual, e a decisão de "já corrigi?" fica impossivel.
  app_version text,
  version_code integer,
  -- Hash da mensagem: é o que dá a contagem. Duas linhas com o mesmo
  -- fingerprint são o mesmo bug, e é isso que se quer ver.
  fingerprint text not null,
  -- Quando o crash aconteceu, e quando foi reportado (o arranque seguinte).
  happened_at timestamptz not null default now(),
  reported_at timestamptz not null default now(),
  -- Para a purga: um crash de hace seis meses já não interessa a ninguém.
  expires_at timestamptz not null
);

-- A pergunta que se faz ao Table Editor é "quais são os bugs que ainda existem
-- na versão actual", e a resposta é filtrar por versão e ordenar por contagem.
create index if not exists crashes_fingerprint_idx
  on public.crashes (fingerprint, happened_at desc);

-- Um relatório que nunca é lido também é uma tabela que cresce sem parar.
create index if not exists crashes_expires_idx
  on public.crashes (expires_at);

alter table crashes enable row level security;

-- ============================================================
-- RLS: cada aparelho escreve e lê os seus crashes, e mais ninguém.
--
-- O `anon` não vê nada disto sem `auth.uid()`: um crash é do dono da sessão
-- anónima, e a tabela não é pública como a `app_version`. Só o crash reporter
-- escreve, e ele vai pelo cliente com o JWT da sessão, por isso a política de
-- insert tem de bater com o mesmo `user_id`.
-- ============================================================
drop policy if exists "own_select_crashes" on crashes;
create policy "own_select_crashes"
on crashes for select
using (user_id::text = auth.uid()::text);

drop policy if exists "own_insert_crashes" on crashes;
create policy "own_insert_crashes"
on crashes for insert
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_delete_crashes" on crashes;
create policy "own_delete_crashes"
on crashes for delete
using (user_id::text = auth.uid()::text);

-- ============================================================
-- Limpeza dos relatórios antigos.
--
-- Corre na app, não aqui: `deleteExpiredCrashReports` em `cloud.ts`, chamada
-- pelo `flushCrashes` depois de um envio bem-sucedido. Só o dono apaga, e as
-- políticas de DELETE em cima garantem que é mesmo só o dono — o mesmo filtro
-- que a escrita. A alternativa era o `cron.schedule` abaixo, que precisa da
-- extension `pg_cron` e por isso ficou em comentário: uma limpeza que depende
-- de uma extension que nem todos os projectos têm é uma limpeza que não
-- acontece em silêncio. Aqui não há nada para ligar, e sem relatório novo não
-- há sequer pedido: a fila vazia não corre a limpeza.
--
-- O que a app não apaga são as linhas de quem já não tem sessão nenhuma —
-- conta apagada, ou quem nunca mais abriu a app depois do crash. Isso é o
-- `scripts/limpar-orfaos.mjs` (ideia #98), corre de madrugada com a
-- `service_role` e o mesmo filtro `expires_at < now()`.
--
--   select cron.schedule(
--     'purge-crashes',
--     '17 4 * * *',
--     $$delete from public.crashes where expires_at < now()$$
--   );
--
-- As 4:17 da manhã são de propósito: um `*/15` às 3h da manhã não tem a
-- ver com a ninguém e bate na mesma nas entradas de exemplo. Contadas em UTC,
-- que é o que o `cron.schedule` do Postgres usa por omissão — 4:17 UTC são
-- 1:17 de Brasília, que continua a ser a hora em que ninguém está a olhar.
-- ============================================================

-- ============================================================
-- Verificação depois de rodar:
--   select count(*) from public.crashes;   -- 0 no início
--   select proname from pg_proc where proname like 'crash%';  -- nada: é tabela
-- ============================================================
