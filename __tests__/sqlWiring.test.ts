import fs from 'fs';
import path from 'path';

const raiz = path.join(__dirname, '..');
const ler = (p: string) => fs.readFileSync(path.join(raiz, p), 'utf8');

/**
 * A lista de SQL vive em três sítios e tem de ser a mesma nos três.
 *
 * Isto não é burocracia. O `rls.sql` passou meses no repositório sem nunca ter
 * chegado à nuvem, e ninguém reparou: o verificador local testava o ficheiro e
 * dava verde, o workflow aplicava os seus quatro ficheiros sem reclamar, e a
 * diferença só apareceu quando um bug pediu a tabela. Um `.sql` novo que entra
 * no verificador local mas fica de fora do workflow é exactamente esse buraco,
 * de novo — e é o que aconteceu com o `crashes.sql` na primeira vez que esta
 * feature foi feita.
 *
 * Por isso, um teste: se alguém acrescentar um `scripts/*.sql` e se esquecer de
 * o ligar aos outros sítios, falha aqui e não em produção.
 */

const sqlNoDisco = fs
  .readdirSync(path.join(raiz, 'scripts'))
  .filter(f => f.endsWith('.sql'))
  .sort();

const listaDoVerificadorLocal = (() => {
  const m = ler('scripts/verificar-sql.mjs').match(/const FICHEIROS = \[([\s\S]*?)\]/);
  if (!m) throw new Error('verificar-sql.mjs perdeu a lista FICHEIROS');
  return [...m[1].matchAll(/'([^']+\.sql)'/g)].map(x => x[1]);
})();

const ordemWorkflow = (() => {
  const m = ler('.github/workflows/verificar-nuvem.yml').match(
    /publicar-sql\.sh\s+((?:\\\n\s+scripts\/[\w.]+\s*)+)/,
  );
  if (!m) throw new Error('o workflow deixou de chamar publicar-sql.sh com a lista de ficheiros');
  return [...m[1].matchAll(/scripts\/([\w.]+\.sql)/g)].map(x => x[1]);
})();

describe('os três sítios que sabem que há SQL', () => {
  it('o verificador local conhece todos os ficheiros de scripts/', () => {
    expect([...listaDoVerificadorLocal].sort()).toEqual(sqlNoDisco);
  });

  it('o workflow aplica todos os ficheiros que o verificador local conhece', () => {
    // O teste que faltava na primeira vez do `crashes.sql`.
    expect([...ordemWorkflow].sort()).toEqual([...listaDoVerificadorLocal].sort());
  });

  it('o workflow aplica-os pela mesma ordem do verificador local', () => {
    // A ordem não é decorativa: `app_version_sha.sql` acrescenta uma coluna a
    // `app_version`, e `crashes.sql` faz `grant`/`policy` numa tabela nova.
    // Aplicar fora de ordem pode correr um `alter` antes do `create`.
    expect(ordemWorkflow).toEqual(listaDoVerificadorLocal);
  });
});

describe('o verificador da nuvem', () => {
  const tabelasDaNuvem = () => {
    const m = ler('scripts/verificar-nuvem.sh').match(/for t in ([^;]+); do/);
    if (!m) throw new Error('verificar-nuvem.sh perdeu a lista de tabelas');
    return m[1].trim().split(/\s+/);
  };

  it('exige a tabela que cada SQL cria', () => {
    // `live_shares` e `virgin_memory` vêm do `rls.sql`; as restantes de cada
    // ficheiro. Se um SQL criar uma tabela nova e esta lista não a exigir, o
    // `--strict` do fim do workflow passa a dar verde sem a tabela existir.
    const esperadas = [
      'app_version',
      'live_shares',
      'live_points',
      'virgin_memory',
      'tracks',
      'notes',
      'crashes',
    ];
    expect(tabelasDaNuvem().sort()).toEqual([...esperadas].sort());
  });

  it('cada tabela exigida é criada por algum dos SQL', () => {
    const sql = sqlNoDisco.map(f => ler(path.join('scripts', f))).join('\n');
    for (const t of tabelasDaNuvem()) {
      expect(sql).toMatch(new RegExp(`create table( if not exists)? (public\\.)?${t}\\b`, 'i'));
    }
  });
});
