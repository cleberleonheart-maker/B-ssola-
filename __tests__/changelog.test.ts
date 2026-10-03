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
import { createTranslator } from '../src/i18n/strings';

const t = createTranslator('pt');
const CURRENT = 158;

const titles = (entries: ChangelogEntry[]) => entries.map(e => e.title);

describe('changelogFor', () => {
  it('devolve as entradas do build', () => {
    expect(changelogFor(158, t)).toHaveLength(4);
    expect(changelogFor(157, t)).toHaveLength(1);
    expect(titles(changelogFor(152, t))).toHaveLength(2);
  });

  it('cai na entrada conhecida imediatamente abaixo quando o build não tem uma', () => {
    // Build novo cujo changelog ainda não foi escrito, ou código muito à frente.
    expect(changelogFor(159, t)).toEqual(changelogFor(158, t));
    expect(changelogFor(200, t)).toEqual(changelogFor(158, t));
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
    expect(changelogBetween(157, CURRENT, t)).toEqual([
      { code: 158, entries: changelogFor(158, t) },
    ]);
  });

  it('acumula várias versões, da mais nova para a mais antiga', () => {
    const builds = changelogBetween(151, CURRENT, t);
    expect(builds.map(b => b.code)).toEqual([158, 157, 156, 155, 154, 153, 152]);
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
    const en = changelogBetween(157, CURRENT, createTranslator('en'));
    expect(en[0].entries[0].title).toBe(
      createTranslator('en')('wn_livenative_title'),
    );
    expect(en[0].entries[0].title).not.toBe(changelogFor(158, t)[0].title);
  });
});

describe('changelogBetween — o que não acumula', () => {
  it('instalação nova mostra só a versão atual, não as 20 anteriores', () => {
    expect(changelogBetween(null, CURRENT, t)).toEqual([
      { code: 158, entries: changelogFor(158, t) },
    ]);
  });

  it('a mesma versão não repete o que já foi visto', () => {
    expect(changelogBetween(CURRENT, CURRENT, t)).toEqual([
      { code: 158, entries: changelogFor(158, t) },
    ]);
  });

  it('downgrade não vira novidade: mostra só a versão instalada', () => {
    expect(changelogBetween(156, 150, t)).toEqual([
      { code: 150, entries: changelogFor(150, t) },
    ]);
  });

  /**
   * O build 159 subiu e o changelog ainda não foi escrito. Se o grupo do build
   * atual não entrasse na lista, quem vinha do 157 veria um modal vazio: o
   * 158 já foi visto e a entrada dele foi consumida pela de cima.
   */
  it('build novo sem changelog escrito mostra o que houve por último', () => {
    const builds = changelogBetween(157, 159, t);
    expect(builds.map(b => b.code)).toEqual([159]);
    expect(builds[0].entries).toEqual(changelogFor(158, t));
  });

  it('a entrada do build mais recente não aparece duplicada sob o código antigo', () => {
    // O mesmo título nos dois grupos seria duas linhas iguais na tela.
    const titles = changelogBetween(157, 159, t).flatMap(b =>
      b.entries.map(e => e.title),
    );
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('build muito à frente mostra a entrada conhecida mais recente', () => {
    const builds = changelogBetween(500, 501, t);
    expect(builds.map(b => b.code)).toEqual([501]);
    expect(builds[0].entries).toEqual(changelogFor(158, t));
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
    await markChangelogSeen(151);
    expect(changelogBetween(await loadChangelogSeen(), CURRENT, t).length).toBe(7);
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
