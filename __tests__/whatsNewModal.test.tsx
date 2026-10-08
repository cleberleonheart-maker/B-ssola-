import React from 'react';
import { Modal, Text } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import WhatsNewModal from '../src/components/WhatsNewModal';
import { createTranslator } from '../src/i18n/strings';
import { APP_VERSION, APP_VERSION_CODE } from '../src/version.generated';

/** O build instalado. Todo o resto é relativo a ele: escrever o número à mão
 *  parte estes testes a cada release, sem ninguém perceber porquê. */
const CURRENT = APP_VERSION_CODE;

const t = createTranslator('pt');

/**
 * `await act` porque `ThemeProvider` e `LanguageProvider` leem o storage no
 * `useEffect`: sem esperar a promise, o state chega depois do fim do teste e o
 * React desmonta a árvore — os testes seguintes só passariam por não haver
 * nada para assertar.
 */
const render = async (
  lastSeen: number | null,
  visible = true,
): Promise<ReactTestRenderer> => {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LanguageProvider>
        <ThemeProvider>
          <WhatsNewModal visible={visible} onClose={() => {}} lastSeen={lastSeen} />
        </ThemeProvider>
      </LanguageProvider>,
    );
  });
  return r;
};

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map(node => node.props.children as string);

/**
 * O modal é a única tela que mostra o changelog, então um erro de fiação aqui
 * não aparece em nenhum outro teste: `changelogBetween` pode estar certo e o
 * componente passar `lastSeen` errado (ou não passar), e nada reclamar.
 */
describe('WhatsNewModal', () => {
  /**
   * O custo frio é pago aqui, e não dentro de um teste.
   *
   * O primeiro render desta suíte gastava 15,9 s — a transformação do Babel de
   * `react-native`, do `i18n/strings` e do componente, mais o primeiro
   * `act()` a construir as árvores. Os sete testes seguintes gastam 13–192 ms,
   * porque já estão quentes. Esse frio estava dentro do relógio do primeiro
   * teste, e é por isso que ele falhava sozinho: subir o prazo de 5 s para 30 s
   * (`ad69437`) comprou margem em vez de tirar a causa, e voltou a estalar com
   * as 22 suites a correr em paralelo.
   *
   * Um render de aquecimento em `beforeAll` tira o frio do caminho quente: o
   * primeiro teste passou de 15,9 s para 42 ms e volta ao prazo normal do
   * Jest, onde um teste lento deve aparecer como timeout de *si* e não
   * emprestar o custo a toda a gente.
   *
   * A árvore do aquecimento desmonta-se no `afterAll`: ficar montada deixaria
   * efeitos e timers vivos para os testes seguintes, e a culpa apareceria noutro
   * sítio.
   */
  let aquecimento: ReactTestRenderer | undefined;

  beforeAll(async () => {
    aquecimento = await render(null);
  }, 120_000);

  afterAll(() => {
    if (aquecimento) act(() => aquecimento?.unmount());
    aquecimento = undefined;
  });

  it('renderiza o Modal quando visible é verdadeiro', async () => {
    const r = await render(null);
    expect(r.root.findAllByType(Modal)).toHaveLength(1);
    // As novidades do build atual aparecem todas.
    expect(texts(r)).toContain(t('wn_shares_title'));
  });

  it('sem última versão vista, mostra só a atual e sem cabeçalho de build', async () => {
    const shown = texts(await render(null));
    expect(shown).toContain(t('wn_shares_title'));
    expect(shown).toContain(t('wn_title', { version: APP_VERSION }));
    expect(shown).not.toContain(t('wn_build_label', { code: CURRENT }));
  });

  it('com última versão vista, acumula as versões do intervalo', async () => {
    const shown = texts(await render(151));
    // Uma entrada de cada build de 152 ao atual.
    expect(shown).toContain(t('wn_livesrumo_title'));
    expect(shown).toContain(t('wn_updatefix_title'));
    expect(shown).toContain(t('wn_tidy_title'));
    // E nada do que ficou de fora do intervalo (151 e anteriores).
    expect(shown).not.toContain(t('wn_odo_title'));
    expect(shown).not.toContain(t('wn_tri_title'));
  });

  it('no acumulado, o título diz desde quando, não a versão atual', async () => {
    const shown = texts(await render(151));
    expect(shown).toContain(t('wn_title_since', { code: 151 }));
    expect(shown).not.toContain(t('wn_title', { version: APP_VERSION }));
  });

  it('no acumulado, cada build aparece com seu número', async () => {
    const shown = texts(await render(151));
    for (const code of Array.from(
      { length: CURRENT - 151 },
      (_, i) => CURRENT - i,
    )) {
      expect(shown).toContain(t('wn_build_label', { code }));
    }
  });

  it('o grupo mais novo é o da versão instalada', async () => {
    const labels = texts(await render(151)).filter(s => s.includes('Build '));
    expect(labels[0]).toBe(t('wn_build_label', { code: CURRENT }));
  });

  it('a mesma versão vista não abre o modal com nada de novo', async () => {
    const shown = texts(await render(CURRENT));
    expect(shown).toContain(t('wn_shares_title'));
    expect(shown).not.toContain(t('wn_title_since', { code: CURRENT }));
  });

  it('uma entrada repetida em vários builds não vira linha duplicada', async () => {
    const shown = texts(await render(134));
    expect(shown.filter(s => s === t('wn_cam2_title'))).toHaveLength(1);
  });
});
