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
#   ASSET=bussola-v209.apk bash validar-termux.sh
#
# A instalação é por cima ("-r") e o APK é do mesmo key de produção: os pontos,
# as notas, o PIN e o levantamento de EMF ficam como estavam.
set -euo pipefail

PKG="com.bussola.app"
ACT="$PKG/.MainActivity"
REPO="cleberleonheart-maker/B-ssola-"
ASSET="${ASSET:-bussola-v209.apk}"
SHA="${SHA:-dd521f8b4d0922c6b496d9f3b46fefbb18bf6f4e7dd8c9cb7c35519708261689}"
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
1. "What was done": in build 209 there should be 3 lines — the SOS without the
   app open, attack mode and track shared by link.
2. Attack mode: in Settings > SOS, tap "📨 Quiet SMS sending" and allow the
   permission. Put the "🚨 SOS" tile in the Quick Settings panel and lock the
   phone. Tap the tile: the app must NOT open, the screen must not light up,
   and a quiet notification must count 10 seconds with a "Cancel" button.
   When the countdown ends the alert must go out by SMS to the saved contact,
   with the last position and the battery, and the phone stays locked. Test
   "Cancel" as well: cancel after a few seconds and check no SMS went out.
   (With no emergency contact saved, the tile must open the app on the
   emergency screen.)
   Inside the app, the "🚨 Quiet SOS" button still counts 5 seconds and sends
   the alert with the live tracking link.
3. Sharing by link: record a track (Track > record > stop), tap "Link" next to
   GPX and pick a share app. The link is
   https://cleberleonheart-maker.github.io/B-ssola-/gpx.html#tkn=... — open it
   on another phone (or in a computer browser): it must show the route drawn,
   the distance and the "Download the GPX" button. The downloaded GPX must
   open in a maps app. The link stops working after 30 days.
4. Tiles: desce o painel de Definições Rápidas e abre a edição (o lápis ou os
   dois dedos); arrasta os tiles da Bússola para o painel — Bússola, AR, Nível,
   Detector, EMF, Sol, Trilha e Triângulo. Toca num deles: a app tem de abrir
   já no modo desse tile (sem passar pelo menu de modos). E em Definições >
   Bússola > "Tiles das Definições Rápidas": o diálogo deve listar os 19
   tiles (um por modo) e dizer quais já estão no painel.
5. Calibração por estrela: Definições > Bússola > "⭐ Calibrar por estrela"
   (à noite, céu limpo): a app lista as estrelas que estão no horizonte —
   no Brasil, a Cruz do Sul, Canopus, Sirius, Achernar — e diz a altura e o
   azimute de cada uma. Escolhe uma, aponta a câmara (em retrato): a mira
   diz quanto falta para virar e levantar; quando a estrela ficar no centro,
   toca "Medir declinação" e o resultado deve aparecer em segundos.
   Se a estrela estiver demasiado alta ou baixa, a app avisa e não mede.
6. Widget: no ecrã principal, toca no botão do widget — sem rastreio a correr
   abre a app no ecra de emergência; com rastreio a correr, para-o sem abrir
   a app (o botão fica vermelho).
5. Re-lock: com PIN definido, sai da app, espera 30 s e volta — tem de pedir
   o PIN outra vez.
GUIA
