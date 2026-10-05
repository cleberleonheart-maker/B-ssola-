#!/usr/bin/env bash
# Aplica um ficheiro de scripts/*.sql na nuvem do Supabase. Fecha a ideia #87:
# as RPCs e as tabelas deixavam de ser copiadas a mao para o SQL Editor.
#
#   ./scripts/publicar-sql.sh scripts/live_rls.sql
#   ./scripts/publicar-sql.sh --verificar      # so olhar, nao escreve
#
# PORQUE NAO BASTA A service_role (a ideia #87 sugeria isso, e nao dá):
# a service_role salta a RLS das linhas, mas continua a ser um cliente de REST.
# O PostgREST so fala REST -- SELECT/INSERT/UPDATE/DELETE em tabelas que ja
# existem. Criar tabela, criar funcao, dar grant e alterar coluna sao DDL, e o
# unico caminho de verdade para o DDL e:
#   1. a Management API, com um personal access token da conta
#      (https://api.supabase.com/v1/projects/<ref>/database/query), ou
#   2. uma ligacao directa ao Postgres (psql), que e o que o SQL Editor faz.
# Nenhum dos dois e a service_role. Sem uma das duas chaves, este script imprime
# o ficheiro e sai com erro -- em vez de fingir que publizou.
#
# As chaves, por ordem de procura:
#   SUPABASE_ACCESS_TOKEN  (env, ou ~/.supabase-access-token)  -> Management API
#   SUPABASE_DB_URL       (env, ou ~/.supabase-db-url)        -> psql
# O token da conta da o mesmo poder que a pessoa que o cria: e como a chave de
# producao do APK, e so serve nisto. O ficheiro em ~/. e o unico sítio em que
# ele aparece em claro neste repositorio.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ "${1:-}" = "--verificar" ]; then
  exec "$ROOT/scripts/verificar-nuvem.sh" --strict
fi

if [ $# -lt 1 ]; then
  echo "uso: $0 <ficheiro.sql> [outro.sql ...]" >&2
  echo "     $0 --verificar" >&2
  exit 2
fi

SUPABASE_URL="${SUPABASE_URL:-https://wotzcykrvidbjkonaawx.supabase.co}"
# O ref do project e o primeiro rotulo do host: wotzcykrvidbjkonaawx em
# https://wotzcykrvidbjkonaawx.supabase.co. A Management API pede o ref, nao a URL.
PROJECT_REF="${SUPABASE_PROJECT_REF:-$(printf '%s' "$SUPABASE_URL" | sed -E 's#^https?://##; s#\..*$##')}"

ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
if [ -z "$ACCESS_TOKEN" ] && [ -f "$HOME/.supabase-access-token" ]; then
  ACCESS_TOKEN="$(cat "$HOME/.supabase-access-token")"
fi

DB_URL="${SUPABASE_DB_URL:-}"
if [ -z "$DB_URL" ] && [ -f "$HOME/.supabase-db-url" ]; then
  DB_URL="$(cat "$HOME/.supabase-db-url")"
fi

json_query() {
  # O SQL vai inteiro num campo JSON, com aspas e quebras de linha. jq quando
  # existe, python3 quando nao: um payload mal escapado da uma resposta de erro
  # que nao tem nada a ver com o SQL.
  if command -v jq >/dev/null; then
    jq -Rs '{query: .}' < "$1"
  elif command -v python3 >/dev/null; then
    python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$1"
  else
    echo "Preciso de jq ou python3 para montar o pedido." >&2
    exit 2
  fi
}

aplicar_com_api() {
  local ficheiro="$1" tmp="$1.json" resposta
  json_query "$ficheiro" > "$tmp"
  resposta=$(curl -sS --max-time 120 -X POST \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "@$tmp" -w $'\n%{http_code}')
  rm -f "$tmp"
  local code="${resposta##*$'\n'}"
  local corpo="${resposta%$'\n'*}"
  case "$code" in
    200|201) echo "ok    $ficheiro" ;;
    401|403) echo "FALHA $ficheiro: a Management API recusou o token ($code)."
            echo "      Um PAT precisa de um escopo de escrita na base de dados."
            return 1 ;;
    *)       echo "FALHA $ficheiro: http $code"
            printf '%s\n' "$corpo" | head -c 600; echo
            return 1 ;;
  esac
}

aplicar_com_psql() {
  local ficheiro="$1"
  # ON_ERROR_STOP=1: sem isto o psql devolve 0 mesmo depois de uma frase
  # falhar, e o script dizia "ok" com metade do schema em falta -- que e
  # exactamente o que aconteceu com a get_live_status.
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$ficheiro" 2>&1 | sed 's/^/      /'; then
    echo "ok    $ficheiro"
  else
    echo "FALHA $ficheiro (psql)"
    return 1
  fi
}

FALHOU=0
APLICADO=0
for ficheiro in "$@"; do
  if [ ! -f "$ficheiro" ]; then
    echo "FALHA $ficheiro: nao existe" >&2
    FALHOU=1
    continue
  fi

  if [ -n "$ACCESS_TOKEN" ]; then
    echo "==> Management API (projecto $PROJECT_REF)"
    aplicar_com_api "$ficheiro" && APLICADO=$((APLICADO + 1)) || FALHOU=1
  elif [ -n "$DB_URL" ]; then
    echo "==> psql directo"
    command -v psql >/dev/null || { echo "psql nao instalado." >&2; FALHOU=1; continue; }
    aplicar_com_psql "$ficheiro" && APLICADO=$((APLICADO + 1)) || FALHOU=1
  else
    echo "Sem chave de escrita: $ficheiro vai ter de ser colado no SQL Editor."
    echo "  Supabase > SQL Editor > New query > cola o ficheiro > Run."
    echo "  Para automatizar de vez (uma unica vez):"
    echo "    1. conta Supabase > Access Tokens > gera um (sbp_..., poder de escrita na BD)"
    echo "    2. printf '%s' 'sbp_...' > ~/.supabase-access-token && chmod 600 ~/.supabase-access-token"
    echo "    3. ./scripts/publicar-sql.sh --verificar"
    FALHOU=1
    continue
  fi
done

# O que se gravou esta na nuvem ou nao esta? Um create que devolveu 201 nao
# prova que a funcao ficou chamavel pelo anon -- o que o viewer usa. E so se
# olha se foi gravado alguma coisa: sem chave nao se aplicou nada, e o
# verificador (dois minutos) nao viria dizer nada de novo.
if [ "$APLICADO" -gt 0 ]; then
  echo
  "$ROOT/scripts/verificar-nuvem.sh"
fi
[ "$FALHOU" -eq 0 ] || exit 1
