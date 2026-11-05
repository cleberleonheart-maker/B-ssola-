-- ============================================================
-- Partilha de trilha por link (ideia #37)
-- ============================================================
-- O app exporta o GPX para um ficheiro que a pessoa manda por WhatsApp ou
-- e-mail, mas o ficheiro vai com a trilha: quem o recebe tem de o ter
-- instalado para o abrir. Este esquema da a volta do problema: o app cria
-- uma linha de partilha com um token unico, e a pagina `web/gpx.html`
-- (publicada no GitHub Pages) le a trilha pela `get_track_share` e mostra o
-- mapa e o GPX para download.
--
-- Fluxo:
--  1. O app garante que a trilha esta na nuvem (upsert em `tracks`) e
--     insere a linha em `track_shares` com o token e a validade.
--  2. A pessoa manda o link, que tem o token no hash (nunca na query, para
--     nao vazar para o historico do navegador nem para o servidor).
--  3. A pagina chama `get_track_share(token)` com a anon key. A funcao e
--     SECURITY DEFINER e SEMPRE valida: token existe, nao expirou e a trilha
--     continua a ser do dono da partilha. Nunca devolve `user_id`.
--  4. Ao expirar, a funcao devolve NULL -> a pagina diz "link expirado" em
--     vez de "trilha vazia".
--
-- A RLS da tabela e a do dono, como nas outras: so quem criou a partilha a
-- ve, a apaga ou a renova. O anon nao tem SELECT na tabela -- passa pelo
-- caminho da funcao, que e o que valida o token.
--
-- Idempotente. Corre no Supabase > SQL Editor > New query, ou pelo
-- `scripts/publicar-sql.sh` (que e o que o CI faz).
-- ============================================================

create table if not exists public.track_shares (
  token text not null,
  user_id text not null,
  track_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint track_shares_pkey primary key (token)
);

create index if not exists track_shares_user_id_idx on public.track_shares (user_id);
create index if not exists track_shares_track_id_idx on public.track_shares (track_id);
create index if not exists track_shares_expires_idx on public.track_shares (expires_at);

alter table public.track_shares enable row level security;

-- ============================================================
-- RLS: o dono ve, cria, renova e apaga as suas partilhas.
-- ============================================================
drop policy if exists "own_select_track_shares" on public.track_shares;
create policy "own_select_track_shares"
on public.track_shares for select
using (user_id::text = auth.uid()::text);

drop policy if exists "own_insert_track_shares" on public.track_shares;
create policy "own_insert_track_shares"
on public.track_shares for insert
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_update_track_shares" on public.track_shares;
create policy "own_update_track_shares"
on public.track_shares for update
using (user_id::text = auth.uid()::text)
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_delete_track_shares" on public.track_shares;
create policy "own_delete_track_shares"
on public.track_shares for delete
using (user_id::text = auth.uid()::text);

-- ============================================================
-- A leitura publica. Uma funcao, e nao uma politica com o token: a RLS
-- da tabela nao conhece o token, e abrir a tabela ao anon daria a
-- qualquer pessoa a lista de todos os tokens -- que sao as chaves das
-- partilhas.
--
-- O `drop` antes do `create` e' obrigatorio: o Postgres nao deixa mudar o
-- tipo de retorno de uma funcao que ja existe.
-- ============================================================
drop function if exists public.get_track_share(text);

create or replace function public.get_track_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  partilha public.track_shares;
  trilha public.tracks;
begin
  if p_token is null or p_token = '' then
    return null;
  end if;

  select * into partilha
    from public.track_shares
    where token = p_token
    limit 1;

  if not found then
    return null;
  end if;

  -- Expirada e' expirada: a linha fica na base (a pessoa pode ver que
  -- existiu), mas a trilha deixa de ser legivel.
  if partilha.expires_at <= now() then
    return null;
  end if;

  -- A trilha tem de ser a do dono da partilha. Sem esta clausula, um token
  -- apontaria para a trilha de outra pessoa.
  select * into trilha
    from public.tracks
    where id = partilha.track_id
      and user_id = partilha.user_id
    limit 1;

  if not found or trilha.data is null then
    return null;
  end if;

  return jsonb_build_object(
    'name', coalesce(trilha.data ->> 'name', 'Trilha'),
    'startedAt', trilha.data -> 'startedAt',
    'endedAt', trilha.data -> 'endedAt',
    'points', coalesce(trilha.data -> 'points', '[]'::jsonb),
    'distance', trilha.data -> 'distance',
    'eleGain', trilha.data -> 'eleGain',
    'eleLoss', trilha.data -> 'eleLoss',
    'expires_at', partilha.expires_at
  );
end;
$$;

grant execute on function public.get_track_share(text) to anon, authenticated;
