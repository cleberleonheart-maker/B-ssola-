#!/usr/bin/env bash
# Atualiza a tabela 'app_version' do Supabase com a versao publicada.
# A chave vem de SUPABASE_SERVICE_ROLE_KEY (env) ou de ~/.supabase-service-key.
# Sem chave, apenas gera scripts/app_version.sql para copiar/colar no dashboard.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="cleberleonheart-maker/B-ssola-"
TAG="bussola-apk"
PROPS="$ROOT/android/app/version.properties"

SUPABASE_URL="${SUPABASE_URL:-https://wotzcykrvidbjkonaawx.supabase.co}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [ -z "$SERVICE_KEY" ] && [ -f "$HOME/.supabase-service-key" ]; then
  SERVICE_KEY="$(cat "$HOME/.supabase-service-key")"
fi

VERSION_CODE=$(grep -E '^versionCode=' "$PROPS" | cut -d'=' -f2)
VERSION_NAME=$(grep -E '^versionName=' "$PROPS" | cut -d'=' -f2)
UPDATE_URL="https://github.com/$REPO/releases/download/$TAG/bussola-v$VERSION_CODE.apk"
MESSAGE="${MESSAGE:-Nova versão disponível}"
REQUIRED="${REQUIRED:-false}"

if ! command -v gh >/dev/null; then
  echo "gh (GitHub CLI) nao instalado." >&2
  exit 1
fi

if ! gh release view "$TAG" --repo "$REPO" --json assets --jq \
  '.assets[].name' 2>/dev/null | grep -qx "bussola-v$VERSION_CODE.apk"; then
  echo "Aviso: bussola-v$VERSION_CODE.apk nao esta na release '$TAG' do GitHub." >&2
  echo "Publique o APK antes: ./publicar.sh" >&2
  exit 1
fi

# O SHA-256 do asset, como a GitHub o calcula. E a mesma fonte que o app usa
# quando a nuvem nao tem hash: se a linha da nuvem apontar para um APK e o
# hash for de outro, o app recusa-se a instalar ("hash nao bate certo") em vez
# de instalar um binario trocado no caminho.
#
# E a fonte que fica valida: o asset publicado de uma versao nao se substitui
# (ver .github/workflows/build-apk.yml), portanto o digest que a GitHub publica
# para a vNNN e' o mesmo para sempre, e o que este script le e' o que o app
# vai comparar.
APK_SHA256=$(gh release view "$TAG" --repo "$REPO" --json assets --jq \
  ".assets[] | select(.name == \"bussola-v$VERSION_CODE.apk\") | .digest" \
  2>/dev/null | sed -E 's/^sha256://' | tr 'A-Z' 'a-z' || true)

if ! printf '%s' "$APK_SHA256" | grep -qE '^[0-9a-f]{64}$'; then
  echo "Aviso: nao consegui ler o digest do asset bussola-v$VERSION_CODE.apk." >&2
  APK_SHA256=""
fi

# O hash escreve-se SEMPRE, mesmo quando nao ha digest para meter nela: nesse
# caso vai a null. O motivo e' o contrario do que parece — um `update` que
# omita a coluna nao a limpa, deixa-a como estava. A linha ficava a dizer
# "v212" com o hash do APK 211, e o app comparava o ficheiro novo com o hash
# de outro e recusava-se a instalar ("hash nao bate certo"). O `null` quer
# dizer "ninguem sabe", que e' honesto: o app usa o digest que a GitHub
# calcula por asset. Um hash em branco (string vazia) tambem nao serve de
# nada -- e ainda era pior, porque nao se distingue de "esquecido".
if [ -n "$APK_SHA256" ]; then
  SHA_LITERAL="'$APK_SHA256'"
else
  SHA_LITERAL="null"
fi

# O ficheiro que este script escreve tem DUAS guardas, e sao as duas que
# impedem que ele dane a linha da nuvem:
#
#   1. `where version_code <= N` — o ficheiro fica desatualizado entre
#      releases, e o workflow "Schema do Supabase" aplica-o em qualquer commit
#      que toque scripts/**. Sem a guarda, voltava a por a versao antiga na
#      nuvem — a linha ficava a dizer 197 com o hash do APK 210.
#
#   2. o `case` do hash — o hash so e' escrito quando a versao AVANCA. Com a
#      versao ja' em ca, o hash que esta la foi gravado pela release (que
#      conhece o asset publicado) e este ficheiro, que e' uma fotografia, nao o
#      substitui. Era a segunda via do mesmo bug: a linha dizia 211 com o hash
#      de um APK 211 diferente, o app dava "hash nao bate certo" e recusava-se
#      a instalar.
#
# O `case` le o `version_code` antigo (o Postgres avalia as expressoes do SET
# com os valores de antes da linha), que e' exactamente o que se quer: a linha
# estava na versao antiga? Entao avanca e grava o hash. Ja' estava na mesma
# versao? Entao o hash e' o da release e fica como esta.
SQL="-- =====================================================================
-- app_version: a linha que o app consulta para saber que ha versao nova.
--
-- Gerado por scripts/publicar-supabase.sh. Copie e cole no SQL Editor quando
-- nao ha chave de escrita; com chave, o script grava isto direto.
--
-- Duas guardas, e sao as duas que impedem que este ficheiro dane a linha da
-- nuvem. O workflow \"Schema do Supabase\" aplica os scripts/*.sql em qualquer
-- commit que os toque, e este ficheiro fica desatualizado entre releases:
--
--   1. 'where version_code <= $VERSION_CODE' — impede que a versao antiga
--      volte a ser reposta. Sem ela, a linha ficava a dizer 197 com o hash do
--      APK 210.
--
--   2. o 'case' do hash — o hash so e' escrito quando a versao AVANCA. Com a
--      versao ja' em ca, o hash que esta la foi gravado pela release (que
--      conhece o asset publicado, e o asset de uma versao nao se substitui) e
--      este ficheiro, que e' uma fotografia, nao o troca. Era a segunda via do
--      mesmo bug: a linha dizia 211 com o hash de um APK 211 diferente, o app
--      dava \"hash nao bate certo\" e recusava-se a instalar.
--
-- Para corrigir um hash que ficou errado, use o caminho que conhece o asset
-- publicado: ./scripts/publicar-supabase.sh
-- =====================================================================
update app_version
set version_code = $VERSION_CODE,
    version_name = '$VERSION_NAME',
    update_url = '$UPDATE_URL',
    message = '$MESSAGE',
    required = $REQUIRED,
    apk_sha256 = case when version_code < $VERSION_CODE then $SHA_LITERAL else apk_sha256 end
where id = 1 and version_code <= $VERSION_CODE;"

if [ -n "$SERVICE_KEY" ]; then
  echo "==> Gravando direto no Supabase (service_role key)"
  # O `apk_sha256` entra sempre no PATCH, mesmo sem digest: um PATCH que o
  # omite nao limpa a coluna, deixa o hash da release anterior na linha, e
  # o app passa a recusar-se a instalar por causa de um hash que ja nao
  # pertence ao APK apontado. Com `null` o app diz "ninguem sabe" e usa o
  # digest que a GitHub calcula por asset.
  BODY="{\"version_code\":$VERSION_CODE,\"version_name\":\"$VERSION_NAME\",\"update_url\":\"$UPDATE_URL\",\"message\":\"$MESSAGE\",\"required\":$REQUIRED"
  if [ -n "$APK_SHA256" ]; then
    BODY="$BODY,\"apk_sha256\":\"$APK_SHA256\""
  else
    BODY="$BODY,\"apk_sha256\":null"
  fi
  BODY="$BODY}"
  # O filtro `version_code=lte.$VERSION_CODE` e' a outra metade da guarda: um
  # run antigo (ou um script corigido a posteriori) nao pode rebaixar o
  # ponteiro que uma release mais nova ja' gravou. Com o filtro, o PATCH nao
  # toca em linhas mais novas — e o `[]` na resposta diz isso mesmo.
  RESPOSTA=$(curl -fsS -X PATCH \
    "$SUPABASE_URL/rest/v1/app_version?id=eq.1&version_code=lte.$VERSION_CODE" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$BODY")
  if [ -z "$RESPOSTA" ] || [ "$RESPOSTA" = "[]" ]; then
    ATUAL=$(curl -fsS \
      "$SUPABASE_URL/rest/v1/app_version?select=version_code&limit=1" \
      -H "apikey: $SERVICE_KEY" \
      -H "Authorization: Bearer $SERVICE_KEY" || true)
    echo "AVISO: a linha da nuvem nao foi tocada (ela esta em ${ATUAL:-desconhecido})." >&2
    echo "        Nao a rebaixo: se a nuvem ja' esta' numa versao mais nova, e' essa que fica." >&2
  else
    echo "OK: app_version atualizado para $VERSION_CODE ($VERSION_NAME)"
  fi
else
  echo
  echo "Sem chave de escrita. Para automatizar de vez, guarde a chave uma unica vez:"
  echo "  1. Supabase > Settings > API keys > service_role (fica em \"reveal\")."
  echo "  2. echo 'SUA_CHAVE' > ~/.supabase-service-key && chmod 600 ~/.supabase-service-key"
  echo "A proxima publicacao grava sozinha. Sem a chave, use scripts/app_version.sql."
fi

printf '%s\n' "$SQL" > "$ROOT/scripts/app_version.sql"
echo
echo "SQL salvo em scripts/app_version.sql (se nada foi gravado, copie no SQL editor)."
