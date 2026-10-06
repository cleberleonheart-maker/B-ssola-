-- ============================================================
-- Trajecto completo do rastreio ao vivo (ideia #92)
-- ============================================================
-- Problema: `live_shares` e um `upsert` por token — uma linha, um ponto.
-- A pagina (web/live.html) montava o trajecto com o que ia lendo a cada
-- 5 s, portanto quem abrisse o link 20 minutos depois do inicio via so a
-- straight line do ponto actual, sem o caminho percorrido.
--
-- Solucao: uma segunda tabela, `live_points`, onde cada fix e uma linha nova
-- em vez de uma sobrescrita. `live_shares` continua a ser a "posicao agora"
-- (e a fonte da verdade sobre se a sessao esta viva), `live_points` e a memoria
-- do percurso.
--
-- Fluxo:
--  1. O app grava o fix nas duas tabelas: upsert em `live_shares` (como
--     antes) e insert em `live_points`.
--  2. A pagina continua a ler `get_live_position` para a posicao actual e
--     passa a ler `get_live_track(token, after)` para o trajecto.
--  3. `get_live_track` devolve os pontos com `id > after`, por ordem de id.
--     O viewer guarda o ultimo id e cada poll traz so o que apareceu entretanto:
--     um poll de 5 s sobre 2 h de sessao custa duas linhas, nao 1440.
--  4. Ao encerrar, o app apaga os pontos da sessao, como ja apaga a linha.
--
-- Porque `id` e nao `recorded_at`: o `id` e denso e monotono, portanto
-- "depois do ponto N" nao tem buracos nem empates. `recorded_at` pode vir
-- repetido (o service e o JS podem gravar no mesmo segundo) e faria o viewer
-- saltar pontos ou repetir o ultimo.
--
-- Idempotente. Rode no Supabase > SQL Editor > New query.
-- ============================================================

create table if not exists public.live_points (
  id bigint generated always as identity primary key,
  token text not null,
  user_id text not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  altitude double precision,
  recorded_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- O viewer le por token e em ordem de id; o dono apaga por token+user_id.
create index if not exists live_points_token_id_idx
  on public.live_points (token, id);

-- `expires_at` nao e um filtro da RPC (ela valida contra `live_shares`, que e
-- quem sabe se a sessao continua viva) mas e o que permite a limpeza: sem este
-- indice, um `delete` de expurgo faz seq scan de tudo.
create index if not exists live_points_expires_idx
  on public.live_points (expires_at);

alter table live_points enable row level security;

-- ============================================================
-- RLS: so o dono escreve, so o dono le, so o dono apaga.
--
-- O anon key nao chega a ver nada disto: quem ve o trajecto e a pagina, que
-- nao tem sessao, e por isso passa pela RPC SECURITY DEFINER abaixo. A RLS
-- aqui existe para o caso inverso — o app, com o JWT da sessao anonima, so
-- mexer nas proprias linhas.
-- ============================================================
drop policy if exists "own_select_live_points" on live_points;
create policy "own_select_live_points"
on live_points for select
using (user_id::text = auth.uid()::text);

drop policy if exists "own_insert_live_points" on live_points;
create policy "own_insert_live_points"
on live_points for insert
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_delete_live_points" on live_points;
create policy "own_delete_live_points"
on live_points for delete
using (user_id::text = auth.uid()::text);

-- ============================================================
-- Leitura publica do trajecto, com a justica do token.
--
-- Devolve `id` para o viewer poder pedir "o que ha depois deste" no poll
-- seguinte, e nada mais: `user_id` nao sai daqui, tal como em `get_live_position`.
--
-- O `join` com `live_shares` e o que mantem a paridade com a posicao actual: se
-- a sessao foi apagada (a pessoa encerra) ou expirou, esta funcao devolve vazio
-- tal como `get_live_position` devolve. Sem o join, um link encerrado
-- continuaria a desenhar o percurso para quem ja tinha o historico em cache
-- ate o proximo poll — e o `get_live_status` responderia "encerrado" enquanto o
-- mapa ainda mostrava o caminho.
-- ============================================================
create or replace function public.get_live_track(p_token text, p_after bigint default 0)
returns table (
  id bigint,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  heading double precision,
  speed double precision,
  altitude double precision,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select p.id, p.latitude, p.longitude, p.accuracy, p.heading, p.speed,
           p.altitude, p.recorded_at
    from public.live_points p
    join public.live_shares s on s.token = p.token
    where p.token = p_token
      and p.id > greatest(coalesce(p_after, 0), 0)
      and s.expires_at > now()
    order by p.id
    limit 2000;
end;
$$;

grant execute on function public.get_live_track(text, bigint) to anon, authenticated;

-- ============================================================
-- Purga das sessoes que acabaram sem ninguem as apagar.
--
-- O `live_shares` guarda a linha expirada de proposito (e o `get_live_status`
-- precisa dela para responder "expirou" em vez de "encerrado"), mas os pontos
-- nao servem para nada depois do prazo. Quem os apaga e o dono, na app:
-- `deleteExpiredLivePoints` em `cloud.ts`, uma vez por processo no primeiro
-- `pushLiveFix`. Uma sessao que morre sem `stopLiveShare` — app fechada a
-- forca, crash, um delete que ficou sem rede — e precisamente a linha que
-- ficava: nao tem token com que ir busca-la, e e por isso que o filtro e o
-- `expires_at` e nao o token. Uma sessao a decorrer tem `expires_at` no
-- futuro, o que a torna intocavel.
--
--   select cron.schedule(
--     'purge-live-points',
--     '*/15 * * * *',
--     $$delete from public.live_points where expires_at < now()$$
--   );
--
-- O `cron.schedule` la em cima continua opcional, como sempre foi: `pg_cron`
-- nao vem ligada em todos os projectos, e a app ja faz o trabalho.
-- ============================================================

-- ============================================================
-- Verificacao depois de rodar:
--   select count(*) from public.live_points;                 -- 0 no inicio
--   select proname from pg_proc where proname = 'get_live_track';
-- ============================================================