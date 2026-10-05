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
- `expires_at` — 90 dias. A purga está em comentário no SQL porque precisa de
  `pg_cron`; enquanto lá não estiver, as linhas mais antigas que 90 dias ficam
  para fora e apagam-se à mão no Table Editor.

Um relatório só chega aqui se a app **tiver arrancado** depois do crash: o
reporter não tenta enviar durante o erro, porque uma app que acabou de partir não
tem rede garantida. Por isso a tabela fica vazia nos testes de um utilizador que
instala a app, abre, fecha, e não volta a abrir — e isso não é um bug.

### `./scripts/verificar-crashes.mjs` — o caminho inteiro, sem aparelho

O `verificar-nuvem.sh` confirma que a tabela existe e que o `anon` a consegue
ler. **Não diz nada sobre escrever**, que é o que o reporter faz. E essa parte é
a que falha em silêncio: uma tabela sem política de INSERT dá 42501, o
`pushCrashReport` devolve falso sem lançar, o reporter guarda o relatório e
desiste ao fim de três tentativas. Um erro de política de RLS transforma-se em
silêncio, e a app continua a funcionar toda.

Este script é a prova de que essa parte funciona. Corre-se à mão, e **escreve
uma linha em `crashes` e apaga-a a seguir** — por isso não entra no `pretest`
(não é um teste: precisa de rede e escreve na tabela de produção). Corre-o
depois de mexer em `crashes.sql`, em `cloud.ts`, ou nas políticas.

O que ele apanha: uma coluna que o `cloud.ts` envia e o SQL não tem (42703), uma
coluna NOT NULL que o `cloud.ts` esquece (23502), falta de política de INSERT,
linha que entra mas não se consegue ler, linha que fica depois de um DELETE, e
uma sessão alheia a conseguir ler o crash de outra pessoa.
