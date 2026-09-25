-- ============================================================
-- content-type do viewer (#24)
-- ATENCAO: rode SOMENTE este bloco. A query de conferencia
-- anterior usava a coluna content_type, que nao existe nesta
-- versao do Supabase, e fazia o SQL Editor reverter tudo.
-- Para conferir depois, use metadata->>'contentType'.
-- ============================================================
update storage.objects
set metadata = jsonb_build_object(
  'mtime', now(),
  'cacheControl', 'max-age=300',
  'contentType', 'text/html'
)
where bucket_id = 'live' and name = 'live.html';
