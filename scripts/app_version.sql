-- =====================================================================
-- app_version: a linha que o app consulta para saber que ha versao nova.
--
-- Gerado por scripts/publicar-supabase.sh. Copie e cole no SQL Editor quando
-- nao ha chave de escrita; com chave, o script grava isto direto.
--
-- Duas guardas, e sao as duas que impedem que este ficheiro dane a linha da
-- nuvem. O workflow "Schema do Supabase" aplica os scripts/*.sql em qualquer
-- commit que os toque, e este ficheiro fica desatualizado entre releases:
--
--   1. 'where version_code <= 211' — impede que a versao antiga
--      volte a ser reposta. Sem ela, a linha ficava a dizer 197 com o hash do
--      APK 210.
--
--   2. o 'case' do hash — o hash so e' escrito quando a versao AVANCA. Com a
--      versao ja' em ca, o hash que esta la foi gravado pela release (que
--      conhece o asset publicado, e o asset de uma versao nao se substitui) e
--      este ficheiro, que e' uma fotografia, nao o troca. Era a segunda via do
--      mesmo bug: a linha dizia 211 com o hash de um APK 211 diferente, o app
--      dava "hash nao bate certo" e recusava-se a instalar.
--
-- Para corrigir um hash que ficou errado, use o caminho que conhece o asset
-- publicado: ./scripts/publicar-supabase.sh
-- =====================================================================
update app_version
set version_code = 211,
    version_name = '7.80',
    update_url = 'https://github.com/cleberleonheart-maker/B-ssola-/releases/download/bussola-apk/bussola-v211.apk',
    message = 'Nova versão disponível',
    required = false,
    apk_sha256 = case when version_code < 211 then '386cb3472fb31f3a5f2ed2f748f99d0e4e1a9f63d48691f3a05dca8cfeecd2f7' else apk_sha256 end
where id = 1 and version_code <= 211;
