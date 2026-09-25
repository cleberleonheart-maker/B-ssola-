-- Habilite antes (uma vez): Database > Extensions > pg_net e pg_net (http)
-- Se "extensions" nao existir, use a alternativa manual (comentada no fim).

-- 1) Cria o bucket publico 'live' (idempotente: pode rodar quantas vezes quiser)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('live', 'live', true, 1048576, array['text/html', 'text/plain'])
on conflict (id) do update
  set public = true,
      file_size_limit = 1048576,
      allowed_mime_types = array['text/html', 'text/plain'];

-- 2) Sobe o viewer direto do repositorio (sem colar HTML na mao)
insert into storage.objects (bucket_id, name, content_type, content, owner)
select
  'live',
  'live.html',
  'text/html',
  convert_from(
    extensions.http_get(
      'https://raw.githubusercontent.com/cleberleonheart-maker/B-ssola-/main/web/live.html'
    )::bytea,
    'UTF8'
  ),
  (select auth.uid())
on conflict (bucket_id, name) do update
  set content = excluded.content,
      updated_at = now();

-- Como conferir:
--   select id, public from storage.buckets where id = 'live';
--   select name, length(content) from storage.objects where bucket_id = 'live';

-- ALTERNATIVA se extensions.http_get nao existir:
--   baixe https://raw.githubusercontent.com/cleberleonheart-maker/B-ssola-/main/web/live.html
--   e faca upload manual em Storage > live > New file.
