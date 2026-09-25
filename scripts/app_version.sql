-- =====================================================================
-- app_version: app consulta via REST sem login (anon key).
-- Estrutura minima que o repom.yml/curl PATCH espera. Roda no SQL Editor.
-- O proximo trecho (app_version público RLS) ja vem no rls.sql.
-- =====================================================================
create table if not exists public.app_version (
  id integer not null,
  version_code integer not null,
  version_name text,
  update_url text,
  message text,
  required boolean not null default false,
  constraint app_version_pkey primary key (id)
);

insert into public.app_version (id, version_code, version_name)
values (1, 148, 'v7.17')
on conflict (id) do nothing;
