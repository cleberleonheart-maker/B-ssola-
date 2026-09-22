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
   (após `versionCode` deve ser **126**, pois o build incrementa 1 automaticamente —
   `android/app/build.gradle`).
2. Publicar o APK no GitHub:
   `gh release upload bussola-apk /tmp/bussola-v{code}.apk --repo cleberleonheart-maker/B-ssola- --clobber`
3. Atualizar a tabela `app_version` no Supabase com a URL direta do novo APK
   (hoje aponta v99 — por isso o app "não vê" atualização acima de 110):
   - `version_code`, `version_name`, `update_url` = link `releases/download/bussola-apk/bussola-v{code}.apk`
   - `message` e `required`
4. Reinstalar no celular → o app passa a oferecer a nova versão.

## Observações
- `publicar.sh` faz build + bump automático de `versionCode` + upload via `gh`.
- Não é repositório git em /root (sem ci/cd); publicação é manual.