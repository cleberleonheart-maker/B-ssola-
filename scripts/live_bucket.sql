-- ============================================================
-- Bucket publico do viewer de rastreio ao vivo (#24)
-- Rode no Supabase > SQL Editor > New query. Idempotente.
-- ============================================================

-- 1) Cria o bucket publico 'live' (1 MB, so HTML)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('live', 'live', true, 1048576, array['text/html', 'text/plain'])
on conflict (id) do update
  set public = true,
      file_size_limit = 1048576,
      allowed_mime_types = array['text/html', 'text/plain'];

-- 2) Conferir bucket
select id, name, public, file_size_limit
from storage.buckets
where id = 'live';

-- ============================================================
-- IMPORTANTE: o upload do arquivo NAO pode ser feito por SQL.
-- Since o Supabase guarda o conteudo na S3, storage.objects
-- nao tem mais a coluna 'content' (daria erro 42703).
--
-- Faca o upload de UMA destas formas:
--
-- (A) Painel do Supabase
--     Storage > live > New file > envie web/live.html
--     (baixe em: https://raw.githubusercontent.com/cleberleonheart-maker/B-ssola-/main/web/live.html)
--
-- (B) API do Storage (curl), usando a service_role key:
--     curl -X POST \"\$SUPABASE_URL/storage/v1/object/live/live.html\"
--       -H \"Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY\"
--       -H \"Content-Type: text/html\"
--       --data-binary @web/live.html
-- ============================================================
