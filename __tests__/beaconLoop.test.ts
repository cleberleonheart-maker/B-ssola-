import { startBeaconLoop } from '../src/services/beaconLoop';
import { DEFAULT_BEACON_INTERVAL_MINUTES } from '../src/utils/beacon';

/**
 * O ciclo do beacon de emergência (ideia #6).
 *
 * O beacon pergunta de minuto a minuto se já está na hora de avisar. O que
 * importa aqui é o que acontece quando as coisas correm mal: um ciclo que
 * falha não pode tirar o beacon de serviço, e um aviso que já foi dado não
 * pode repetir-se a cada minuto enquanto quem o recebe decide o que fazer.
 */

describe('o ciclo do beacon', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const montar = (over: Partial<Parameters<typeof startBeaconLoop>[0]> = {}) => {
    const getLastSentAt = jest.fn().mockResolvedValue(null);
    const markNotified = jest.fn().mockResolvedValue(undefined);
    const onDue = jest.fn();
    const stop = startBeaconLoop({
      intervalMinutes: DEFAULT_BEACON_INTERVAL_MINUTES,
      getLastSentAt,
      markNotified,
      onDue,
      tickMs: 60_000,
      ...over,
    });
    return { getLastSentAt, markNotified, onDue, stop };
  };

  it('avisa logo no arranque, quando nunca houve aviso', async () => {
    const { onDue, markNotified } = montar();

    await jest.advanceTimersByTimeAsync(0);

    expect(onDue).toHaveBeenCalledTimes(1);
    expect(markNotified).toHaveBeenCalledTimes(1);
  });

  it('nao repete o aviso enquanto o intervalo nao passa', async () => {
    const { onDue, getLastSentAt } = montar();

    await jest.advanceTimersByTimeAsync(0);
    // A partir de agora o último aviso foi o de agora.
    getLastSentAt.mockResolvedValue(Date.now());
    await jest.advanceTimersByTimeAsync(5 * 60_000);

    expect(onDue).toHaveBeenCalledTimes(1);
  });

  it('avisa outra vez quando o intervalo passa', async () => {
    const { onDue, getLastSentAt } = montar();

    await jest.advanceTimersByTimeAsync(0);
    const agora = Date.now();
    // O último aviso foi há 31 minutos: o intervalo de 30 já passou.
    getLastSentAt.mockResolvedValue(agora - 31 * 60_000);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(onDue).toHaveBeenCalledTimes(2);
  });

  it('marca o instante do aviso antes de o avisar', async () => {
    // Se o aviso fosse marcado depois, o ciclo repetiria o pedido a cada
    // minuto enquanto quem o recebe decide o que fazer.
    const ordem: string[] = [];
    const { stop } = montar({
      markNotified: jest.fn(async () => {
        ordem.push('marcado');
      }),
      onDue: () => {
        ordem.push('avisado');
      },
    });

    await jest.advanceTimersByTimeAsync(0);
    stop();

    expect(ordem).toEqual(['marcado', 'avisado']);
  });

  it('um ciclo que falha nao tira o beacon de servico', async () => {
    const getLastSentAt = jest
      .fn()
      .mockRejectedValueOnce(new Error('disco cheio'))
      .mockResolvedValue(null);
    const onDue = jest.fn();
    const stop = startBeaconLoop({
      intervalMinutes: DEFAULT_BEACON_INTERVAL_MINUTES,
      getLastSentAt,
      markNotified: jest.fn().mockResolvedValue(undefined),
      onDue,
      tickMs: 60_000,
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(onDue).not.toHaveBeenCalled();

    // O ciclo seguinte volta a tentar.
    await jest.advanceTimersByTimeAsync(60_000);
    expect(onDue).toHaveBeenCalledTimes(1);
    stop();
  });

  it('parar o ciclo deixa de perguntar', async () => {
    const { stop, getLastSentAt } = montar();

    await jest.advanceTimersByTimeAsync(0);
    stop();
    const chamadas = getLastSentAt.mock.calls.length;
    await jest.advanceTimersByTimeAsync(10 * 60_000);

    expect(getLastSentAt.mock.calls.length).toBe(chamadas);
  });
});
