import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';

import LockScreen from '../src/components/LockScreen';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { LanguageProvider } from '../src/i18n/LanguageContext';

/**
 * O ecrã de bloqueio (ideia #31).
 *
 * O que se prova aqui é a limpeza do timer que limpa o PIN quando o PIN está
 * errado. Sem ele, o `setTimeout` sobrevive ao ecrã desmontado e chama
 * `setEntered` numa árvore que já não existe — o aviso que o React dá
 * ("actualizar um componente desmontado") aparece em produção, e o timer
 * some no escuro, onde ninguém o vê.
 */

jest.mock('../src/services/biometric', () => ({
  isBiometricAvailable: jest.fn(async () => false),
  authenticateBiometric: jest.fn(async () => false),
}));

const render = async (
  onUnlock: (pin: string) => boolean,
): Promise<ReactTestRenderer> => {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <ThemeProvider>
        <LanguageProvider>
          <LockScreen onUnlock={onUnlock} biometricEnabled={false} />
        </LanguageProvider>
      </ThemeProvider>,
    );
  });
  return r;
};

const ehPressable = (n: { type: unknown }) =>
  typeof n.type !== 'string' &&
  (n.type as { name?: string }).name === 'Pressable';

/** O botão do teclado com aquele algarismo. */
const botaoDoDigito = (r: ReactTestRenderer, digito: string) => {
  const texto = r.root
    .findAllByType(Text)
    .find(t => t.props.children === digito);
  if (!texto) throw new Error(`não encontrei a tecla ${digito}`);
  let no = texto.parent;
  while (no && !ehPressable(no)) {
    no = no.parent;
  }
  if (!no) throw new Error(`a tecla ${digito} não está dentro de um Pressable`);
  return no;
};

/** Escreve um PIN no teclado. */
const escreve = (r: ReactTestRenderer, pin: string) => {
  for (const digito of pin) {
    const botao = botaoDoDigito(r, digito);
    act(() => botao.props.onPress());
  }
};

describe('o ecrã de bloqueio', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('um PIN errado e limpo depois de um instante', async () => {
    const onUnlock = jest.fn().mockReturnValue(false);
    const r = await render(onUnlock);

    escreve(r, '1234');
    expect(onUnlock).toHaveBeenCalledWith('1234');

    act(() => {
      jest.advanceTimersByTime(400);
    });

    // O campo ficou vazio: quem volta a tentar não soma ao PIN antigo.
    onUnlock.mockClear();
    escreve(r, '1234');
    expect(onUnlock).toHaveBeenCalledWith('1234');
  });

  it('o timer do PIN errado e cancelado quando o ecrã desaparece', async () => {
    const onUnlock = jest.fn().mockReturnValue(false);
    const r = await render(onUnlock);

    escreve(r, '1234');

    const clear = jest.spyOn(global, 'clearTimeout');
    act(() => {
      r.unmount();
    });

    // O timer que estava vivo foi limpo no desmontar: sem isto, ele rebenta
    // 400 ms depois numa árvore que já não existe.
    expect(clear).toHaveBeenCalled();
  });
});
