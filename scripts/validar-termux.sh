#!/usr/bin/env bash
# Instala e valida o APK a partir do Termux, no próprio telemóvel.
#
# O `scripts/validar-apk.sh` precisa de adb e de USB; este não precisa de nada
# disso: corre no Termux do mesmo aparelho que vai usar a app. É o caminho
# quando o telemóvel não está ligado ao computador.
#
# Uso (no Termux do telemóvel):
#   bash validar-termux.sh                 # descarrega o APK do release e instala
#   bash validar-termux.sh caminho.apk     # instala um APK já descarregado
#   ASSET=bussola-v201.apk bash validar-termux.sh
#
# A instalação é por cima ("-r") e o APK é do mesmo key de produção: os pontos,
# as notas, o PIN e o levantamento de EMF ficam como estavam.
set -euo pipefail

PKG="com.bussola.app"
ACT="$PKG/.MainActivity"
REPO="cleberleonheart-maker/B-ssola-"
ASSET="${ASSET:-bussola-v200.apk}"
SHA="${SHA:-dd748a13a872b7e9a9e3235159597583d90fa9d8bcaa1464a89e0809c0d18f13}"
DIR="${DIR:-$HOME/bussola}"

APK="${1:-$DIR/$ASSET}"

mkdir -p "$DIR"

if [ ! -f "$APK" ]; then
  echo "== a descarregar $ASSET =="
  curl -fL --retry 3 -o "$APK" \
    "https://github.com/$REPO/releases/download/bussola-apk/$ASSET"
fi

if command -v sha256sum >/dev/null 2>&1 && [ -n "$SHA" ]; then
  echo
  echo "== a verificar a assinatura do ficheiro =="
  obtido=$(sha256sum "$APK" | cut -d' ' -f1)
  if [ "$obtido" != "$SHA" ]; then
    echo "ERRO: o sha256 não bate."
    echo "  esperado: $SHA"
    echo "  obtido:   $obtido"
    echo "O download está por acabar ou o ficheiro foi trocado. Apaga $APK e repete."
    exit 1
  fi
  echo "OK: $obtido"
fi

echo
echo "== a instalar =="
# `pm` é o gestor de pacotes do Android; a partir do Termux instala-se o
# próprio app, que fica em /data/app (sem precisar de root).
if command -v pm >/dev/null 2>&1; then
  pm install -r "$APK" || pm install -r -d "$APK"
else
  echo "ERRO: 'pm' não está disponível neste shell."
  echo "Alternativa: abre o ficheiro $APK com o gestor de ficheiros e confirma a instalação."
  exit 1
fi

echo
echo "== versão instalada =="
if command -v dumpsys >/dev/null 2>&1; then
  dumpsys package "$PKG" 2>/dev/null \
    | grep -E "versionCode=|versionName=" | head -2 || true
fi

echo
echo "== a abrir a app =="
am start -n "$ACT" >/dev/null 2>&1 || monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true

echo
echo "== se algo correr mal, os logs estão aqui =="
echo "   logcat -s ReactNativeJS:V AndroidRuntime:E | tail -100"
echo
echo "== o guião (à mão, no aparelho) =="
cat <<'GUIA'
1. "O que foi feito": no build 200 deve aparecer 1 linha — levantamento de EMF
   no mapa.
2. Modo 🧲 EMF: toca "🖍️ Marcar leitura" com o GPS ligado; o ponto deve
   aparecer no mapa do painel "Levantamento EMF", com a cor do nível.
3. Re-lock: com PIN definido, sai da app, espera 30 s e volta — tem de pedir
   o PIN outra vez.
GUIA
