# AGENTS.md

## Idioma

- Sempre responder e interagir em **português do Brasil (pt-BR)**.
- Comentários de código e textos de interface em português; identificadores
  (funções, variáveis, tipos) seguem a convenção em inglês já usada em `src/`.

## Onde vive a versão

- `android/app/version.properties` — `versionCode` e `versionName` (a fonte).
- `src/version.generated.ts` — espelho para o TypeScript; é reescrito a cada
  build pelo Gradle, mas fica no repositório para o CI poder conferir.
- O CI compara os dois e falha se divergirem (`.github/workflows/build-apk.yml`).

Ao subir a versão, atualize **juntos**: `version.properties`, `version.generated.ts`,
`src/services/changelog.ts` (entrada com a chave = `versionCode`) e as chaves
`wn_*` em `src/i18n/strings.ts` nos três idiomas (pt/en/es). Se a feature
tiver texto novo em nativo, também `android/app/src/main/res/values*/strings.xml`.

## Regras do projeto

- **Nunca compilar localmente.** O Gradle compila no CI (regra da ideia #59:
  compilar aqui gasta tempo, bateria e produz APK desatualizado em silêncio).
  Código Kotlin altera-se e verifica-se por leitura e por paridade de testes;
  nunca por `assembleRelease` local.
- **Um `scripts/*.sql` novo entra em três sítios**: a lista `FICHEIROS` do
  `scripts/verificar-sql.mjs`, a lista do workflow `verificar-nuvem.yml` (mesma
  ordem) e o `__tests__/sqlWiring.test.ts` cobre a paridade. Sem os três, o
  ficheiro passa o verde local e nunca chega à nuvem.
- A ordem dos SQL importa: `app_version_sha.sql` (cria a coluna `apk_sha256`)
  vem antes de `app_version.sql` (que escreve nela).
- `scripts/app_version.sql` é gerado por `scripts/publicar-supabase.sh` e
  aponta para a versão **publicada** (o mesmo APK que `scripts/validar-apk.sh`
  instala), não para a versão em construção. Tem duas guardas: o
  `where version_code <= N` impede que ele rebaixe a versão que a release
  acabou de gravar na nuvem, e o `case` do hash impede que substitua o hash
  que a release gravou para essa mesma versão (o ficheiro é uma fotografia;
  quem sabe a verdade é o workflow da build, que lê o digest do asset
  publicado). O `__tests__/appVersionSql.test.ts` fixa essa coerência.

## O APK publicado de uma versão é imutável

Um `versionCode` é um APK, para sempre. O asset `bussola-vNNN.apk` que está
publicado **não se substitui** — o workflow da build nunca faz `--clobber`, e
o `publicar.sh` só o faz com `REPUBLICAR=1`, à mão e a propósito.

A razão é o hash. Um APK não é reprodutível byte a byte: o mesmo código
compilado duas vezes dá dois ficheiros diferentes. Republicar o asset da
mesma versão fazia o digest rodiar, e a partir daí o hash que o repositório
guardava deixava de bater com o ficheiro que os utilizadores descarregam — a
nuvem acabava a dizer "v211" com o hash de um APK 211 diferente, e o app dava
"hash não bate certo" e recusava-se a instalar.

Três regras que daí resultam:

- **Mudou o código, sobe a versão.** Uma alteração em `src/` que não sobe o
  `versionCode` não sai no APK publicado: sai na próxima versão. O CI avisa
  quando o build não bate byte a byte com o asset já publicado.
- **O hash da nuvem é o do asset publicado**, lido do `digest` que a GitHub
  calcula (`gh release view ... --json assets`), nunca do `sha256sum` do
  build local. São o mesmo ficheiro, mas só o publicado é o que se descarrega.
- **Um snapshot desatualizado não rebaixa nem envenena a nuvem**: o
  `app_version.sql` só escreve o hash quando a versão avança, e o PATCH dos
  workflows filtra por `version_code=lte.N` para nunca rebaixar o ponteiro.

Para corrigir um hash que ficou errado na nuvem, use o caminho que conhece o
asset publicado: `./scripts/publicar-supabase.sh` (PATCH direto) ou
`./scripts/verificar-nuvem.sh`, que compara o hash da nuvem com o digest
publicado e diz quando estão divergentes.

## Comandos

```
npm run lint       # eslint .
npm run typecheck  # tsc --noEmit
npm test           # jest (o pretest corre scripts/verificar-sql.mjs)
```

A suíte completa demora alguns minutos; rode os ficheiros isolados enquanto
itera (`npx jest __tests__/ficheiro.test.ts`).

## Publicação

1. Commit de feature com o bump: `feat: vX.Y (code NNN) — <descrição>`.
2. Push para `main`: o CI compila, assina, publica na tag `bussola-apk` e
   grava `app_version` no Supabase.
3. Commit separado `scripts: guião e sha256 do APK NNN`, com o SHA-256 novo em
   `scripts/validar-apk.sh` e `scripts/validar-termux.sh` (o SHA só existe
   depois de o CI publicar) **e** o `scripts/app_version.sql` regenerado para o
   mesmo código e o mesmo hash — `scripts/publicar-supabase.sh` faz isso, ou
   edita-se o ficheiro à mão. Sem os três em sintonia, o
   `__tests__/appVersionSql.test.ts` reprova.

O passo 3 é uma vez por **versão**, não por build: o asset publicado não se
substitui, portanto o SHA-256 de uma versão não volta a mudar.

Push para `main` publica o APK. Confirme com o dono antes de o fazer.
