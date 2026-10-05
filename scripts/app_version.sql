-- =====================================================================
-- app_version: app consulta via REST sem login (anon key).
-- Estrutura minima que o repom.yml/curl PATCH espera. Roda no SQL Editor.
-- O proximo trecho (app_version público RLS) ja vem no rls.sql.
--
-- `version_name` e `update_url` sao NOT NULL porque e' assim que estao na nuvem,
-- e nao por gosto: este ficheiro descreve o schema que ja existe. A diferenca
-- so apareceu quando o CI passou a aplicar os ficheiros sozinho (2026-10-05) --
-- o `insert` de seeding falhou com 23502 em `update_url`, depois de meses a
-- descrever um schema sem que nada o corresse. A nuvem e' que manda; o ficheiro
-- e' que se ajusta.
-- =====================================================================
create table if not exists public.app_version (
  id integer not null,
  version_code integer not null,
  version_name text not null,
  update_url text not null,
  message text,
  required boolean not null default false,
  constraint app_version_pkey primary key (id)
);

-- A linha existe para a política de leitura pública ter o que devolver; quem
-- manda no conteúdo é o CI, no PATCH que acompanha cada release. O `on conflict`
-- quer dizer que isto nunca escreve em cima da linha verdadeira — mas o NOT
-- NULL é conferido na tentativa, antes do conflito, por isso as duas colunas
-- têm de vir preenchidas mesmo quando o conflito as vai deitar fora.
insert into public.app_version (id, version_code, version_name, update_url)
values (1, 0, 'v0', '')
on conflict (id) do nothing;
