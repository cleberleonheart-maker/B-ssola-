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
# o assembleRelease aborta. A chave de producao esta no CI (secrets) e numa
# copia cifrada fora do aparelho -- nunca mais se le um ficheiro de senha do
# disco. Build local de release e um caminho excepcional: defina
# ANDROID_KEYSTORE_* no ambiente e aponte o keystore para um ficheiro de
# descarte, nunca para o mesmo que assina o que os utilizadores ja tem.
if [ -z "${ANDROID_KEYSTORE_FILE:-}" ]; then
  [ -f "${HOME}/.bussola-keystore/bussola-release.keystore" ] && {
    echo "AVISO: existe uma chave de producao em ~/.bussola-keystore/ e o script" >&2
    echo "       ja nao a usa. Apague-a de vez, ou um APK assinado por engano" >&2
    echo "       sai com a chave que actualiza o app de toda a gente." >&2
  }
  echo "Assinatura de release so no CI: defina ANDROID_KEYSTORE_* para um" >&2
  echo "keystore de descarte, ou use o CI (que tem a chave de producao)." >&2
  exit 1
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
ASSET="bussola-v$VERSION_CODE.apk"
if gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name' 2>/dev/null \
  | grep -qx "$ASSET"; then
  if [ "${REPUBLICAR:-0}" = "1" ]; then
    # Saida de emergencia, e e' deliberadamente explicita: o APK publicado de
    # uma versao nao se substitui. Quem ja' o instalou tem os bytes antigos,
    # e trocar o ficheiro faz o digest rodiar — o hash que o repositorio
    # guarda deixa de bater e o app da' "hash nao bate certo" a quem tenta
    # atualizar. Um APK novo e' uma versao nova: sobe o versionCode.
    #
    # Para substituir este mesmo asset (APK publicado que saiu partido), o
    # caminho e' apagar o asset e deixar o CI publicar de novo — e depois
    # re-pinar o repositorio com o sha256 novo.
    echo "AVISO: a substituir o asset $ASSET ja' publicado (REPUBLICAR=1)." >&2
    echo "       Quem ja' o instalou fica com os bytes antigos; o hash muda." >&2
    gh release upload "$TAG" "$TMP_APK" --repo "$REPO" --clobber
  else
    echo "ERRO: o asset $ASSET ja' esta publicado e um APK publicado nao se substitui." >&2
    echo "      Quem ja' o instalou tem-no, e trocar os bytes faz o hash divergir" >&2
    echo "      (a app recusa-se a instalar). Para publicar outra vez, sobe o" >&2
    echo "      versionCode em android/app/version.properties." >&2
    echo "      Para substituir este mesmo asset, a proposito: REPUBLICAR=1 ./publicar.sh" >&2
    exit 1
  fi
elif gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "$TMP_APK" --repo "$REPO"
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