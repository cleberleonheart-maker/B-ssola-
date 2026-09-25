-- 1) Cria o bucket publico 'live' (idempotente)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('live', 'live', true, 1048576, array['text/html', 'text/plain'])
on conflict (id) do update
  set public = true,
      file_size_limit = 1048576,
      allowed_mime_types = array['text/html', 'text/plain'];

-- 2) Sobe o viewer. NOTE: storage.objects nao tem coluna content_type;
--    o mime type fica em metadata (jsonb).
insert into storage.objects (bucket_id, name, owner, metadata, content)
select
  'live',
  'live.html',
  (select auth.uid()),
  jsonb_build_object(
    'mtime', now(),
    'cacheControl', '3600',
    'contentType', 'text/html'
  ),
  convert_from(
    extensions.http_get(
      'https://raw.githubusercontent.com/cleberleonheart-maker/B-ssola-/main/web/live.html'
    )::bytea,
    'UTF8'
  )
on conflict (bucket_id, name) do update
  set content    = excluded.content,
      metadata   = excluded.metadata,
      updated_at = now();

-- Como conferir:
--   select id, public from storage.buckets where id = 'live';
--   select name, length(content) as bytes from storage.objects where bucket_id = 'live';

-- Se extensions.http_get nao existir: baixe
--   https://raw.githubusercontent.com/cleberleonheart-maker/B-ssola-/main/web/live.html
-- e faca upload manual em Storage > live > New file.
