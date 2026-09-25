-- RLS para as tabelas sincronizadas pelo app.
-- Rodar no Supabase > SQL Editor > New query e executar.
-- O app usa auth anonimo (signInAnonymously): auth.uid() eh o id da sessao,
-- gravado na coluna user_id como texto. service_role (script publicar-supabase.sh)
-- continua passando por RLS (admin bypass).

-- =====...=============================================================
oria persistente da assistente
-- =====...=============================================================
-- O app faz upsert com onConflict('user_id') em {user_id, facts, history, updated_at}.
create table if not exists public.virgin_memory (
  user_id text not null,
  facts jsonb,
  history jsonb,
  updated_at timestamptz not null default now(),
  constraint virgin_memory_pkey primary key (user_id)
);

alter table virgin_memory enable row level security;

drop policy if exists "own_select_virgin_memory" on virgin_memory;
create policy "own_select_virgin_memory"
on virgin_memory for select
using (user_id::text = auth.uid()::text);

drop policy if exists "own_insert_virgin_memory" on virgin_memory;
create policy "own_insert_virgin_memory"
on virgin_memory for insert
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_update_virgin_memory" on virgin_memory;
create policy "own_update_virgin_memory"
on virgin_memory for update
using (user_id::text = auth.uid()::text)
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_delete_virgin_memory" on virgin_memory;
create policy "own_delete_virgin_memory"
on virgin_memory for delete
using (user_id::text = auth.uid()::text);

-- =====...=============================================================
-- tracks: trilhas gravadas
-- =====...=============================================================
-- O app faz upsert com onConflict('id') em {user_id, id, data, updated_at}.
-- A tabela pode nao existir ainda: texto abaixo a cria se preciso.
create table if not exists public.tracks (
  user_id text not null,
  id text not null,
  data jsonb,
  updated_at timestamptz not null default now(),
  constraint tracks_pkey primary key (id)
);
create index if not exists tracks_user_id_idx on public.tracks (user_id);

alter table tracks enable row level security;

drop policy if exists "own_select_tracks" on tracks;
create policy "own_select_tracks"
on tracks for select
using (user_id::text = auth.uid()::text);

drop policy if exists "own_insert_tracks" on tracks;
create policy "own_insert_tracks"
on tracks for insert
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_update_tracks" on tracks;
create policy "own_update_tracks"
on tracks for update
using (user_id::text = auth.uid()::text)
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_delete_tracks" on tracks;
create policy "own_delete_tracks"
on tracks for delete
using (user_id::text = auth.uid()::text);

-- =====...=============================================================
-- notes: notas de campo
-- =====...=============================================================
-- O app faz upsert com onConflict('id') em {user_id, id, data, updated_at}.
-- A tabela pode nao existir ainda: texto abaixo a cria se preciso.
create table if not exists public.notes (
  user_id text not null,
  id text not null,
  data jsonb,
  updated_at timestamptz not null default now(),
  constraint notes_pkey primary key (id)
);
create index if not exists notes_user_id_idx on public.notes (user_id);

alter table notes enable row level security;

drop policy if exists "own_select_notes" on notes;
create policy "own_select_notes"
on notes for select
using (user_id::text = auth.uid()::text);

drop policy if exists "own_insert_notes" on notes;
create policy "own_insert_notes"
on notes for insert
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_update_notes" on notes;
create policy "own_update_notes"
on notes for update
using (user_id::text = auth.uid()::text)
with check (user_id::text = auth.uid()::text);

drop policy if exists "own_delete_notes" on notes;
create policy "own_delete_notes"
on notes for delete
using (user_id::text = auth.uid()::text);

-- =====...=============================================================
-- app_version: leitura publica (o app consulta sem login);
-- gravacao fica so com service_role (bypassa RLS).
-- =====...=============================================================
alter table app_version enable row level security;

drop policy if exists "public_read_app_version" on app_version;
create policy "public_read_app_version"
on app_version for select
to anon, authenticated
using (true);