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
--  4. Ao expirar, a funcao devolve vazio -> pagina mostra "expirado".
--     O link morre sozinho.
-- Idempotente. Rode no Supabase > SQL Editor > New query.
-- ============================================================

-- =====...=============================================================
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
    limit 1;
end;
$$;

-- A justica do link eh o token: se expirou ou token errado, devolve vazio.
-- Concede EXECUTE a anon (pagina web usa anon key + RLS da funcao).
grant execute on function public.get_live_position(text) to anon, authenticated;

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
