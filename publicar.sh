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