import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  changelogFor,
  changelogBetween,
  type ChangelogEntry,
} from '../src/services/changelog';
import {
  loadChangelogSeen,
  markChangelogSeen,
} from '../src/services/changelogSeen';
import { createTranslator, STRINGS } from '../src/i18n/strings';

const stringsEn = STRINGS.en;

const t = createTranslator('pt');
const CURRENT = 173;

const titles = (entries: ChangelogEntry[]) => entries.map(e => e.title);

describe('changelogFor', () => {
  it('devolve as entradas do build', () => {
    expect(changelogFor(158, t)).toHaveLength(4);
    expect(changelogFor(157, t)).toHaveLength(1);
    expect(titles(changelogFor(152, t))).toHaveLength(2);
  });

  it('cai na entrada conhecida imediatamente abaixo quando o build não tem uma', () => {
    // Build novo cujo changelog ainda não foi escrito, ou código muito à frente.
    // Relativo a CURRENT: senão cada bump parte estes testes, e o que se está a
    // testar é o fallback, não um número em concreto.
    expect(changelogFor(CURRENT + 1, t)).toEqual(changelogFor(CURRENT, t));
    expect(changelogFor(500, t)).toEqual(changelogFor(CURRENT, t));
  });

  it('devolve vazio quando não há build conhecido abaixo', () => {
    expect(changelogFor(100, t)).toEqual([]);
  });

  it('não devolve as entradas de um build acima do pedido', () => {
    expect(titles(changelogFor(150, t))).not.toContain(
      titles(changelogFor(157, t))[0],
    );
  });
});

describe('changelogBetween — o que acumula', () => {
  it('uma versão de intervalo mostra só ela', () => {
    expect(changelogBetween(CURRENT - 1, CURRENT, t)).toEqual([
      { code: CURRENT, entries: changelogFor(CURRENT, t) },
    ]);
  });

  it('acumula várias versões, da mais nova para a mais antiga', () => {
    const builds = changelogBetween(151, CURRENT, t);
    const expected = Array.from({ length: CURRENT - 151 }, (_, i) => CURRENT - i);
    expect(builds.map(b => b.code)).toEqual(expected);
  });

  it('o grupo mais novo é sempre a versão que está instalada', () => {
    expect(changelogBetween(140, CURRENT, t)[0].code).toBe(CURRENT);
  });

  it('o intervalo é exclusivo na ponta de baixo: a versão já vista não volta', () => {
    const builds = changelogBetween(156, CURRENT, t);
    expect(builds.map(b => b.code)).not.toContain(156);
  });

  it('quem salta de uma versão muito antiga recebe tudo o que há no dicionário', () => {
    const builds = changelogBetween(80, CURRENT, t);
    expect(builds.length).toBeGreaterThan(10);
    expect(builds.map(b => b.code)).toEqual([...builds.map(b => b.code)].sort((a, b) => b - a));
    expect(builds.map(b => b.code)).toContain(135);
    expect(builds.map(b => b.code)).toContain(CURRENT);
  });

  it('traduz para o idioma pedido', () => {
    // O título do build atual em inglês tem de ser a tradução dele, e não a de
    // português. Fixa a chave pela entrada do próprio dicionário em vez de a
    // escrever: a entrada muda a cada release e o teste partia sem se perceber porquê.
    const enT = createTranslator('en');
    const tituloEn = changelogFor(CURRENT, enT)[0].title;
    expect(tituloEn).not.toBe(changelogFor(CURRENT, t)[0].title);
    // A mesma chave em português dá a versão portuguesa: o mesmo título em dois
    // idiomas só sai disto, e não de uma cópia colada à mão.
    const chave = (Object.keys(stringsEn) as Array<keyof typeof stringsEn>).find(
      k => stringsEn[k] === tituloEn,
    );
    expect(chave).toBeDefined();
    expect(t(chave as string)).toBe(changelogFor(CURRENT, t)[0].title);
  });
});

describe('changelogBetween — o que não acumula', () => {
  it('instalação nova mostra só a versão atual, não as 20 anteriores', () => {
    expect(changelogBetween(null, CURRENT, t)).toEqual([
      { code: CURRENT, entries: changelogFor(CURRENT, t) },
    ]);
  });

  it('a mesma versão não repete o que já foi visto', () => {
    expect(changelogBetween(CURRENT, CURRENT, t)).toEqual([
      { code: CURRENT, entries: changelogFor(CURRENT, t) },
    ]);
  });

  it('downgrade não vira novidade: mostra só a versão instalada', () => {
    expect(changelogBetween(156, 150, t)).toEqual([
      { code: 150, entries: changelogFor(150, t) },
    ]);
  });

  /**
   * O build seguinte ao atual sobe e o changelog ainda não foi escrito. Se o grupo
   * do build atual não entrasse na lista, quem vinha de CURRENT-1 veria um modal
   * vazio: esse já foi visto e a entrada dele foi consumida pela de cima.
   */
  it('build novo sem changelog escrito mostra o que houve por último', () => {
    const builds = changelogBetween(CURRENT, CURRENT + 1, t);
    expect(builds.map(b => b.code)).toEqual([CURRENT + 1]);
    expect(builds[0].entries).toEqual(changelogFor(CURRENT, t));
  });

  it('a entrada do build mais recente não aparece duplicada sob o código antigo', () => {
    // O mesmo título nos dois grupos seria duas linhas iguais na tela.
    const titles = changelogBetween(CURRENT - 2, CURRENT, t).flatMap(b =>
      b.entries.map(e => e.title),
    );
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('build muito à frente mostra a entrada conhecida mais recente', () => {
    const builds = changelogBetween(500, 501, t);
    expect(builds.map(b => b.code)).toEqual([501]);
    expect(builds[0].entries).toEqual(changelogFor(CURRENT, t));
  });
});

describe('changelogBetween — repetição', () => {
  /**
   * Os builds 135–138 anunciam a mesma correção de câmera. Quem saltou do 134
   * para o 138 veria a mesma frase quatro vezes seguidas, com quatro linhas
   * idênticas na lista.
   */
  it('uma entrada repetida em vários builds aparece uma vez só', () => {
    const builds = changelogBetween(134, 138, t);
    const all = builds.flatMap(b => titles(b.entries));
    expect(new Set(all).size).toBe(all.length);
    expect(all.filter(title => title === t('wn_cam2_title'))).toHaveLength(1);
  });

  it('a repetição fica no build mais novo, que é onde a mudança aconteceu', () => {
    const builds = changelogBetween(134, 138, t);
    const withCam = builds.find(b => titles(b.entries).includes(t('wn_cam2_title')));
    expect(withCam?.code).toBe(138);
  });

  it('o grupo que ficou só com repetição some, em vez de virar um cabeçalho vazio', () => {
    // 137 e 136 são a mesma correção de câmera; o 135 tem novidades próprias.
    const builds = changelogBetween(134, 137, t);
    expect(builds.map(b => b.code)).toEqual([137, 135]);
    expect(builds.every(b => b.entries.length > 0)).toBe(true);
  });
});

describe('última versão vista', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('devolve null quando nunca foi visto', async () => {
    expect(await loadChangelogSeen()).toBeNull();
  });

  it('guarda e lê o build', async () => {
    await markChangelogSeen(151);
    expect(await loadChangelogSeen()).toBe(151);
  });

  it('o que está gravado decide o que o modal mostra', async () => {
    // A partir de 151 até CURRENT inclusive: o número de grupos depende de
    // quantos builds existem no dicionário, e escrevê-lo à mão parte a cada
    // release. O que interessa é que o que está gravado é o ponto de partida.
    await markChangelogSeen(151);
    const desde151 = changelogBetween(await loadChangelogSeen(), CURRENT, t);
    expect(desde151[0].code).toBe(CURRENT);
    expect(desde151).toHaveLength(CURRENT - 151);
  });

  it('valor corrompido vira null em vez de NaN no meio do cálculo', async () => {
    await AsyncStorage.setItem('@bussola/changelogSeen', 'build 151');
    expect(await loadChangelogSeen()).toBeNull();
  });

  it('storage quebrado não derruba o app na abertura', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValue(new Error('disco cheio'));
    expect(await loadChangelogSeen()).toBeNull();
    spy.mockRestore();
  });

  it('falha ao gravar é engolida, senão o fechar do modal lança', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValue(new Error('disco cheio'));
    await expect(markChangelogSeen(158)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
