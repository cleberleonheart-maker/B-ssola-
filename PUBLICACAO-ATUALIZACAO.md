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
5. `./scripts/verificar-nuvem.sh` — se o commit mexeu em `scripts/*.sql`, isto
   diz o que ainda não chegou à nuvem. O `publicar-supabase.sh` só mexe em
   `app_version`, e DDL não passa pelo PostgREST: nem com `service_role`. Para
   gravar, `./scripts/publicar-sql.sh scripts/live_rls.sql` (Management API com
   um personal access token da conta, ou `psql` com `SUPABASE_DB_URL`); sem
   chave nenhuma, o ficheiro vai ter de ser colado no SQL Editor. O workflow
   "Verifica o schema na nuvem" repete a verificação sozinho em cada commit que
   toque nos SQL ou no `web/live.html`.
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
