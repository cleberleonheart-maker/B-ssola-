import { isBeaconDue } from '../utils/beacon';

export type BeaconLoopOptions = {
  /** De quanto em quanto tempo o beacon deve ser pedido, em minutos. */
  intervalMinutes: number;
  /** Instante do último aviso (ou envio). Null quando nunca houve. */
  getLastSentAt: () => Promise<number | null>;
  /** Marca o aviso para o próximo ciclo contar a partir daqui. */
  markNotified: (at: number) => Promise<void>;
  /** O beacon está na hora: a app avisa (notificação ou diálogo). */
  onDue: (now: number) => void;
  /** De quanto em quanto tempo se pergunta ao relógio, em ms. */
  tickMs?: number;
};

/**
 * Ciclo do beacon de emergência (ideia #6).
 *
 * Corre enquanto a app está viva: pergunta de minuto a minuto se já está na
 * hora de pedir o beacon e, quando está, chama `onDue` uma vez. Quem trata
 * o aviso é a app (notificação + diálogo), porque só ela sabe o que fazer
 * com o estado atual.
 *
 * O instante do aviso é marcado logo a seguir — e não quando o SMS é mesmo
 * enviado — para que o ciclo não repita o pedido a cada minuto enquanto
 * quem recebe o aviso decide o que fazer.
 */
export const startBeaconLoop = (options: BeaconLoopOptions): (() => void) => {
  const tickMs = options.tickMs ?? 60_000;
  let checking = false;

  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      const last = await options.getLastSentAt();
      const now = Date.now();
      if (!isBeaconDue(last, options.intervalMinutes, now)) return;
      await options.markNotified(now);
      options.onDue(now);
    } catch {
      // falhar um ciclo não pode tirar o beacon de serviço
    } finally {
      checking = false;
    }
  };

  void check();
  const id = setInterval(check, tickMs);
  return () => clearInterval(id);
};
