# Publicação da atualização (v125) — registro do trabalho

> Data: 22/09/2026 · Situação: **NÃO CONCLUÍDO** — build não terminou de gerar o APK.

## Problema relatado
O celular mostrava uma atualização disponível, mas ao verificar dizia
"Você está atualizado ✓".

## Diagnóstico (causa raiz)
- Supabase (`app_version`): tabela **desatualizada** — única linha aponta `version_code=99`.
- GitHub (`publicar.sh` → release `bussola-apk`): último APK publicado é a **v110**.
- Código-fonte local: já estava em `versionCode=124` (v7.2) — **nunca publicado**.
- O app só oferece atualização se `Supabase > local` OU `GitHub > local`.
  No celular (v110): `99 > 110`? não · `110 > 110`? não → "atualizado". **Não é bug no app.**

## O que foi feito
1. Investigado o fluxo: `src/services/versionService.ts` (`checkForUpdate`),
   `cloud.ts` (`fetchLatestAppVersion` do Supabase) e `publicar.sh`.
2. Confirmado via GitHub API (gh) e via REST do Supabase (curl + anon key).
3. Tentativas de build/publicar (`./publicar.sh`) — **3 falhas**:

## Falhas do build
| Tentativa | O que aconteceu |
|---|---|
| 1 · ~01:35 UTC | build morto pelo timeout da ferramenta (10 min); APK não gerado; `versionCode` foi para 125 |
| 2 · ~01:47 | daemon do Gradle "desapareceu" (`IllegalStateException: Shutdown in progress`); APK não gerado |
| 3 · ~02:00–02:10 | travado 50 min em `:app:mergeReleaseResources` (suspeitava-se do aapt2 via qemu); APK antigo |
| 4 · ~06:25 (destacado) | **máquina reiniciou no meio** do build (uptime 2 min); daemon morto em `buildCMakeRelWithDebInfo[arm64-v8a]` |

Teste isolado: `/root/android-sdk/aapt2emu/aapt2 version` → funciona rápido
(binário x86_64 rodado via qemu-x86_64 num host arm64). Não é o aapt2.

## Estado atual
- `android/app/version.properties` → **versionCode=125**, name=7.2
- `src/version.generated.ts` → **APP_VERSION_CODE=125**
- APK gerado: **ainda o antigo v110** (19/09)

## Próximos passos
1. Build manual com mais margem de memória e sem paralelismo:
   `cd android && ./gradlew assembleRelease --no-parallel --max-workers=1 -x lint -x test`
   (o `versionCode` **não** sobe sozinho — edite `android/app/version.properties`
   antes de buildar; o `build.gradle` só reescreve `src/version.generated.ts`).
2. Publicar o APK no GitHub:
   `gh release upload bussola-apk /tmp/bussola-v{code}.apk --repo cleberleonheart-maker/B-ssola- --clobber`
3. Atualizar a tabela `app_version` no Supabase com a URL direta do novo APK
   (hoje aponta v99 — por isso o app "não vê" atualização acima de 110):
   - `version_code`, `version_name`, `update_url` = link `releases/download/bussola-apk/bussola-v{code}.apk`
   - `message` e `required`
4. Reinstalar no celular → o app passa a oferecer a nova versão.

## Observações
- Hoje a publicação é **automática**: `.github/workflows/build-apk.yml` roda em push na
  `main` (e manualmente), valida `eslint` + `tsc --noEmit` + `jest`, gera o APK
  assinado, sobe na tag `bussola-apk` e grava `app_version` no Supabase.
  `publicar.sh` continua existindo para build local.
- **Assinatura de release é obrigatória**: `android/app/build.gradle` aborta o
  `assembleRelease` se `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS` ou `ANDROID_KEY_PASSWORD` estiverem faltando. Não há mais
  fallback para o keystore de debug — um APK assinado com a chave de debug não
  poderia ser atualizado por cima de uma instalação já publicada.
  - No CI as quatro variáveis vêm dos *secrets* do repositório.
  - **A chave de produção não existe em nenhum ficheiro deste repositório, nem
    fora dele, em claro.** Ficou só nos *secrets* do GitHub (que são write-only:
    não se voltam a ler) e numa cópia cifrada (AES-256, PBKDF2) que o dono tem
    fora do aparelho. Isto vale porque o `/root` é `f2fs` sem permissões
    aplicadas — um ficheiro `600` de root era legível por qualquer processo.
  - `publicar.sh` **não tem** caminho para a chave de produção: sem
    `ANDROID_KEYSTORE_*` no ambiente aborta antes do build, e se ainda existir
    um `~/.bussola-keystore/` avisa que o arquivo já não é usado. Um build
    local de release é para assinar com um keystore de descarte; para
    production, o CI.
- `web/live.html` (viewer do rastreio ao vivo) é publicado no **GitHub Pages** por
  `.github/workflows/pages.yml`. Os antigos `scripts/live_bucket.sql` e
  `scripts/live_content_type.sql` foram removidos: a alternativa via Supabase Storage
  foi abandonada (o SQL Editor revertia o batch ao tocar em
  `storage.objects.content_type`, que não existe). O que vale é `scripts/live_rls.sql`.

---

# Como publicar a atualização

Referência atual (o registro da v125 abaixo é histórico e ficou desatualizado).

## Fluxo automático (recomendado)
1. Edite `android/app/version.properties` (`versionCode` e `versionName`).
2. Atualize o changelog em `src/services/changelog.ts` (entrada para o novo
   `versionCode`) e as chaves `wn_*` em `src/i18n/strings.ts` nos 3 idiomas.
3. `./gradlew compileDebugKotlin` a partir de `android/` — o `tsc` não valida
   Kotlin e já deixou passar APIs removidas do SDK.
4. `npm run lint && npm run typecheck && npm test` — o CI repete os três como
   gate. O `npm test` corre primeiro o `pretest`, que é o
   `scripts/verificar-sql.mjs`: cada `scripts/*.sql` duas vezes contra um
   Postgres a sério, e depois a conferência de que as tabelas, as RPCs e a
   coluna do hash ficaram lá. Um `.sql` partido ou a meio apanha-se em segundos,
   em vez de quando alguém o for colar no SQL Editor.

   Um teste que demora imenso tempo não é culpa do componente, e é melhor
   aquecê-lo do que lhe esticar o prazo. As suítes que usam
   `react-test-renderer` pagam a transformação do Babel de todo o `react-native`
   no **primeiro** render — 15,9 s no `whatsNewModal`, 4,0 s no `miniMapView`,
   contra 13–192 ms nos testes seguintes. Dentro do prazo, isso é um flake à
   espera: o `whatsNewModal` chegou a falhar em uma de cada três execuções da
   suite toda, e subir o prazo de 5 s para 30 s só comprou margem. A cura é um
   render em `beforeAll`, que paga o frio fora do relógio dos testes: 15,9 s
   → 42 ms e 4,0 s → 29 ms, ambos de volta ao prazo normal. Se um dia um teste
   ficar lento a sério, o timeout deve ser o **dele** e não de toda a suíte.
5. `./scripts/verificar-nuvem.sh` — se o commit mexeu em `scripts/*.sql`, isto
   diz o que ainda não chegou à nuvem. O `publicar-supabase.sh` só mexe em
   `app_version`, e DDL não passa pelo PostgREST: nem com `service_role`. O
   workflow "Schema do Supabase" aplica os seis ficheiros sozinho em cada
   commit que os toque — **já está configurado** (2026-10-05): existe o secret
   `SUPABASE_ACCESS_TOKEN`, um token *scoped* (`sbp_fc…`) com escopo só neste
   projecto e permissão de escrever na base de dados. Não há nada para colar.
   Para aplicar sem esperar por outro commit:
   `gh workflow run verificar-nuvem.yml`. Se o secret for removido, o workflow
   salta a aplicação com um aviso e o ficheiro volta a ter de ser colado no SQL
   Editor; em-local, `./scripts/publicar-sql.sh scripts/live_rls.sql` faz o
   mesmo pela Management API ou por `psql`.

   O que este passo **não** apanha: se um `.sql` descrever um schema mais
   solto do que o que está na nuvem, o `pretest` passa (ele monta o schema com
   os mesmos ficheiros, logo é coerente consigo próprio) e é a aplicação na
   nuvem que devolve o erro. Foi o que aconteceu com `app_version`, que tem
   `version_name` e `update_url` NOT NULL — o ficheiro passou a declarar as
   duas coisas, e a nuvem é que manda.
6. `git push` na `main`: o workflow builda, assina, publica na tag `bussola-apk`
   e grava `app_version` no Supabase.

## Fluxo local
`./publicar.sh` faz build + upload via `gh` + `scripts/publicar-supabase.sh`
(precisa de `SUPABASE_SERVICE_ROLE_KEY` no ambiente ou em `~/.supabase-service-key`;
sem a chave, gere `scripts/app_version.sql` para colar no SQL Editor).

## Tabela `app_version`
Uma única linha (`id=1`) com `version_code`, `version_name`, `update_url`, `message`
e `required`. É ela que faz o app exibir o prompt de atualização. Schema e RLS em
`scripts/rls.sql`.

## Tabela `crashes` — onde se lê um crash (ideia #56)
No painel do Supabase, **Table Editor → `crashes`**. É a única tabela do
repositório que se lê fora do servidor: as outras têm RLS por `user_id` e quem
entra vê só as suas linhas, o que para um relatório de erro não serve de nada.
Aqui a leitura é pelo `service_role` do painel, por isso vê todas — e é por isso
que a tabela não guarda nada que identifique quem tinha o crash.

Ordena por `happened_at` descendente. As colunas úteis:

- `message` — a primeira linha do erro. É o que se lê primeiro para saber se é
  um bug só.
- `fingerprint` — hash da primeira linha, e o que permite contar: agrupar por
  `fingerprint` diz "isto happenceu 400 vezes" sem ler 400 linhas. Duas linhas
  com o mesmo fingerprint são o mesmo bug, mesmo com stacks diferentes.
- `happened_at` / `reported_at` — quando o crash aconteceu e quando a app
  arrancou a seguir para o enviar. A diferença entre as duas é o tempo que o
  relatório passou na fila, e um valor grande significa que ninguém abriu a app
  durante esse tempo.
- `version_code` / `app_version` — em que build. Um erro que só aparece na 164 e
  não na 163 é regressão, não bug antigo.
- `expires_at` — 90 dias, e isso é cumprido: ver "A limpeza do prazo" abaixo.

Um relatório só chega aqui se a app **tiver arrancado** depois do crash: o
reporter não tenta enviar durante o erro, porque uma app que acabou de partir não
tem rede garantida. Por isso a tabela fica vazia nos testes de um utilizador que
instala a app, abre, fecha, e não volta a abrir — e isso não é um bug.

### A limpeza do prazo

O prazo só quer dizer alguma coisa se alguém o fizer cumprir. `crashes` e
`live_points` têm `expires_at`, e durante algum tempo isso não apagava nada: o
`pg_cron` estava comentado no SQL, porque depender de uma extension que nem
sempre está instalada é uma maneira fina de uma promessa de retenção não
acontecer.

A limpeza ficou portanto **do lado de quem tem sessão**, em `cloud.ts`:

- `deleteExpiredCrashReports(userId)` — corre depois de um envio bem-sucedido, ou
  seja, quando há relatório novo e a app tem rede. Não corre com a fila vazia:
  seria um pedido inútil em cada arranque.
- `deleteExpiredLivePoints(userId)` — corre uma vez por processo, no primeiro
  `pushLiveFix`. `live_points` cresce seis linhas por minuto, e `stopLiveShare`
  já apaga o trajecto quando a sessão acaba a bem; o que escapava era a sessão
  que morre sem isso — app fechada à força, crash, ou um `delete` que ficou sem
  rede.

Ambas apagam só `user_id = <o próprio>` **e** `expires_at` no passado. A RLS
garante o primeiro filtro mesmo que o código o esqueça — as políticas de DELETE
comparam `user_id` com `auth.uid()` —, e os testes verificam o segundo por
conta própria, porque o inverso não dá para recuperar: apagar a linha que ainda
está no prazo deixa quem está a ver o link sem trajecto a meio.

O que sobra é o que não tem ninguém: linhas de uma conta apagada, ou de uma
sessão que acabou e não voltou. Durante algum tempo apagavam-se à mão no Table
Editor; desde a ideia **#98** faz o `scripts/limpar-orfaos.mjs`, que corre de
madrugada pelo `.github/workflows/limpar-orfaos.yml` com a `service_role` — a
única coisa que alcança linhas de quem já não existe, porque o `auth.uid()` do
DELETE de quem escreveu já não é o dele. O filtro é o mesmo das limpezas de
cima: `expires_at` no passado. A exceção é `live_shares`, que guarda o prazo
vencido de propósito (é o que permite ao viewer dizer "expirou" em vez de
"encerrado") e por isso só apaga o que passou do prazo **há mais de 90 dias**.
Cada commit que toque no script corre-o em modo `--apenas-contar` — conta sem
escrever, para provar que a chave serve sem apagar produção por haver um
commit.

### Histórico de partilhas — parar já não apaga (#100)

O "Parar" apagava a linha de `live_shares`, e com ela a única prova de que a
sessão existiu: não havia ecrã que dissesse "ontem mandei um link às 21h04 que
durou 30 min". Desde a v7.40 parar **marca** — `markLiveShareStopped` escreve
`stopped_at` e leva os pontos do trajecto, como levava antes —, e só escreve o
DELETE quando a marca não pegou (linha já fora, RLS a recusar): uma sessão que
não se consegue marcar não pode ficar viva a partilhar posição.

O SQL da mudança está todo em `scripts/live_rls.sql` (a coluna, `get_live_position`
e `get_live_track` a esconderem as paradas com `stopped_at is null`, e
`get_live_status` a devolver a coluna `stopped`) e em `scripts/live_points.sql`;
aplica-se sozinho no próximo push, pelo `verificar-nuvem.yml`. Antes da coluna
existir, `stopped_at is null` avaliaria a `NULL` — as sessões sumiam do viewer —
portanto o commit tem de trazer o SQL e o código juntos, que é o que faz.

No ecrã, `ShareHistorySection` (Configurações) lê só os carimbos de tempo de
`live_shares` do próprio: início, duração e estado, sem coordenadas a voltarem a
entrar no aparelho. As linhas paradas continuam a ser apanhadas pela limpeza de
#98 ao fim de 90 dias do prazo — o mesmo prazo que já valia às expiradas.

### Apagar a minha conta e os dados (#101)

Um botão na secção "Conta" de Configurações, com confirmação. O grosso está na
base: `scripts/account_delete.sql` cria a RPC `delete_my_account()` —
`SECURITY DEFINER` — que apaga as linhas do `auth.uid()` da sessão nas seis
tabelas (`tracks`, `notes`, `virgin_memory`, `crashes`, `live_points`,
`live_shares`) e depois o utilizador em `auth.users`, numa transação. Precisou
da `SECURITY DEFINER` porque apagar o utilizador não é REST e o cliente do
Supabase não se elimina a si próprio; a função corrige os poderes de quem a
criou (o postgres, via SQL Editor ou Management API) e limita-se ao `auth.uid()`
do JWT — sem sessão (a anon key sozinha) devolve `false` sem tocar em nada.

O ficheiro entra na lista de seis do `publicar-sql.sh` do workflow (e na de
`verificar-sql.mjs`); aplica-se sozinho no próximo push. No cliente, o
`deleteMyAccount` chama a RPC, faz `signOut` e limpa o id em memória — um
pedido com o id de uma conta apagada é um 400 de PostgREST que ninguém percebe,
por isso é o `signOut` que fecha o ciclo, e não o botão.

O `verificar-nuvem.sh --strict` passou a sondar a própria RPC (sem header de
sessão, devolve `false` sem efeitos) para a ausência dela falhar o workflow no
push e não quando um utilizador quiser sair.

### Ligar a conta anónima a um email (#102)

Desde a v7.42, a secção "Conta" de Configurações permite ligar a conta anónima
a um email. O caminho é o `updateUser({ email })` do Supabase com a sessão
anónima activa: o GoTrue envia um link de confirmação e, ao ser clicado,
associa a identidade do email **ao mesmo `auth.uid()`**. O id não muda, e por
isso as linhas de `tracks`, `notes`, `virgin_memory`, `crashes`, `live_points`
e `live_shares` continuam a ser as mesmas — a migração de `user_id` que o texto
da ideia temia (e o `security definer` que isso pedia) não chegou a ser
preciso.

**Requisto único, uma vez, fora do SQL**: o projecto precisa de ter
`enable_manual_linking` ligado. Não é possível aplicar por `publicar-sql.sh`
(é configuração do GoTrue, não schema). Liga-se no Dashboard do Supabase
(Authentication) ou pela Management API com
`PATCH /v1/projects/{ref}/config/auth` e `enable_manual_linking: true`. Com ele
desligado, o `linkEmail` devolve falso e o motivo ("manual linking is
disabled") aparece no próprio pedido — não há sonda no CI para isto porque
testá-lo mandaria um email de confirmação real a cada execução.

No ecrã, `AccountSection` mostra o `currentAccountStatus` (lido do `getUser`,
sem mexer na sessão): anónima ou `Ligada a {email}`, com a confirmação pendente
visível enquanto o link da caixa de entrada não for tocado. O `linkEmail`
garante a sessão antes de pedir, normaliza o endereço (minúsculas e sem
espaços) e rejeita email mal formado sem tocar no GoTrue. A senha do pedido é
opcional: vazia, volta-se a entrar pelo link/OTP do email; preenchida (6+), o
`updateUser({ email, password })` grava também as credenciais de
`signInWithPassword` — sempre no mesmo `auth.uid()`, sem segunda conta.

### `./scripts/verificar-crashes.mjs` — o caminho inteiro, sem aparelho

O `verificar-nuvem.sh` confirma que a tabela existe e que o `anon` a consegue
ler. **Não diz nada sobre escrever**, que é o que o reporter faz. E essa parte é
a que falha em silêncio: uma tabela sem política de INSERT dá 42501, o
`pushCrashReport` devolve falso sem lançar, o reporter guarda o relatório e
desiste ao fim de três tentativas. Um erro de política de RLS transforma-se em
silêncio, e a app continua a funcionar toda.

Este script é a prova de que essa parte funciona. **Escreve uma linha em
`crashes` e apaga-a a seguir** — por isso não entra no `pretest` (não é um
teste: precisa de rede e escreve na tabela de produção).

Corre em três sítios, todos no `.github/workflows/verificar-crashes.yml`:

- **de semana em semana** — segunda-feira às 4h17 **de Brasília** (o `cron` do
  GitHub Actions é UTC, portanto está escrito como `17 7 * * 1`), a mesma hora
  da purga que está comentada no `crashes.sql`;
- **a cada commit** que toque no caminho do crash (`crashes.sql`,
  `live_points.sql`, o próprio script, o `cloud.ts` e o workflow);
- **à mão** — `workflow_dispatch`, ou `node scripts/verificar-crashes.mjs`
  a partir de qualquer sítio com rede.

Enquanto só corria à mão, a instrução era "corre-o depois de mexer em
`crashes.sql`, em `cloud.ts` ou nas políticas" — e isso depende de alguém se
lembrar. Uma regressão de RLS não anuncia que é uma regressão de RLS: anuncia
quando um utilizador der por ela. Daí o schedule, e daí falhar a vermelho —
ao contrário do workflow do schema, que avisa com `::warning::`, porque lá um
X persistente em cada push até alguém aplicar o SQL treinava o olho a
ignorá-lo. Aqui uma falha é acção.

Não precisa de segredo nenhum: o script lê a URL e a anon key do próprio
`cloud.ts`, que são públicas. Cada execução cria duas contas anónimas (a nossa
e a de "outra pessoa"), escreve três pontos de `live_points` e apaga tudo no
fim — o último passo conta os tokens `verificacao-%` e falha se sobrar algum.

O que ele apanha: uma coluna que o `cloud.ts` envia e o SQL não tem (42703), uma
coluna NOT NULL que o `cloud.ts` esquece (23502), falta de política de INSERT,
linha que entra mas não se consegue ler, linha que fica depois de um DELETE, e
uma sessão alheia a conseguir ler o crash de outra pessoa.

Acrescentadas à lista estão as da limpeza: cria um ponto caducado, um a decorrer e um de uma
segunda sessão anónima, apaga os que passaram do prazo e confirma que o
caducado foi, que o a decorrer ficou — é a sessão que está a vivo — e que o da
outra pessoa não foi tocado, mesmo estando caducado. No fim confirma que não
deixou nada para trás, porque este script aponta para a base de produção.
