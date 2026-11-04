#!/usr/bin/env bash
# Smoke test do APK no aparelho: instala, arranca, vigia o logcat e diz se
# houve crash.
#
# Só cobre o que é automático. O que precisa de olhos — biometria, re-lock ao
# voltar do fundo, beacon por SMS, abas da triangulação — fica no guião
# escrito, porque nenhuma máquina sabe se a impressão digital destravou.
#
# Uso:
#   bash scripts/validar-apk.sh                    # usa o APK do release 200
#   bash scripts/validar-apk.sh /caminho/app.apk   # usa um APK local
#   SKIP_INSTALL=1 bash scripts/validar-apk.sh     # não instala, só vigia
#
# Sem adb (o telemóvel trabalha pelo Termux) há o `scripts/validar-termux.sh`,
# que corre no próprio aparelho e não precisa de USB.
#
# O APK é do mesmo key de produção, por isso a instalação é por cima: os
# dados do utilizador (pontos, notas, PIN) ficam como estavam.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="com.bussola.app"
ACT="$PKG/.MainActivity"
REPO="cleberleonheart-maker/B-ssola-"
ASSET="bussola-v202.apk"
SHA="d4b470f7bd6e2663af68fb98586e528a4c2cee35d341e715a912b8226f9cc27e"
VIGIA_S=45

APK="${1:-}"
if [ -z "$APK" ]; then
  APK="/tmp/$ASSET"
  if [ ! -f "$APK" ]; then
    echo "== a descarregar $ASSET do release =="
    curl -fsSL -o "$APK" \
      "https://github.com/$REPO/releases/download/bussola-apk/$ASSET"
  fi
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "ERRO: adb não está instalado."
  echo "Sem adb? Corre scripts/validar-termux.sh no Termux do próprio telemóvel."
  exit 1
fi

if ! adb get-state >/dev/null 2>&1; then
  echo "ERRO: nenhum aparelho adb. Ligue o aparelho e ative USB debugging."
  exit 1
fi

echo "== aparelho =="
adb shell getprop ro.product.model | tr -d '\r'
adb shell getprop ro.build.version.release | tr -d '\r'

echo
echo "== a verificar a assinatura do ficheiro =="
OBTIDO=$(sha256sum "$APK" | cut -d' ' -f1)
if [ "$OBTIDO" != "$SHA" ]; then
  echo "ERRO: o sha256 não bate (esperado $SHA, obtido $OBTIDO)."
  exit 1
fi
echo "OK: $OBTIDO"

if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  echo
  echo "== a instalar $APK =="
  adb install -r "$APK" 2>&1 | tail -2
fi

echo
echo "== versão instalada =="
# dumpsys mostra o versionCode que o PackageManager tem registado.
adb shell dumpsys package "$PKG" | tr -d '\r' \
  | grep -E "versionCode=|versionName=" | head -2

echo
echo "== a limpar o logcat e a arrancar =="
adb logcat -c
adb shell am start -S -n "$ACT" 2>&1 | tail -2 | tr -d '\r'

echo
echo "== a vigiar $VIGIA_S s =="
for i in $(seq 1 $((VIGIA_S / 5))); do
  sleep 5
  printf "t+%02ds  %s\n" "$((i * 5))" \
    "$(adb shell pidof -s "$PKG" 2>/dev/null | tr -d '\r' || echo 'processo morto')"
done

echo
echo "== crashes no logcat =="
CRASHES=$(adb logcat -d -v brief 2>/dev/null \
  | grep -E "FATAL EXCEPTION|AndroidRuntime.*com\.bussola|ReactNativeJS.*(Error|Exception)" \
  | head -20 || true)
if [ -z "$CRASHES" ]; then
  echo "OK: nenhum crash no logcat."
else
  echo "$CRASHES"
  echo
  echo "FALHOU: há crashes — a app fechou ou o erro foiLogged."
fi

echo
echo "== o guião que falta (à mão, no aparelho) =="
cat <<'GUIA'
1. "O que foi feito": no build 202 devem aparecer 2 linhas — Estrela Polar
   e widget com partilha.
2. Estrela Polar: Definições > Bússola > "⭐ Calibrar pela Estrela Polar" (à
   noite, céu limpo): aponta a câmara à Polaris — a mira diz a altura a que
   ela está e quanto falta para virar e levantar; quando ficar no centro,
   toca "Medir declinação" e o resultado deve aparecer em segundos.
3. Widget: no ecrã principal, toca no botão do widget — sem rastreio a correr
   abre a app no ecra de emergência; com rastreio a correr, para-o sem abrir
   a app (o botão fica vermelho).
4. Bloqueio: define um PIN (Configurações > Segurança), sai da app, abre outra
   vez (pede o PIN), espera 30 s fora da app e volta (pede o PIN outra vez).
5. SOS: põe um contacto em Configurações > SOS e liga o beacon; quando a
   notificação aparecer, toca nela: abre o SMS com a posição, a bateria e a
   rede já escritas.
GUIA
