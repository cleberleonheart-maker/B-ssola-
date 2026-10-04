import React from 'react';
import { Modal, Text } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import WhatsNewModal from '../src/components/WhatsNewModal';
import { createTranslator } from '../src/i18n/strings';
import { APP_VERSION } from '../src/version.generated';

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
  it('renderiza o Modal quando visible é verdadeiro', async () => {
    const r = await render(null);
    expect(r.root.findAllByType(Modal)).toHaveLength(1);
    expect(texts(r)).toContain(t('wn_liveheadingfix_title'));
  });

  it('sem última versão vista, mostra só a atual e sem cabeçalho de build', async () => {
    const shown = texts(await render(null));
    expect(shown).toContain(t('wn_liveheadingfix_title'));
    expect(shown).toContain(t('wn_title', { version: APP_VERSION }));
    expect(shown).not.toContain(t('wn_build_label', { code: 163 }));
  });

  it('com última versão vista, acumula as versões do intervalo', async () => {
    const shown = texts(await render(151));
    // Uma entrada de cada build de 152 a 163.
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
    for (const code of [163, 162, 161, 160, 159, 158, 157, 156, 155, 154, 153, 152]) {
      expect(shown).toContain(t('wn_build_label', { code }));
    }
  });

  it('o grupo mais novo é o da versão instalada', async () => {
    const labels = texts(await render(151)).filter(s => s.includes('Build '));
    expect(labels[0]).toBe(t('wn_build_label', { code: 163 }));
  });

  it('a mesma versão vista não abre o modal com nada de novo', async () => {
    const shown = texts(await render(163));
    expect(shown).toContain(t('wn_liveheadingfix_title'));
    expect(shown).not.toContain(t('wn_title_since', { code: 163 }));
  });

  it('uma entrada repetida em vários builds não vira linha duplicada', async () => {
    const shown = texts(await render(134));
    expect(shown.filter(s => s === t('wn_cam2_title'))).toHaveLength(1);
  });
});
