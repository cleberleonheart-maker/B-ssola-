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

SQL="update app_version
set version_code = $VERSION_CODE,
    version_name = '$VERSION_NAME',
    update_url = '$UPDATE_URL',
    message = '$MESSAGE',
    required = $REQUIRED
where id = 1;"

if [ -n "$SERVICE_KEY" ]; then
  echo "==> Gravando direto no Supabase (service_role key)"
  curl -fsS -X PATCH "$SUPABASE_URL/rest/v1/app_version?id=eq.1" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"version_code\":$VERSION_CODE,\"version_name\":\"$VERSION_NAME\",\"update_url\":\"$UPDATE_URL\",\"message\":\"$MESSAGE\",\"required\":$REQUIRED}" \
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