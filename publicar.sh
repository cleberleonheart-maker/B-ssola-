#!/usr/bin/env bash
set -eu

ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="cleberleonheart-maker/B-ssola-"
TAG="bussola-apk"
ROOT_GRADLE="$ROOT/android"
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
LOG="/tmp/bussola-publicar.log"

if ! command -v gh >/dev/null; then
  echo "gh (GitHub CLI) nao instalado."; exit 1
fi

# O build.gradle nao tem fallback para o keystore de debug: sem estas variaveis
# o assembleRelease aborta. O keystore local de producao vive em
# ~/.bussola-keystore/ (fora do repo, junto de password.txt e do alias).
KEYSTORE_DIR="${BUSSOLA_KEYSTORE_DIR:-$HOME/.bussola-keystore}"
if [ -z "${ANDROID_KEYSTORE_FILE:-}" ]; then
  [ -f "$KEYSTORE_DIR/bussola-release.keystore" ] || {
    echo "Keystore de producao nao encontrado em $KEYSTORE_DIR." >&2
    echo "Use o CI (secrets) ou defina ANDROID_KEYSTORE_* no ambiente." >&2
    exit 1
  }
  [ -f "$KEYSTORE_DIR/password.txt" ] || {
    echo "Senha do keystore nao encontrada: $KEYSTORE_DIR/password.txt" >&2
    exit 1
  }
  export ANDROID_KEYSTORE_FILE="$KEYSTORE_DIR/bussola-release.keystore"
  export ANDROID_KEYSTORE_PASSWORD="$(cat "$KEYSTORE_DIR/password.txt")"
  export ANDROID_KEY_ALIAS="${ANDROID_KEY_ALIAS:-bussola}"
  export ANDROID_KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-$ANDROID_KEYSTORE_PASSWORD}"
fi

echo "==> BUILD (assembleRelease)"
cd "$ROOT_GRADLE"
./gradlew assembleRelease -x lint -x test

[ -f "$APK" ] || { echo "APK nao gerado: $APK"; exit 1; }

VERSION_CODE=$(grep -E '^versionCode=' "$ROOT_GRADLE/app/version.properties" | cut -d'=' -f2)
VERSION_NAME=$(grep -E '^versionName=' "$ROOT_GRADLE/app/version.properties" | cut -d'=' -f2)
TMP_APK="/tmp/bussola-v$VERSION_CODE.apk"
cp "$APK" "$TMP_APK"
SIZE=$(du -h "$TMP_APK" | cut -f1)
echo "==> APK: $SIZE (codigo $VERSION_CODE, nome $VERSION_NAME)"

echo "==> CONFERINDO a assinatura"
CERTS="$ROOT_GRADLE/app/release-cert.sha256"
APKSIGNER=$(ls -1d "${ANDROID_HOME:-$HOME/android-sdk}"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1 || true)
if [ -z "$APKSIGNER" ]; then
  echo "apksigner nao encontrado; instale build-tools ou defina ANDROID_HOME"
  exit 1
fi
# $NF: o prefixo da linha varia entre versoes do apksigner
# ("Signer #1 certificate..." vs "V2 Signer: certificate...").
norm() { tr -d ' \n\r:' | tr 'A-Z' 'a-z'; }
EXPECTED=$(norm < "$CERTS")
FOUND=$("$APKSIGNER" verify --print-certs "$TMP_APK" \
  | awk -F': ' '/certificate SHA-256 digest/ {print $NF}' | norm)
if [ "$FOUND" != "$EXPECTED" ]; then
  echo "APK assinado com a chave errada."
  echo "  esperado: $EXPECTED"
  echo "  obtido:   $FOUND"
  echo "Um APK com outra chave nao atualiza por cima do app ja instalado."
  exit 1
fi
echo "assinatura conferida: $EXPECTED"

echo "==> PUBLICANDO no GitHub"
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "$TMP_APK" --repo "$REPO" --clobber
else
  gh release create "$TAG" "$TMP_APK" --repo "$REPO" \
    --title "Bussola APK ($VERSION_NAME, cod $VERSION_CODE)" \
    --notes "APK release do app Bussola. Baixe o ultimo asset."
fi

echo ""
echo "APK publicado ($SIZE):"
echo "  https://github.com/$REPO/releases/tag/$TAG"
echo ""
echo "==> Atualizando app_version no Supabase"
if bash scripts/publicar-supabase.sh; then
  echo "  (app_version no Supabase atualizado)"
else
  echo "  (sem chave de escrita -> nao gravou; use scripts/app_version.sql)" >&2
  echo "  rode: git add scripts/app_version.sql && git commit -m \"app_version\" && git push" >&2
fi