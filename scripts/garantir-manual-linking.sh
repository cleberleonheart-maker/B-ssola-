#!/usr/bin/env bash
# Liga o "manual linking" do projecto (#102).
#
# A conversao de anonimo para permanente (updateUser({ email, password }) com a
# sessao anonima) exige `enable_manual_linking` no GoTrue. Isso NAO e schema e
# NAO passa pelo publicar-sql.sh: e configuracao do projecto, na Management API,
# em https://api.supabase.com/v1/projects/<ref>/config/auth. Este script le e,
# se faltar, liga.
#
# Porque e que isto pode nao ligar sozinho: o token de escrita na base de dados
# do CI tem escopo de dados, e ler/escrever config/auth e outro compartimento da
# Management API. Se o token nao tiver esse escopo, o script avisa (::warning::)
# e sai a zero -- ligar fica para o painel (Supabase > Authentication) ou para
# um token com leitura/escrita de auth config. Ligar manual linking nao parte
# nada: sem sessao identidade nenhuma se associa, e a feature #102 e' que passa
# a funcionar.
#
# Uso (uma vez, em maquina com o token):
#   SUPABASE_ACCESS_TOKEN=sbp_... ./scripts/garantir-manual-linking.sh
# ou, como o publicar-sql.sh, com o token em ~/.supabase-access-token.
set -u

SUPABASE_URL="${SUPABASE_URL:-https://wotzcykrvidbjkonaawx.supabase.co}"
# O ref do project e o primeiro rotulo do host, como no publicar-sql.sh.
PROJECT_REF="${SUPABASE_PROJECT_REF:-$(printf '%s' "$SUPABASE_URL" | sed -E 's#^https?://##; s#\..*$##')}"

ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
if [ -z "$ACCESS_TOKEN" ] && [ -f "$HOME/.supabase-access-token" ]; then
  ACCESS_TOKEN="$(cat "$HOME/.supabase-access-token")"
fi

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Sem token Management API: o manual linking fica um passo so do painel."
  echo "  Se a v7.42 disser 'manual linking is disabled': Supabase > Authentication > ligar."
  echo "  Para automatizar: conta Supabase > Access Tokens > gerar (leitura/escrita de auth config):"
  echo "    printf '%s' 'sbp_...' > ~/.supabase-access-token && chmod 600 ~/.supabase-access-token"
  echo "    $0"
  exit 1
fi

base="https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth"

resp=$(curl -sS --max-time 30 -w $'\n%{http_code}' \
  -H "Authorization: Bearer $ACCESS_TOKEN" "$base")
code="${resp##*$'\n'}"
corpo="${resp%$'\n'*}"

case "$code" in
  200)
    atual="$(printf '%s' "$corpo" | jq -r '.enable_manual_linking' 2>/dev/null || echo '')"
    if [ "$atual" = "true" ]; then
      echo "ok    enable_manual_linking ja ligado"
    else
      echo "==> ligando enable_manual_linking (estava: ${atual:-vazio})"
      r2=$(curl -sS --max-time 30 -w $'\n%{http_code}' -X PATCH \
        "$base" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"enable_manual_linking":true}')
      c2="${r2##*$'\n'}"
      b2="${r2%$'\n'*}"
      case "$c2" in
        200) echo "ok    enable_manual_linking ligado" ;;
        401|403)
          echo "::warning::o token nao escreve auth config ($c2): ligue o manual linking no painel (Supabase > Authentication) se a v7.42 disser 'manual linking is disabled'" ;;
        *)
          echo "::warning::nao foi possivel ligar o manual linking (http $c2): $(printf '%s' "$b2" | head -c 300 | tr '\n' ' ')" ;;
      esac
    fi
    ;;
  401|403)
    echo "::warning::o token nao le config/auth ($code): nao da para dizer se o manual linking esta ligado. Se a v7.42 disser 'manual linking is disabled', ligue-o no painel (Supabase > Authentication)"
    printf '%s' "$corpo" | head -c 200; echo
    ;;
  *)
    echo "::warning::Management API indisponivel (http $code): manual linking nao verificado"
    printf '%s' "$corpo" | head -c 200; echo
    ;;
esac

exit 0