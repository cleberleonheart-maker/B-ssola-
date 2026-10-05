import React from 'react';

import { recordCrash } from '../services/crashReporter';

/**
 * Apanha o erro de render antes de ele virar ecrã branco (ideia #56).
 *
 * O `ErrorUtils` — instalado no `index.js` — vê o que o `try/catch` não apanha,
 * mas um erro no meio de um render chega aqui primeiro: o React captura-o no
 * boundary mais próximo. Sem isto, o erro mais comum numa app com esta
 * quantidade de ecrãs não chegava a lado nenhum, que é o problema que o
 * reporter veio resolver.
 *
 * O fallback é `null`, e isso é uma mudança de comportamento que vale a pena
 * notar: antes, um erro de render levava o React a desmontar a árvore toda e a
 * app fechava; agora fica uma tela vazia. Escolhi `null` porque um ecrã de erro
 * novo é uma decisão de UI que o dono nunca viu, e porque o objectivo aqui é o
 * relatório. Se preferires que volte a fechar, ou que mostre algo, é uma linha
 * em `render()`.
 *
 * O `render` tem de devolver *algo* diferente quando há erro: devolver os mesmos
 * filhos faz o React re-renderizar, o erro volta a lançar, e o boundary entra
 * num ciclo que não acaba — o que numa app é uma tela branca com a CPU a 100%
 * em vez de um ecrã vazio. Foi o primeiro rascunho deste ficheiro, e o teste
 * `crashReporter.test.tsx` existe para o rebentar se voltar.
 *
 * Fica em `src/components/` e não dentro do `App.tsx` por uma razão prática:
 * testar este boundary não pode arrastar a app inteira atrás (o `notifee` entra
 * em cena e morre sem módulo nativo), e o `App` é o ficheiro mais caro de
 * carregar num teste.
 */
type Props = { children: React.ReactNode };
type State = { erro: Error | null };

export class CrashBoundary extends React.Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error) {
    void recordCrash(erro);
  }

  render() {
    return this.state.erro ? null : this.props.children;
  }
}
