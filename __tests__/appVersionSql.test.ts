/**
 * O `scripts/app_version.sql` é a cópia manual da linha que o app consulta
 * para saber que há versão nova. O CI aplica-o na nuvem em qualquer commit
 * que toque `scripts/**` — o workflow "Schema do Supabase" — e o CI da release
 * grava a linha certa por PATCH.
 *
 * Desses dois, o PATCH é o que sabe a verdade: o código que acabou de ser
 * publicado. O ficheiro em disco é uma fotografia e fica desatualizado entre
 * releases. Quando o workflow o aplica, estava a repor a versão antiga na
 * nuvem: a linha dizia `version_code = 197` com o `apk_sha256` do APK 210.
 * O app comparava o hash do APK que ia descarregar com o hash de outro, dava
 * "não bate certo" e recusava-se a instalar — a atualização certa, bloqueada
 * por um ficheiro que ninguém tinha pedido para mudar.
 *
 * Estes testes fixam as coisas que evitam a volta:
 *
 *   1. o ficheiro descreve um APK inteiro — o mesmo código, o mesmo link e o
 *      mesmo hash que os guiões de validação instalam;
 *   2. nunca aponta para uma versão que ainda não foi construída;
 *   3. o `where` impede a regressão — mesmo que o ficheiro volte a ficar
 *      atrás, aplicá-lo não pode rebaixar a linha da nuvem;
 *   4. a coluna do hash é escrita **sempre**, mesmo quando não há hash para
 *      meter nela. Um `update` que a omita não a limpa — deixa-a como
 *      estava — e a linha ficava a dizer "v212" com o hash do APK 211;
 *   5. o hash só é escrito quando a versão **avança**. Com a versão já em
 *      ca, o hash que está na nuvem foi gravado pela release (que conhece o
 *      asset publicado) e a fotografia não o substitui;
 *   6. o APK publicado de uma versão é **imutável**: o workflow não substitui
 *      um asset já publicado, e o hash que vai para a nuvem é o do asset
 *      publicado, nunca o do build local.
 *
 * A 5 e a 6 são as duas que fecham a volta que sobrou: o asset da v211 foi
 * republicado com outros bytes (o `--clobber`), o digest rodiou, o
 * repositório ficou com o hash antigo e a nuvem passou a dizer 211 com o hash
 * de um APK 211 diferente — o app recusava-se a instalar.
 */
import fs from 'fs';
import path from 'path';

const raiz = path.join(__dirname, '..');
const ler = (p: string) => fs.readFileSync(path.join(raiz, p), 'utf8');

const sql = ler('scripts/app_version.sql');
const publicar = ler('scripts/publicar-supabase.sh');
const publicarLocal = ler('publicar.sh');
const workflow = ler('.github/workflows/build-apk.yml');
const workflowSupabase = ler('.github/workflows/publicar-supabase.yml');

/**
 * O JSON dentro do shell e do YAML vem com as aspas escapadas (`\"`), o que
 * atrapalha a quem procura o campo pelo nome. Tirar as barras deixa o texto
 * como ele é lido em runtime.
 */
const semBarras = (texto: string): string => texto.replace(/\\"/g, '"');

/**
 * O workflow e o script sao lidos sem os comentarios: o `--clobber` que se
 * proibe e' o do comando, nao o da frase que explica porquê. Um teste que
 * lesse os dois transformava a documentacao em alarme.
 */
const semComentarios = (texto: string): string =>
  texto
    .split('\n')
    .filter(linha => !linha.trim().startsWith('#'))
    .join('\n');

/** O `versionCode` que o app vai anunciando. */
const codigoDoRepo = (() => {
  const linhas = ler('android/app/version.properties').split('\n');
  const code = linhas.find(l => l.startsWith('versionCode='))?.split('=')[1]?.trim();
  if (!code) throw new Error('android/app/version.properties sem versionCode');
  return parseInt(code, 10);
})();

const valorDe = (campo: string): string => {
  const m = sql.match(new RegExp(`${campo}\\s*=\\s*'([^']*)'`));
  if (!m) throw new Error(`scripts/app_version.sql sem ${campo}`);
  return m[1];
};

const numeroDe = (campo: string): number => {
  const m = sql.match(new RegExp(`${campo}\\s*=\\s*(\\d+)`));
  if (!m) throw new Error(`scripts/app_version.sql sem ${campo}`);
  return parseInt(m[1], 10);
};

/**
 * O hash do ficheiro. Vive dentro do `case` que só o escreve quando a versão
 * avança, por isso o valor não está logo a seguir ao `=`.
 */
const hashDoFicheiro = (): string => {
  const m = sql.match(/apk_sha256\s*=\s*(?:case[^']*then\s+)?'([0-9a-f]{64})'/);
  if (!m) throw new Error('scripts/app_version.sql sem apk_sha256');
  return m[1];
};

describe('scripts/app_version.sql', () => {
  it('descreve o mesmo APK que os guiões de validação instalam', () => {
    // O `validar-apk.sh` e o `validar-termux.sh` são actualizados no mesmo
    // commit que este ficheiro (o "scripts: guião e sha256 do APK NNN"), e
    // dizem o código e o hash do APK publicado. Se os dois discordarem, o
    // hash na nuvem não é o do APK que o link dá.
    const guiao = ler('scripts/validar-apk.sh');
    const codigo = guiao.match(/ASSET="bussola-v(\d+)\.apk"/);
    const sha = guiao.match(/SHA="([0-9a-f]{64})"/);
    expect(codigo).not.toBeNull();
    expect(sha).not.toBeNull();

    expect(numeroDe('version_code')).toBe(Number(codigo?.[1]));
    expect(hashDoFicheiro()).toBe(sha?.[1]);
    expect(valorDe('update_url')).toContain(`bussola-v${codigo?.[1]}.apk`);
  });

  it('o guião do Termux concorda com o do adb', () => {
    const termux = ler('scripts/validar-termux.sh');
    const codigo = termux.match(/ASSET="\$\{ASSET:-bussola-v(\d+)\.apk\}"/);
    const sha = termux.match(/SHA="\$\{SHA:-([0-9a-f]{64})\}"/);
    expect(codigo).not.toBeNull();
    expect(sha).not.toBeNull();

    expect(numeroDe('version_code')).toBe(Number(codigo?.[1]));
    expect(hashDoFicheiro()).toBe(sha?.[1]);
  });

  it('nunca aponta para uma versão que ainda não foi construída', () => {
    // O ficheiro descreve o APK *publicado*. Pode ficar atrás da versão em
    // construção (é o que acontece entre a release e o commit do sha256), mas
    // nunca à frente: apontar para um APK que não existe dá 404 no download.
    expect(numeroDe('version_code')).toBeLessThanOrEqual(codigoDoRepo);
  });

  it('o link é direto para o APK e em https', () => {
    const url = valorDe('update_url');
    expect(url.startsWith('https://')).toBe(true);
    expect(url.endsWith('.apk')).toBe(true);
  });

  it('não pode rebaixar a versão que a release já gravou', () => {
    // O `where version_code <= N` é a rede: o workflow aplica este ficheiro em
    // qualquer commit que toque `scripts/**`, e sem ela a nuvem voltava à
    // versão antiga — com o hash da nova, que é o pior par possível.
    expect(sql).toMatch(/where\s+id\s*=\s*1\s+and\s+version_code\s*<=\s*\d+/);
  });

  it('é idempotente: aplicá-lo duas vezes deixa a mesma linha', () => {
    // O `verificar-sql.mjs` corre cada ficheiro duas vezes contra um Postgres
    // a sério, precisamente para apanhar isto.
    expect(sql.match(/where\s+id\s*=\s*1\s+and\s+version_code\s*<=\s*(\d+)/)?.[1]).toBe(
      String(numeroDe('version_code')),
    );
  });

  it('a coluna do hash é escrita sempre, mesmo quando não há hash', () => {
    // Um `update` que omita `apk_sha256` não limpa a coluna: deixa o hash da
    // release anterior na linha, e a linha passa a dizer "v212" com o hash do
    // APK 211. O app compara o ficheiro que desceu com o hash de outro e
    // recusa-se a instalar — a atualização certa, bloqueada outra vez.
    // `null` é a resposta honesta: "ninguém sabe", e o app usa o digest que a
    // GitHub calcula por asset.
    expect(sql).toMatch(/set[\s\S]*apk_sha256\s*=/);
  });

  it('o hash só é escrito quando a versão avança', () => {
    // A segunda via do mesmo bug. Com a versão já em ca, o hash que está na
    // nuvem foi gravado pela release — que conhece o asset publicado — e esta
    // fotografia não o substitui. Sem esta guarda, um ficheiro desatualizado
    // punha a linha a dizer 211 com o hash de um APK 211 diferente, e o app
    // recusava-se a instalar.
    const guarda = sql.match(
      /apk_sha256\s*=\s*case\s+when\s+version_code\s*<\s*(\d+)\s+then\s+'([0-9a-f]{64})'\s+else\s+apk_sha256\s+end/,
    );
    expect(guarda).not.toBeNull();
    expect(Number(guarda?.[1])).toBe(numeroDe('version_code'));
    expect(guarda?.[2]).toBe(hashDoFicheiro());
  });

  it('o PATCH do publicador também limpa o hash quando não tem digest', () => {
    // O mesmo caminho, na outra porta: o PATCH directo ao Supabase. Sem o
    // `null`, o `apk_sha256` ficava com o valor da release anterior.
    // As aspas do JSON estão escapadas no shell (`\"`), por isso o texto é
    // lido sem as barras.
    expect(semBarras(publicar)).toMatch(/"apk_sha256":null/);
    expect(publicar).not.toMatch(/SHA_COLUMN=""/);
  });
});

describe('o APK publicado de uma versão é imutável', () => {
  it('o workflow da build não substitui um asset já publicado', () => {
    // O `--clobber` era a origem do problema: republicava o APK da mesma
    // versão com outros bytes (um APK não é reprodutível byte a byte), o
    // digest rodia, o hash que o repositório guardava deixava de bater e a
    // nuvem acabava a dizer 211 com o hash de um APK 211 diferente.
    expect(semComentarios(workflow)).not.toMatch(/--clobber/);
  });

  it('o hash que vai para a nuvem é o do asset publicado', () => {
    // O build local e o asset publicado são o mesmo ficheiro, mas o publicado
    // é o que os utilizadores descarregam e o que o app compara. O passo da
    // nuvem tem de pegar no digest que a GitHub calcula, não no `sha256sum`
    // do ficheiro que o build acabou de fazer.
    expect(workflow).toMatch(/gh release view bussola-apk[\s\S]*?\.digest/);
    expect(workflow).toMatch(/steps\.publicar\.outputs\.apk_sha256/);
    expect(workflow).not.toMatch(/sha256sum \/tmp\/bussola-v/);
  });

  it('o PATCH só avança o ponteiro: nunca rebaixa', () => {
    // Um run antigo (um commit mais velho que só agora termina o build) não
    // pode rebaixar o ponteiro que uma release mais nova já gravou.
    expect(workflow).toMatch(/version_code=lte\.\$CODE/);
    expect(publicar).toMatch(/version_code=lte\.\$VERSION_CODE/);
    expect(workflowSupabase).toMatch(/version_code=lte\.\$CODE/);
  });

  it('a release não limpa um hash bom quando o PATCH falha', () => {
    // A segunda tentativa só acontece quando a coluna `apk_sha256` não
    // existe na nuvem — e nesse caso não há hash nenhum para limpar. Um
    // `apk_sha256: null` seria inútil (a coluna não existe, o PATCH volta a
    // falhar) e perigoso (se a coluna existisse, apagava um hash bom).
    expect(semBarras(workflow)).not.toMatch(/"apk_sha256":null/);
  });

  it('o workflow da release escreve o hash e tem token', () => {
    // Sem `GH_TOKEN` o `gh api` respondia 401 e o workflow morria antes de
    // tocar na nuvem (foi o que aconteceu na única execução dele).
    expect(workflowSupabase).toMatch(/GH_TOKEN:/);
    expect(workflowSupabase).toMatch(/apk_sha256/);
  });

  it('o publicador local só substitui o asset a pedido', () => {
    expect(publicarLocal).toMatch(/REPUBLICAR/);
    expect(publicarLocal.indexOf('--clobber')).toBeGreaterThan(
      publicarLocal.indexOf('REPUBLICAR'),
    );
  });
});
