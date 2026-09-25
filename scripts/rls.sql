-- RLS para as tabelas sincronizadas pelo app.
-- Rodar no Supabase > SQL Editor > New query e executar.
-- O app usa auth anonimo (signInAnonymously): auth.uid() eh o id da sessao,
-- gravado na coluna user_id como texto. service_role (script publicar-supabase.sh)
-- continua passando por RLS (admin bypass).

-- =====================================================================
-- virgin_memory: memoria persistente da assistente
-- =====================================================================
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

-- =====================================================================
-- tracks: trilhas gravadas
-- =====================================================================
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

-- =====================================================================
-- notes: notas de campo
-- =====================================================================
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

-- =====================================================================
-- app_version: leitura publica (o app consulta sem login);
-- gravacao fica so com service_role (bypassa RLS).
-- =====================================================================
alter table app_version enable row level security;

drop policy if exists "public_read_app_version" on app_version;
create policy "public_read_app_version"
on app_version for select
to anon, authenticated
using (true);