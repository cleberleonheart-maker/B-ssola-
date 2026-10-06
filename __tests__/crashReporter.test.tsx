import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { CrashBoundary } from '../src/components/CrashBoundary';
import { fingerprintOf, flushCrashes, recordCrash } from '../src/services/crashReporter';
import {
  deleteExpiredCrashReports,
  ensureCloudUser,
  pushCrashReport,
  takeCloudError,
} from '../src/services/cloud';
import { APP_VERSION, APP_VERSION_CODE } from '../src/version.generated';

/**
 * A promessa da ideia #56 é que um erro em produção deixe de ser invisível.
 * Isso tem duas metades, e é fácil testar só a primeira:
 *
 *   - o erro é registado e sai para a tabela `crashes`;
 *   - e a fila não vira um buraco nem um arquivo morto.
 *
 * A segunda é a que não se vê: um reporter que enche o armazenamento impede a
 * app de arrancar, e um reporter que perde o erro ao primeiro insucesso é
 * exactamente o problema que veio resolver. Por isso os testes do tecto, das
 * três tentativas e do "não reportar duas vezes o mesmo" são do mesmo peso que
 * o do `fingerprint`.
 */

jest.mock('../src/services/cloud', () => ({
  ensureCloudUser: jest.fn(),
  pushCrashReport: jest.fn(),
  // A limpeza dos 90 dias. Entra no mock pelo mesmo motivo do resto: se faltar,
  // o `flushCrashes` rebenta nela em vez de enviar o relatório.
  deleteExpiredCrashReports: jest.fn(async () => true),
  noteCloudError: jest.fn(),
  takeCloudError: jest.fn(() => null),
}));

const mockEnsure = ensureCloudUser as jest.MockedFunction<typeof ensureCloudUser>;
const mockPush = pushCrashReport as jest.MockedFunction<typeof pushCrashReport>;
const mockPurga = deleteExpiredCrashReports as jest.MockedFunction<
  typeof deleteExpiredCrashReports
>;

const QUEUE_KEY = 'crash:fila';
type FilaCrash = {
  message: string;
  stack: string | null;
  fingerprint: string;
  appVersion: string;
  versionCode: number;
  happenedAt: string;
  expiresAt: string;
  tries: number;
};

const readQueue = async (): Promise<FilaCrash[]> => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const parsed = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? (parsed as FilaCrash[]) : [];
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockEnsure.mockResolvedValue('user-abc');
  mockPush.mockResolvedValue(true);
  mockPurga.mockResolvedValue(true);
});

describe('o fingerprint', () => {
  it('a mesma mensagem dá o mesmo fingerprint, em execuções diferentes', () => {
    expect(fingerprintOf('x is not a function')).toBe(fingerprintOf('x is not a function'));
  });

  it('mensagens diferentes dão fingerprints diferentes', () => {
    expect(fingerprintOf('a is not a function')).not.toBe(fingerprintOf('b is not a function'));
  });

  it('é sempre positivo e com a largura certa', () => {
    // Sem o `>>> 0`, o bitwise do JS devolve signed e metade dos fingerprints
    // nasce negativa — e a contagem separa-se ao acaso, que é o oposto do que
    // um fingerprint serve.
    for (const mensagem of ['a', 'TypeError', 'x'.repeat(50), 'ação', '🚀', '']) {
      const f = fingerprintOf(mensagem);
      expect(f).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('só a primeira linha conta', () => {
    // O stack muda entre builds da mesma app: se entrasse, um bug antigo
    // pareceria outro sempre que o código à volta mudasse uma linha.
    expect(fingerprintOf('TypeError\n  at a\n  at b')).toBe(fingerprintOf('TypeError\n  at c'));
  });
});

describe('registar um crash', () => {
  it('guarda mensagem, stack, versão e quando', async () => {
    const quando = Date.now();
    await recordCrash(new Error('não foi possível iniciar o rastreio'));
    const [c] = await readQueue();

    expect(c.message).toBe('não foi possível iniciar o rastreio');
    expect(c.versionCode).toBe(APP_VERSION_CODE);
    expect(c.appVersion).toBe(APP_VERSION);
    expect(Date.parse(c.happenedAt)).toBeGreaterThan(quando - 5000);
    expect(Date.parse(c.expiresAt)).toBeGreaterThan(Date.parse(c.happenedAt));
    expect(c.fingerprint).toBe(fingerprintOf('não foi possível iniciar o rastreio'));
  });

  it('aceita o que o ErrorUtils dá: uma string, ou nada', async () => {
    // Um `throw 'erro'` tem message undefined, e `String(error)` de um undefined
    // é "undefined" — que na coluna `message not null` passava, e era o único
    // relatório que um crash sem Error objecto produziria.
    await recordCrash('erro simples');
    await recordCrash(undefined);
    await recordCrash({});
    const fila = await readQueue();
    expect(fila.length).toBe(3);
    for (const c of fila) {
      expect(typeof c.message).toBe('string');
      expect(c.message.length).toBeGreaterThan(0);
    }
  });

  it('não guarda o mesmo bug duas vezes na mesma sessão', async () => {
    // Um loop de renders que falha regista o mesmo erro a cada tentativa. Sem
    // esta deduplicação a fila enche-se do mesmo bug e os outros desaparecem.
    await recordCrash(new Error('a mesma coisa'));
    await recordCrash(new Error('a mesma coisa'));
    await recordCrash(new Error('outra coisa'));
    const fila = await readQueue();
    expect(fila.map(c => c.message).sort()).toEqual(['a mesma coisa', 'outra coisa']);
  });

  it('a fila tem tecto', async () => {
    // Um bug de escrita em crashes não pode ocupar o armazenamento todo e
    // impedir a app de arrancar — que é o que acontece sem tecto.
    for (let i = 0; i < 40; i += 1) {
      await recordCrash(new Error(`erro ${i}`));
    }
    const fila = await readQueue();
    expect(fila.length).toBe(20);
    // E o que fica são os mais recentes: o crash de agora vale mais que o de há
    // meio minuto, e a ordem de chegada é a ordem em que aconteceram.
    expect(fila[fila.length - 1].message).toBe('erro 39');
  });

  it('nunca lança, nem quando o armazenamento falha', async () => {
    // É chamado de dentro do tratamento de um erro. Se esta função lançar, o
    // crash reproduz-se sozinho.
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disco cheio'));
    await expect(recordCrash(new Error('o erro que estamos a reportar'))).resolves.toBeUndefined();
  });

  it('um erro gigante não escreve uma linha gigante', async () => {
    await recordCrash({ message: 'm'.repeat(50_000), stack: 's'.repeat(50_000) });
    const [c] = await readQueue();
    expect(c.message.length).toBeLessThanOrEqual(2000);
    expect(c.stack!.length).toBeLessThanOrEqual(8000);
  });
});

describe('mandar no arranque seguinte', () => {
  it('envia a fila e limpa-a', async () => {
    await recordCrash(new Error('primeiro'));
    await recordCrash(new Error('segundo'));

    const enviados = await flushCrashes();

    expect(enviados).toBe(2);
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(await readQueue()).toEqual([]);
  });

  it('manda o user_id da sessão, porque a RLS compara com auth.uid()', async () => {
    await recordCrash(new Error('x'));
    await flushCrashes();
    expect(mockPush).toHaveBeenCalledWith('user-abc', expect.objectContaining({ message: 'x' }));
  });

  it('o que o Supabase recusa fica na fila para a próxima vez', async () => {
    // Um crash que morre sem rede não pode ser um relatório perdido — que era
    // o problema que este serviço veio resolver.
    mockPush.mockResolvedValue(false);
    await recordCrash(new Error('sem rede'));

    expect(await flushCrashes()).toBe(0);
    const fila = await readQueue();
    expect(fila).toHaveLength(1);
    expect(fila[0].tries).toBe(1);
  });

  it('desiste ao fim de três tentativas', async () => {
    // Reenviar para sempre um relatório que o Supabase rejeita (uma coluna que
    // não existe, um RLS que mudou) seria um pedido em cada arranque, para
    // sempre, por causa de um bug que já não se vai resolver sozinho.
    mockPush.mockResolvedValue(false);
    await recordCrash(new Error('rejeitado'));
    for (let i = 0; i < 5; i += 1) await flushCrashes();
    expect(mockPush).toHaveBeenCalledTimes(3);
    expect(await readQueue()).toEqual([]);
  });

  it('sem sessão não manda nada, e não perde a fila', async () => {
    mockEnsure.mockResolvedValue(null);
    await recordCrash(new Error('sem sessão'));

    expect(await flushCrashes()).toBe(0);
    expect(mockPush).not.toHaveBeenCalled();
    expect(await readQueue()).toHaveLength(1);
  });

  it('uma fila corrompida não impede o arranque', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, 'isto não é JSON');
    expect(await flushCrashes()).toBe(0);
  });

  it('limpa os relatórios que já passaram dos 90 dias', async () => {
    // `expires_at` punha estas linhas no índice à espera de uma limpeza que
    // ninguém fazia. Quem acabou de enviar um relatório é porque tem sessão, e
    // é o momento em que vale a pena dizer-lhe que os antigos já não interessam.
    await recordCrash(new Error('antigo'));
    await flushCrashes();
    expect(mockPurga).toHaveBeenCalledWith('user-abc');
  });

  it('a limpeza a falhar não deixa um unhandled rejection', async () => {
    // O `catch` não é um gesto de estilo. `void` cala o linter e nada mais: uma
    // promessa rejeitada sem handler é um unhandled rejection, que em Node mata
    // o processo inteiro. O teste anterior ("não leva os relatórios atrás")
    // passava com e sem `catch` — o resultado era o mesmo nos dois casos, e um
    // teste que passa nos dois não mede nada.
    const rejeicoes: unknown[] = [];
    const ouvinte = (motivo: unknown) => rejeicoes.push(motivo);
    process.on('unhandledRejection', ouvinte);
    try {
      mockPurga.mockRejectedValue(new Error('delete recusado'));
      await recordCrash(new Error('x'));
      expect(await flushCrashes()).toBe(1);
      // A rejeição só é entregue quando a fila de microtarefas esgota.
      await new Promise(resolve => setTimeout(resolve, 20));
    } finally {
      process.off('unhandledRejection', ouvinte);
    }
    expect(rejeicoes).toEqual([]);
  });

  it('não limpa quando nada foi enviado', async () => {
    // Sem relatório novo não há motivo nenhum para pedir um delete: seria um
    // pedido de rede em cada arranque, a meio caminho, para não fazer nada.
    mockPush.mockResolvedValue(false);
    await recordCrash(new Error('sem rede'));
    await flushCrashes();
    expect(mockPurga).not.toHaveBeenCalled();
  });

  it('não limpa quando a fila estava vazia', async () => {
    await flushCrashes();
    expect(mockPurga).not.toHaveBeenCalled();
  });

  it('a limpeza a falhar não leva os relatórios atrás', async () => {
    // É higiene. Um delete que falha tem de ser indistinguível de um delete que
    // nunca correu — e `void` sem `catch` é uma promessa rejeitada sem handler,
    // que em Node mata o processo.
    mockPurga.mockRejectedValue(new Error('delete recusado'));
    await recordCrash(new Error('x'));
    expect(await flushCrashes()).toBe(1);
    expect(await readQueue()).toEqual([]);
  });

  it('não há fila, não há rede chamada nenhuma', async () => {
    await flushCrashes();
    expect(mockEnsure).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(takeCloudError()).toBeNull();
  });
});

describe('o boundary do React', () => {
  // O `render` tem de devolver algo *diferente* quando há erro. A primeira
  // versão devolvia os mesmos filhos: o React re-renderiza, o erro volta a
  // lançar, e o boundary entra num ciclo que não acaba — o que, numa app, é uma
  // tela branca com a CPU a 100% em vez de um ecrã vazio. Este teste rebenta
  // com um "Maximum update depth exceeded" se alguém voltar a fazer isso.
  const Quebra = () => {
    throw new Error('erro a meio do render');
  };

  it('regista o erro de render e deixa a tela vazia', async () => {
    // O erro de render é lançado, não apanhado: um boundary sem isto não é um
    // boundary. Silencia-se o aviso que o React escreve para o console.
    const erro = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let r: TestRenderer.ReactTestRenderer | undefined;
      await act(async () => {
        r = TestRenderer.create(
          <CrashBoundary>
            <Quebra />
          </CrashBoundary>,
        );
      });
      expect(r!.toJSON()).toBeNull();
      const fila = await readQueue();
      expect(fila).toHaveLength(1);
      expect(fila[0].message).toBe('erro a meio do render');
    } finally {
      erro.mockRestore();
    }
  });

  it('com filhos que não falham, mostra-os', () => {
    const erro = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let r: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        r = TestRenderer.create(
          <CrashBoundary>
            <Text>olá</Text>
          </CrashBoundary>,
        );
      });
      expect(JSON.stringify(r!.toJSON())).toContain('olá');
    } finally {
      erro.mockRestore();
    }
  });
});
