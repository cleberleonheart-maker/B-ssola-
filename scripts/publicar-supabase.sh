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
APK_SHA256=$(gh release view "$TAG" --repo "$REPO" --json assets --jq \
  ".assets[] | select(.name == \"bussola-v$VERSION_CODE.apk\") | .digest" \
  2>/dev/null | sed -E 's/^sha256://' | tr 'A-Z' 'a-z' || true)

if ! printf '%s' "$APK_SHA256" | grep -qE '^[0-9a-f]{64}$'; then
  echo "Aviso: nao consegui ler o digest do asset bussola-v$VERSION_CODE.apk." >&2
  APK_SHA256=""
fi

# O `version_code <= $VERSION_CODE` e o que impede que este ficheiro, que fica
# desatualizado entre releases, rebaixe o ponteiro que a release acabou de
# gravar na nuvem. Sem ele, o workflow "Schema do Supabase" (que aplica os
# scripts/*.sql em qualquer commit que os toque) voltava a por a versao
# antiga — e a linha ficava a dizer 197 com o hash do APK 210.
#
# A coluna do hash escreve-se SEMPRE, mesmo quando nao ha digest para meter
# nela: nesse caso vai a null. O motivo e' o contrario do que parece — um
# `update` que omita a coluna nao a limpa, deixa-a como estava. A linha ficava
# a dizer "v212" com o hash do APK 211, e o app comparava o ficheiro novo com
# o hash de outro e recusava-se a instalar ("hash nao bate certo"). O `null`
# quer dizer "ninguem sabe", que e' honesto: o app usa o digest que a GitHub
# calcula por asset.
if [ -n "$APK_SHA256" ]; then
  SHA_COLUMN=",
    apk_sha256 = '$APK_SHA256'"
else
  SHA_COLUMN=",
    apk_sha256 = null"
fi

SQL="-- =====================================================================
-- app_version: a linha que o app consulta para saber que ha versao nova.
--
-- Gerado por scripts/publicar-supabase.sh. Copie e cole no SQL Editor quando
-- nao ha chave de escrita; com chave, o script grava isto direto.
--
-- O 'where version_code <= $VERSION_CODE' e o que impede que este ficheiro,
-- que fica desatualizado entre releases, rebaixe o ponteiro que a release
-- acabou de gravar. Sem ele, o workflow \"Schema do Supabase\" - que aplica os
-- scripts/*.sql em qualquer commit que os toque - voltava a por a versao
-- antiga na nuvem, e a linha ficava a dizer 197 com o hash do APK 210.
-- =====================================================================
update app_version
set version_code = $VERSION_CODE,
    version_name = '$VERSION_NAME',
    update_url = '$UPDATE_URL',
    message = '$MESSAGE',
    required = $REQUIRED$SHA_COLUMN
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
  curl -fsS -X PATCH "$SUPABASE_URL/rest/v1/app_version?id=eq.1" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$BODY" \
    >/tmp/app_version_reply.json
  if grep -q "\"version_code\":$VERSION_CODE" /tmp/app_version_reply.json; then
    echo "OK: app_version atualizado para $VERSION_CODE ($VERSION_NAME)"
  else
    echo "Falha ao gravar no Supabase (RLS ou linha nao encontrada)." >&2
    exit 1
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