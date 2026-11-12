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
 * Estes testes fixam as três coisas que evitam a volta:
 *
 *   1. o ficheiro descreve um APK inteiro — o mesmo código, o mesmo link e o
 *      mesmo hash que os guiões de validação instalam;
 *   2. nunca aponta para uma versão que ainda não foi construída;
 *   3. o `where` impede a regressão — mesmo que o ficheiro volte a ficar
 *      atrás, aplicá-lo não pode rebaixar a linha da nuvem.
 */
import fs from 'fs';
import path from 'path';

const raiz = path.join(__dirname, '..');
const ler = (p: string) => fs.readFileSync(path.join(raiz, p), 'utf8');

const sql = ler('scripts/app_version.sql');

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
    expect(valorDe('apk_sha256')).toBe(sha?.[1]);
    expect(valorDe('update_url')).toContain(`bussola-v${codigo?.[1]}.apk`);
  });

  it('o guião do Termux concorda com o do adb', () => {
    const termux = ler('scripts/validar-termux.sh');
    const codigo = termux.match(/ASSET="\$\{ASSET:-bussola-v(\d+)\.apk\}"/);
    const sha = termux.match(/SHA="\$\{SHA:-([0-9a-f]{64})\}"/);
    expect(codigo).not.toBeNull();
    expect(sha).not.toBeNull();

    expect(numeroDe('version_code')).toBe(Number(codigo?.[1]));
    expect(valorDe('apk_sha256')).toBe(sha?.[1]);
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
});
