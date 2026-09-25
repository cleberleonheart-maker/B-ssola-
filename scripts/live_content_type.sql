-- ============================================================
-- sobe o content-type do viewer (endpoint publico le metadata)
-- rode no SQL Editor
-- ============================================================
update storage.objects
set metadata = jsonb_build_object(
  'mtime', now(),
  'cacheControl', 'max-age=300',
  'contentType', 'text/html'
)
where bucket_id = 'live' and name = 'live.html';

-- conferir
select name, content_type, metadata
from storage.objects
where bucket_id = 'live' and name = 'live.html';
