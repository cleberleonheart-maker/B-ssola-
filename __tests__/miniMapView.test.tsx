import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import MiniMapView, { mapSideFor } from '../src/components/MiniMapView';
import { createTranslator } from '../src/i18n/strings';
import type { LocationFix } from '../src/services/locationService';

const t = createTranslator('pt');

const LISBOA = { latitude: 38.7223, longitude: -9.1393 };

const fix = (over: Partial<LocationFix> = {}): LocationFix => ({
  latitude: LISBOA.latitude,
  longitude: LISBOA.longitude,
  accuracy: 8,
  altitude: null,
  speed: null,
  provider: 'gps',
  updatedAt: 1,
  heading: null,
  ...over,
});

const render = (props: { active?: boolean; location: LocationFix; heading?: number }) => {
  let r!: ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <LanguageProvider>
        <ThemeProvider>
          <MiniMapView
            active={props.active ?? true}
            location={props.location}
            heading={props.heading}
          />
        </ThemeProvider>
      </LanguageProvider>,
    );
  });
  return r;
};

/**
 * Um `Text` pode receber um array (`{value}{second}`), e o `style` é sempre um
 * array. Sem achatar, as comparações com uma frase inteira nunca batem.
 */
const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map(n => flatten(n.props.children));

const flatten = (children: unknown): string => {
  if (Array.isArray(children)) return children.map(flatten).join('');
  if (children == null || typeof children === 'boolean') return '';
  return String(children);
};

const views = (r: ReactTestRenderer): Record<string, unknown>[] =>
  r.root
    .findAllByType(View)
    .map(n => StyleSheet.flatten(n.props.style as never) as Record<string, unknown>);

describe('MiniMapView', () => {
  /**
   * O mesmo custo frio do `whatsNewModal`, aqui menor mas dentro do prazo por
   * pouco: o primeiro teste gastava 4,0 s dos 5 s que o Jest dá, e os
   * seguintes 14–84 ms. Com as 22 suites em paralelo é uma margem que não
   * existe — o mesmo flake, à espera doCI lhe mudar a hora.
   *
   * O render de aquecimento tira o frio do caminho quente; a árvore é
   * desmontada para não deixar efeitos vivos para os testes seguintes. Ver
   * `whatsNewModal.test.tsx` para a conta completa: 15,9 s → 42 ms.
   */
  let aquecimento: ReactTestRenderer | undefined;

  beforeAll(() => {
    act(() => {
      aquecimento = TestRenderer.create(
        <LanguageProvider>
          <ThemeProvider>
            <MiniMapView active location={fix()} />
          </ThemeProvider>
        </LanguageProvider>,
      );
    });
  }, 120_000);

  afterAll(() => {
    if (aquecimento) act(() => aquecimento?.unmount());
    aquecimento = undefined;
  });

  it('sem GPS diz que está à espera, em vez de desenhar o nada', () => {
    const r = render({ location: fix({ latitude: 0, longitude: 0, accuracy: null }) });

    expect(texts(r)).toContain(t('map_no_fix'));
    expect(texts(r)).not.toContain(t('map_coords'));
  });

  it('com GPS mostra a posição em graus', () => {
    const shown = texts(render({ location: fix() }));

    expect(shown).toContain(t('map_coords'));
    expect(shown).toContain(t('map_accuracy'));
    expect(shown.join(' ')).toContain('38.722300 N');
    expect(shown.join(' ')).toContain('9.139300 W');
  });

  it('a precisão sai em metros, com o sinal de mais ou menos', () => {
    const shown = texts(render({ location: fix({ accuracy: 12 }) }));

    expect(shown).toContain('±12 m');
  });

  it('precisão desconhecida é dita como desconhecida, não como zero', () => {
    const shown = texts(render({ location: fix({ accuracy: null }) }));

    expect(shown).toContain(t('map_unknown'));
    expect(shown.join(' ')).not.toContain('±0 m');
  });

  it('sem rumo do sensor não inventa um', () => {
    const shown = texts(render({ location: fix(), heading: undefined }));

    expect(shown).toContain(t('map_heading_none'));
  });

  it('com rumo mostra os graus e a direção cardinal, em texto', () => {
    const shown = texts(render({ location: fix(), heading: 90 }));

    // 90° para leste: `cardinalOf` devolve um objecto e o resumo tem de
    // mostrar a sigla, nunca "[object Object]".
    expect(shown.join(' ')).toContain('090° L');
    expect(shown.join(' ')).not.toContain('[object');
  });

  it('no primeiro abrir ainda não há nada andado', () => {
    const shown = texts(render({ location: fix() }));

    expect(shown).toContain(t('map_no_track'));
  });

  it('a caixa é quadrada e cabe na largura do ecrã', () => {
    const r = render({ location: fix() });
    const side = mapSideFor(Dimensions.get('window').width);
    const canvas = views(r).find(v => v.width === side);

    expect(canvas).toBeDefined();
    expect(canvas!.height).toBe(side);
  });

  it('o mapa diz que não precisa de rede', () => {
    expect(texts(render({ location: fix() }))).toContain(t('map_offline'));
  });

  describe('zoom', () => {
    // `Pressable` é React.memo nesta versão do RN e o `findAllByType` não
    // desembrulha memo: devolve vazio. Busca-se pelo nome.
    const pressables = (r: ReactTestRenderer) =>
      r.root.findAll(
        n => typeof n.type !== 'string' && (n.type as { name?: string }).name === 'Pressable',
        { deep: true },
      );

    it('aproximar parte de 400 m para 150 m', () => {
      const r = render({ location: fix() });
      expect(texts(r)).toContain('400 m');

      act(() => pressables(r)[1].props.onPress());

      expect(texts(r)).toContain('150 m');
    });

    it('afastar é o oposto de aproximar', () => {
      const r = render({ location: fix() });
      act(() => pressables(r)[1].props.onPress());
      expect(texts(r)).toContain('150 m');

      act(() => pressables(r)[0].props.onPress());

      expect(texts(r)).toContain('400 m');
    });

    it('não passa do nível mais fechado', () => {
      const r = render({ location: fix() });
      for (let i = 0; i < 9; i++) {
        act(() => pressables(r)[1].props.onPress());
      }

      expect(texts(r)).toContain('50.0 m');
    });

    it('não passa do nível mais afastado', () => {
      const r = render({ location: fix() });
      for (let i = 0; i < 9; i++) {
        act(() => pressables(r)[0].props.onPress());
      }

      expect(texts(r)).toContain('400 m');
    });
  });
});

describe('mapSideFor', () => {
  it('nunca é menor do que o minimumo utilizável', () => {
    expect(mapSideFor(0)).toBe(200);
    expect(mapSideFor(240)).toBe(200);
  });

  it('num ecrã largo não passa do máximo', () => {
    expect(mapSideFor(2000)).toBe(360);
  });

  it('num telemóvel normal usa quase a largura toda, menos a margem', () => {
    expect(mapSideFor(400)).toBe(352);
  });
});