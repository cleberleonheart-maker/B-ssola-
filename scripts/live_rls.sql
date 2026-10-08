-- ============================================================
-- Rastreio ao vivo por link (ideia #24)
-- ============================================================
-- Fluxo:
--  1. O app cria a sessao (token unico + expires_at) e, a cada
--     intervalo (~5 s), faz upsert da posicao (RLS: so o dono).
--  2. O dono envia por WhatsApp/SMS o link da pagina de visualizacao
--     (web/live.html no Storage publico) com o token no hash.
--  3. A pagina chama get_live_position(token) com a anon key. A funcao
--     e SECURITY DEFINER e SEMPRE valida: token existe + nao expirou +
--     retorna apenas lat/lng/heading/accuracy/... Nunca expoe user_id.
--  4. Ao expirar, a funcao devolve vazio -> pagina consulta get_live_status
--     (que nao devolve coordenada) para dizer "expirou" em vez de "encerrado".
-- Idempotente. Rode no Supabase > SQL Editor > New query.
-- ============================================================

-- ============================================================
create table if not exists public.live_shares (
  token text not null,
  user_id text not null,
  latitude double precision not null default 0,
  longitude double precision not null default 0,
  accuracy double precision,
  heading double precision,
  speed double precision,
  altitude double precision,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint live_shares_pkey primary key (token)
);

create index if not exists live_shares_user_id_idx on public.live_shares (user_id);
create index if not exists live_shares_expires_idx on public.live_shares (expires_at);

-- stopped_at (ideia #100): quando a pessoa carrega em "Parar", a linha deixa
-- de ser apagada e passa a ser marcada. Guardar a linha e' o que permite ao
-- historico de partilhas responder "mandei um link as 21h04 e durou 30 min" --
-- com a linha apagada nao havia comodo de saber sequer que a sessao existiu.
-- Enquanto `stopped_at` estiver preenchido, as RPCs de posicao e de trajecto
-- escondem a sessao como se estivesse apagada: parar e' parar de partilhar.
-- O `if not exists` e' porque a tabela ja existe na nuvem; sem ele, republicar
-- este ficheiro rebentaria em cada release.
alter table public.live_shares add column if not exists stopped_at timestamptz;

alter table live_shares enable row level security;

-- ============================================================
-- RLS: dono le / cria / atualiza / encerra a propria sessao.
-- ============================================================
drop policy if exists "own_select_live_shares" on live_shares;
create policy "own_select_live_shares"
on live_shares for select
using (user_id::text = auth.uid()::text);

drop policy if exists "own_insert_live_shares" on live_shares;
create policy "own_insert_live_shares"
on live_shares for insert
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_update_live_shares" on live_shares;
create policy "own_update_live_shares"
on live_shares for update
using (user_id::text = auth.uid()::text)
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_delete_live_shares" on live_shares;
create policy "own_delete_live_shares"
on live_shares for delete
using (user_id::text = auth.uid()::text);

-- ============================================================
-- Funcao publica de leitura: valida token + expiracao, devolve
-- apenas a posicao. O viewer (web) chama com o token do link.
-- SECURITY DEFINER: quem chama NAO precisa enxergar a tabela.
-- ============================================================
create or replace function public.get_live_position(p_token text)
returns table (
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  heading double precision,
  speed double precision,
  altitude double precision,
  started_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select s.latitude, s.longitude, s.accuracy, s.heading, s.speed,
           s.altitude, s.started_at, s.expires_at, s.updated_at
    from public.live_shares s
    where s.token = p_token
      and s.expires_at > now()
      and s.stopped_at is null
    limit 1;
end;
$$;

-- A justica do link eh o token: se expirou ou token errado, devolve vazio.
-- Concede EXECUTE a anon (pagina web usa anon key + RLS da funcao).
grant execute on function public.get_live_position(text) to anon, authenticated;

-- ============================================================
-- Só o estado da sessao, sem coordenada.
--
-- A posicao some da resposta por dois motivos que o viewer precisa
-- distinguir: a pessoa encerrou (a sessao foi marcada com `stopped_at`, ou a
-- linha antiga apagada) ou o prazo venceu (a linha continua la, e a RPC
-- acima esconde por `expires_at > now()`). Sem esta funcao o viewer dizia
-- "🛑 encerrado pela pessoa" para um prazo so cumprido -- o sumico ficava sem
-- explicacao nenhuma.
--
-- `stopped_at` veio com o historico de partilhas (#100): parar deixou de
-- apagar a linha e passou a marca-la, e sem esta coluna na resposta o viewer
-- passava a dizer "expirou" para uma sessao que a propria pessoa parou.
-- O `drop` antes do `create` e' obrigatorio: o Postgres nao deixa mudar o
-- tipo de retorno de uma funcao que ja existe, e acrescentar uma coluna a
-- `returns table` e mudar o tipo.
--
-- Devolve carimbos de tempo e nada mais: quem tem o link expirado continua
-- sem acesso a posicao. A linha expirada fica na tabela de proposito (e o
-- indice de `expires_at` e o que faz as RPCs acima filtrarem barato), porque e
-- ela que permite essa resposta.
-- ============================================================
drop function if exists public.get_live_status(text);

create function public.get_live_status(p_token text)
returns table (
  expires_at timestamptz,
  updated_at timestamptz,
  expired boolean,
  stopped boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select s.expires_at, s.updated_at, s.expires_at <= now(),
         s.stopped_at is not null
  from public.live_shares s
  where s.token = p_token
  limit 1;
$$;

grant execute on function public.get_live_status(text) to anon, authenticated;

-- ============================================================
-- OPCIONAL — bucket publico "live" para hospedar web/live.html.
-- Se nao quiser Storage, pode hospedar em qualquer CDN/CSP.
-- ============================================================
-- Rode UMA vez (nao e idempotente por design, evita criar+apagar a toa):
--   select 1 from storage.buckets where id = 'live'
--   and depois, se vazio:
--   insert into storage.buckets (id, name, public)
--   values ('live', 'live', true);
-- Depois envie web/live.html como "Storage > live > Upload" e o link fica:
--   https://<PROJETO>.supabase.co/storage/v1/object/public/live/live.html#<TOKEN>
