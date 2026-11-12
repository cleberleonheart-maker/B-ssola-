-- =====================================================================
-- app_version: a linha que o app consulta para saber que ha versao nova.
--
-- Gerado por scripts/publicar-supabase.sh. Copie e cole no SQL Editor quando
-- nao ha chave de escrita; com chave, o script grava isto direto.
--
-- O 'where version_code <= 211' e o que impede que este ficheiro,
-- que fica desatualizado entre releases, rebaixe o ponteiro que a release
-- acabou de gravar. Sem ele, o workflow "Schema do Supabase" - que aplica os
-- scripts/*.sql em qualquer commit que os toque - voltava a por a versao
-- antiga na nuvem, e a linha ficava a dizer 197 com o hash do APK 210.
-- =====================================================================
update app_version
set version_code = 211,
    version_name = '7.80',
    update_url = 'https://github.com/cleberleonheart-maker/B-ssola-/releases/download/bussola-apk/bussola-v211.apk',
    message = 'Nova versão disponível',
    required = false,
    apk_sha256 = 'f2b3bbedc19cfb3d3a0609d4512644c3beb0154fd1da9db89b07c05934324ff1'
where id = 1 and version_code <= 211;
