-- =====================================================================
-- app_version.apk_sha256: o hash do APK que o CI acabou de publicar.
-- Corre no SQL Editor do Supabase. Roda mais do que uma vez sem estragar.
--
-- Para que serve, e porque uma coluna parece pouca coisa:
-- o app já sabia que o link era https, o que resolve um servidor falso. O que
-- ficava por resolver era o binario trocado no caminho. Agora o app compara o
-- ficheiro que desceu com DUAS fontes, feitas por quem nao e o app: o `digest`
-- que a GitHub calcula por asset, e este campo, que o CI escreve no mesmo
-- instante em que publica. Alguem que consiga trocar um so dos lados esbarra
-- na comparacao; teria de trocar os dois.
--
-- Sem esta coluna o build continua a publicar (o CI tenta o PATCH, e se falhar
-- repete sem o campo), mas o app fica so com uma fonte de hash.
-- =====================================================================
alter table public.app_version
  add column if not exists apk_sha256 text;

comment on column public.app_version.apk_sha256 is
  'SHA-256 do APK publicado, gravado pelo CI. Segunda fonte, a par do digest da GitHub.';

-- Verificar depois de correr:
--   select version_code, apk_sha256 from public.app_version;
-- Deve vir preenchido a partir da proxima release. Os valores antigos ficam
-- null, e o app trata null como "ninguem sabe", nao como "bater certo".
