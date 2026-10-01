import React, { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage, type LanguageContextData } from '../i18n/LanguageContext';

type Props = {
  children: ReactNode;
  /** Nome do modo, já traduzido. Evita "Erro no modo Visão" em qualquer crash. */
  modeLabel: string;
};

type State = {
  error: Error | null;
  /** Muda para remontar a árvore quando o usuário pede para tentar de novo. */
  attempt: number;
};

/**
 * Rede de segurança por modo.
 *
 * Antes era uma classe com o texto fixo "Erro no modo Visão" em português, e
 * só envolvia a `CameraARView`: um travamento no teodolito, no detector de
 * metais ou na caderneta derrubava a tela inteira sem aviso nenhum. Agora cada
 * modo diz o próprio nome, o texto passa pelo tradutor, e há botão de tentar de
 * novo — que é o que resolve a esmagadora maioria dos casos, já que quase todo
 * crash aqui é estado inconsistente de sensor e não código quebrado.
 *
 * O wrapper existe só para dar o `t` ao class component: um `ErrorBoundary`
 * precisa ser classe, e `useLanguage` é hook.
 */
class Boundary extends Component<Props & { t: LanguageContextData['t'] }, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidUpdate(prev: Props & { t: LanguageContextData['t'] }) {
    // Trocar de modo tem de limpar o erro: sem isto, o erro do teodolito
    // continuaria na tela quando o usuário abrisse a bússola.
    if (prev.modeLabel !== this.props.modeLabel) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error, attempt } = this.state;
    if (!error) {
      return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
    }
    const { t } = this.props;
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🤕</Text>
        <Text style={styles.title}>
          {t('err_mode', { mode: this.props.modeLabel })}
        </Text>
        <Text style={styles.message}>{String(error?.message ?? error)}</Text>
        <Pressable
          onPress={() => this.setState({ error: null, attempt: attempt + 1 })}
          style={styles.button}>
          <Text style={styles.buttonText}>{t('err_retry')}</Text>
        </Pressable>
      </View>
    );
  }
}

const ErrorBoundary = ({ children, modeLabel }: Props) => {
  const { t } = useLanguage();
  return (
    <Boundary t={t} modeLabel={modeLabel}>
      {children}
    </Boundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 42,
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: '#ff9999',
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
    backgroundColor: '#fff',
  },
  buttonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default ErrorBoundary;
