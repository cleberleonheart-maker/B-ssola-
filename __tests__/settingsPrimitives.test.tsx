import React from 'react';
import { StyleSheet, Text } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { themes } from '../src/theme/themes';
import {
  GridOption,
  GroupRow,
  SwitchRow,
  RadioRow,
  ChevronRow,
} from '../src/components/settings/primitives';

const colors = themes.space;

const render = (ui: React.ReactElement): ReactTestRenderer => {
  let r!: ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{ui}</ThemeProvider>);
  });
  return r;
};

// `Pressable` é React.memo nesta versão do RN, e o findAllByType do
// react-test-renderer não desembrulha memo: devolve vazio. Busca por nome.
const pressables = (r: ReactTestRenderer) =>
  r.root.findAll(
    n => typeof n.type !== 'string' && (n.type as { name?: string }).name === 'Pressable',
    { deep: true },
  );

const flat = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map(t => t.props.children as string);

describe('primitivas de Configurações', () => {
  describe('SwitchRow', () => {
    it('aciona onPress ao tocar no interruptor', () => {
      const onPress = jest.fn();
      const r = render(
        <SwitchRow icon="🔊" label="Som" sub="Beep ao achar metal" on={false} onPress={onPress} />,
      );
      pressables(r)[0].props.onPress();
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    // O Pressable recebe onPress mesmo desabilitado: quem bloqueia é o
    // `disabled`, então o que se verifica aqui é a prop, não a ausência do
    // callback.
    it('marca o interruptor como desabilitado', () => {
      const r = render(
        <SwitchRow icon="🔊" label="Som" sub="x" on={false} onPress={jest.fn()} disabled />,
      );
      expect(pressables(r)[0].props.disabled).toBe(true);
    });

    it('nao marca disabled quando habilitado', () => {
      const r = render(<SwitchRow icon="🔊" label="Som" sub="x" on onPress={jest.fn()} />);
      expect(pressables(r)[0].props.disabled).toBeFalsy();
    });

    // Comportamento proposital: no SwitchRow so o interruptor responde ao
    // toque. Se um dia a linha inteira virar clicavel, este teste quebra.
    it('deixa apenas o interruptor clicavel, nao a linha inteira', () => {
      const r = render(<SwitchRow icon="🔊" label="Som" sub="x" on onPress={jest.fn()} />);
      expect(pressables(r)).toHaveLength(1);
    });

    it('inverte as cores do trilho conforme on', () => {
      const on = render(<SwitchRow icon="a" label="l" sub="s" on onPress={jest.fn()} />);
      const off = render(<SwitchRow icon="a" label="l" sub="s" on={false} onPress={jest.fn()} />);
      expect(flat(pressables(on)[0]).backgroundColor).toBe(colors.primary);
      expect(flat(pressables(off)[0]).backgroundColor).toBe(colors.surfaceAlt);
    });
  });

  describe('RadioRow', () => {
    it('torna a linha inteira clicavel', () => {
      const onPress = jest.fn();
      const r = render(
        <RadioRow icon="🧭" label="Bússola" sub="Norte magnético" selected={false} onPress={onPress} />,
      );
      pressables(r)[0].props.onPress();
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('destaca o subtitulo so quando selecionado', () => {
      const sel = render(
        <RadioRow icon="🧭" label="B" sub="s" selected onPress={jest.fn()} />,
      );
      const un = render(
        <RadioRow icon="🧭" label="B" sub="s" selected={false} onPress={jest.fn()} />,
      );
      const subOf = (r: ReactTestRenderer) => flat(r.root.findAllByType(Text)[2]);
      expect(subOf(sel).color).toBe(colors.text);
      expect(subOf(un).color).toBe(colors.textMuted);
    });
  });

  describe('ChevronRow', () => {
    it('aciona onPress e usa o chevron padrao', () => {
      const onPress = jest.fn();
      const r = render(<ChevronRow icon="📍" label="Locais" sub="x" onPress={onPress} />);
      pressables(r)[0].props.onPress();
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(texts(r)).toContain('›');
    });

    it('aceita chevron customizado', () => {
      const r = render(
        <ChevronRow icon="📍" label="Locais" sub="x" onPress={jest.fn()} chevronText="→" />,
      );
      expect(texts(r)).toContain('→');
      expect(texts(r)).not.toContain('›');
    });
  });

  describe('GridOption', () => {
    it('muda a borda conforme selected', () => {
      const sel = render(<GridOption label="Escuro" selected onPress={jest.fn()} />);
      const un = render(<GridOption label="Escuro" selected={false} onPress={jest.fn()} />);
      expect(flat(pressables(sel)[0]).borderColor).toBe(colors.primary);
      expect(flat(pressables(un)[0]).borderColor).toBe(colors.border);
    });

    it('aciona onPress', () => {
      const onPress = jest.fn();
      const r = render(<GridOption label="Escuro" selected={false} onPress={onPress} />);
      pressables(r)[0].props.onPress();
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('GroupRow', () => {
    it('renderiza como View quando nao tem onPress', () => {
      const r = render(
        <GroupRow>
          <Text>linha</Text>
        </GroupRow>,
      );
      expect(pressables(r)).toHaveLength(0);
      expect(texts(r)).toContain('linha');
    });
  });
});
