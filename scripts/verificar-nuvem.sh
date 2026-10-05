#!/usr/bin/env bash
# Confere se o que o repositorio promete ja esta na nuvem.
#
# Porquê: os ficheiros em scripts/*.SQL sao a unica copia do schema, e ate
# agora nada confirmava que tinham corrido. O ficheiro do rls.sql esteve dois
# meses com lixo no meio de um `create table` -- nunca correu, e ninguem reparou
# porque ninguem o correra. A get_live_status nunca chegou a ser criada na nuvem,
# e o viewer engole o 404 e culpa a pessoa que encerrou a sessao. As duas
# coisas eram invisiveis daqui.
#
# So precisa da URL e da anon key, que ja sao publicas no app (cloud.ts) e
# por isso nao sao segredo. Nao escreve nada: e um olhar, nao uma publicacao.
#
#   ./scripts/verificar-nuvem.sh            # relata e sai com 0
#   ./scripts/verificar-nuvem.sh --strict   # sai com 1 se faltar algo
#   ./scripts/verificar-nuvem.sh --auth     # verifica tambem o login anonimo
#
# O --auth fica de fora de proposito: cada chamada cria um utilizador anonimo
# novo na cloud (e o mesmo no CI, a cada build). Nao e um custo de que se.note,
# mas tambem nao e um olhar -- e a razao de este script nao se meter nisso.
#
# Para GRAVAR o schema na nuvem use scripts/publicar-sql.sh: a anon key nao
# cria tabelas, e a service_role tambem nao (PostgREST so fala REST).
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STRICT=0
AUTH=0
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    --auth)   AUTH=1 ;;
  esac
done

# Uma unica fonte da verdade: as credenciais vem do cloud.ts, nao de uma copia
# aqui. Se um dia mudar la, este script muda sem ninguem se lembrar dele.
read -r SUPABASE_URL SUPABASE_ANON_KEY < <(
  sed -nE "s/^const SUPABASE_URL: string = '(.*)';\$/\\1/p;s/^const SUPABASE_ANON_KEY: string = '(.*)';\$/\\1/p" \
    "$ROOT/src/services/cloud.ts" | tr '\n' ' '
)
SUPABASE_URL="${SUPABASE_URL:-https://wotzcykrvidbjkonaawx.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "Nao encontrei a anon key em src/services/cloud.ts" >&2
  exit 2
fi

MISSING=0
FAILED=0

# Uma consulta que responde 200 prova que o objecto existe E que o anon tem
# permissao. Um select que devolve 400 (ou 404) e a resposta do PostgREST a
# dizer que nao ha coluna/funcao com essa assinatura.
probe() {
  local label="$1" method="$2" path="$3" body="${4:-}"
  local out code
  # 60 s e nao 20: um GET a este projeto tem demorado 15 s da ultima vez, e um
  # timeout curto transformava "a rede foi lenta" num "FALTA" que nao e vero.
  if [ -n "$body" ]; then
    out=$(curl -s --max-time 60 -X "$method" "$SUPABASE_URL/rest/v1/$path" \
      -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d "$body" -w $'\n%{http_code}')
  else
    out=$(curl -s --max-time 60 -X "$method" "$SUPABASE_URL/rest/v1/$path" \
      -H "apikey: $SUPABASE_ANON_KEY" -w $'\n%{http_code}')
  fi
  code="${out##*$'\n'}"
  body="${out%$'\n'*}"

  if [ "$code" = "200" ] || [ "$code" = "201" ] || [ "$code" = "204" ]; then
    printf '  ok    %s\n' "$label"
    return 0
  fi

  # 401/403 e outra coisa: a rede, ou a chave. 404/400 com PGRST e o schema.
  if [ "$code" = "000" ]; then
    printf '  REDE  %s (o curl nao recebeu resposta -- timeout ou ligacao cortada)\n' "$label"
    FAILED=$((FAILED + 1))
    return 1
  fi
  if printf '%s' "$body" | grep -q 'PGRST'; then
    printf '  FALTA %s\n' "$label"
    printf '%s' "$body" | grep -oE '"(code|details|message)":"[^"]*"' | head -2 | sed 's/^/          /'
    MISSING=$((MISSING + 1))
  else
    printf '  ERRO  %s (http %s)\n' "$label" "$code"
    printf '%s' "$out" | head -c 200 | sed 's/^/          /'
    echo
    FAILED=$((FAILED + 1))
  fi
  return 1
}

echo "Nuvem: $SUPABASE_URL"

echo "Tabelas (o app le/escreve com a anon key, via RLS por utilizador):"
# limit=1 e nao count: o que interessa e a tabela existir e o anon poder
# selectar, nao o conteudo.
for t in app_version live_shares live_points virgin_memory tracks notes; do
  probe "$t" GET "$t?select=*&limit=1" || true
done

# A coluna do hash (ideia #71b) e o unico schema que o CI escreve: se faltar,
# a release sai sem a segunda fonte do SHA-256 e o app so tem o digest da
# GitHub. O PATCH do CI ja cai para um sem o campo, entao isto nao parte nada
# -- so faz o update ficar mais fraco do que parece.
probe "app_version.apk_sha256" GET "app_version?select=version_code,apk_sha256&limit=1" || true

echo "Funcoes (a pagina web do rastreio ao vivo chama-as sem login):"
# Com o nome do argumento e nao um valor solto: o PostgREST casa por nome, e um
# 404 aqui significa "esta funcao nao existe na nuvem" ou "o argumento mudou de
# nome" -- as duas coisas que o repositorio nao consegue ver sozinho.
probe "get_live_position(p_token)" POST "rpc/get_live_position" '{"p_token":"verificar-nuvem"}' || true
probe "get_live_status(p_token)"   POST "rpc/get_live_status"   '{"p_token":"verificar-nuvem"}' || true
probe "get_live_track(p_token,p_after)" POST "rpc/get_live_track" '{"p_token":"verificar-nuvem","p_after":0}' || true

# O login anonimo e o que faz a RLS por utilizador funcionar: as politicas
# comparam user_id com auth.uid(), e sem sessao o rastreio ao vivo nao tem
# quem publicar a posicao. O #95 deixou isto escrito como um passo no painel do
# Supabase, e um passo no painel nao tem teste -- em 2026-10-05 ja estava ligado.
if [ "$AUTH" -eq 1 ]; then
  echo "Login anonimo (cria um utilizador anonimo na cloud):"
  resp=$(curl -s --max-time 60 -X POST "$SUPABASE_URL/auth/v1/signup" \
    -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
    -d '{}' -w $'\n%{http_code}')
  code="${resp##*$'\n'}"
  corpo="${resp%$'\n'*}"
  if [ "$code" = "200" ] && printf '%s' "$corpo" | grep -q '"access_token"'; then
    printf '  ok    signup anonimo\n'
  elif printf '%s' "$corpo" | grep -q 'anonymous_provider_disabled'; then
    printf '  FALTA signup anonimo (anonymous_provider_disabled)\n'
    printf '          Supabase > Authentication > Providers > Anonymous > ligado\n'
    MISSING=$((MISSING + 1))
  else
    printf '  ERRO  signup anonimo (http %s)\n' "$code"
    printf '%s' "$corpo" | head -c 200 | sed 's/^/          /'; echo
    FAILED=$((FAILED + 1))
  fi
fi

echo
if [ "$MISSING" -gt 0 ]; then
  echo "Falta na nuvem: $MISSING objecto(s). Para gravar:"
  echo "  ./scripts/publicar-sql.sh scripts/live_rls.sql   # (ou rls.sql, live_points.sql, ...)"
  echo "Sem chave de escrita, o ficheiro tem de ser colado no SQL Editor do Supabase."
elif [ "$FAILED" -gt 0 ]; then
  echo "Falhou $FAILED consulta(s) que nao deviam falhar -- rede ou credencial, antes de"
  echo "concluir que o schema esta em falta."
else
  echo "Tudo o que o repositorio declara esta na nuvem."
fi

[ "$STRICT" -eq 1 ] && [ "$MISSING" -gt 0 ] && exit 1
exit 0
