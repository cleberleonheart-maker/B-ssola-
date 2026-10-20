#!/usr/bin/env bash
# Teste de campo da dívida 55b: o START_REDELIVER_INTENT deve suster a morte
# do processo por memória (kill -9), que é o caminho que o force-stop NÃO
# cobre — force-stop marca o pacote como stopped e nenhum serviço se levanta.
#
# Pré-condições (preencher à mão antes de correr):
#   1. App instalado e aberto, com rastreio ao vivo ativo (SOS → compartilhar).
#   2. O link live.html aberto noutro aparelho/navegador a mostrar ● AO VIVO.
#   3. USB debugging ligado e `adb devices` a mostrar o aparelho.
#
# Uso: bash scripts/testar-55b.sh
set -euo pipefail

PKG=com.bussola.app

echo "== 55b: kill -9 no processo, sem force-stop =="

if ! adb get-state >/dev/null 2>&1; then
  echo "ERRO: nenhum aparelho adb. Ligue o aparelho e ative USB debugging."
  exit 1
fi

PID=$(adb shell pidof -s "$PKG" 2>/dev/null | tr -d '\r' || true)
if [ -z "$PID" ]; then
  echo "ERRO: o app ($PKG) não está a correr. Abra o app e inicie um rastreio ao vivo."
  exit 1
fi

echo "PID antes: $PID"
echo "A matar o processo (kill -9)…"
adb shell kill -9 "$PID"

echo "A esperar 15 s para o sistema recriar o processo…"
sleep 15

NEW_PID=$(adb shell pidof -s "$PKG" 2>/dev/null | tr -d '\r' || true)
if [ -z "$NEW_PID" ]; then
  echo "FALHOU: o processo não foi recriado em 15 s."
  echo "Verifique no viewer se o link caiu em ● SEM SINAL (esperado: ● AO VIVO)."
  exit 1
fi

echo "PID depois: $NEW_PID"
if [ "$NEW_PID" = "$PID" ]; then
  echo "NOTA: mesmo PID — o kill pode não ter pegado; confirme no logcat."
else
  echo "OK: processo recriado com PID novo."
fi

echo
echo "Próximo passo (à mão, no viewer): confirme que o link continua em ● AO VIVO"
echo "em vez de ● SEM SINAL. Se continuar ao vivo, o onStartCommand está a fazer"
echo "o que deve e a dívida 55b pode ser fechada em ideias.md."
