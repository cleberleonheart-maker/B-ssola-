/**
 * "Volte antes do escuro" (ideia #23).
 *
 * A ideia junta as duas coisas que a app já sabe em separado — o ritmo de quem
 * caminha (da trilha que está a gravar) e a hora do pôr do sol (do relógio de
 * sol) — para responder a uma pergunta que um caminhante se faz mesmo: "até
 * quando é que ainda dá para voltar com luz?".
 *
 * A decisão fica aqui, pura e sem ecrã, para poder ser testada a qualquer hora
 * do dia sem depender do relógio nem do GPS. O cálculo é deliberadamente
 * conservador: assume o ritmo médio de ida (que já inclui as paragens) e a
 * distância em linha reta de volta, e reserva ainda uma margem de segurança.
 */

export const MIN_TRAVEL_METERS = 50;
export const MIN_ELAPSED_MS = 30000;
export const MIN_RETURN_METERS = 30;
/** Folga para não chegar ao portão com a última luz a esvair-se. */
export const DEFAULT_MARGIN_MINUTES = 20;

export type ReturnBeforeDarkInput = {
  /** Distância percorrida desde o início da gravação (metros). */
  traveledMeters: number;
  /** Tempo de gravação (ms). */
  elapsedMs: number;
  /** Distância em linha reta até ao ponto de partida (metros). */
  returnMeters: number;
  /** Instante atual (ms). */
  now: number;
  /** Pôr do sol de hoje na posição atual; `null` sem fixe ou em noite polar. */
  sunset: Date | null;
  marginMinutes?: number;
};

export type ReturnBeforeDark = {
  /** Ritmo médio atual, em minutos por quilómetro. */
  paceMinPerKm: number;
  /** Tempo estimado de volta, em minutos. */
  returnMinutes: number;
  /** Hora-limite para começar a voltar. */
  turnBackAt: Date;
  /** Minutos até à hora-limite (negativo quando já passou). */
  minutesToTurnBack: number;
  /** Já passou da hora-limite. */
  late: boolean;
};

export const estimateReturnBeforeDark = (
  input: ReturnBeforeDarkInput,
): ReturnBeforeDark | null => {
  const {
    traveledMeters,
    elapsedMs,
    returnMeters,
    now,
    sunset,
    marginMinutes = DEFAULT_MARGIN_MINUTES,
  } = input;

  // Sem hora de pôr do sol não há nada a estimar; e amostras curtas só dariam
  // um ritmo enganador (meia dúzia de metros a dividir por dois segundos).
  if (!sunset) return null;
  if (traveledMeters < MIN_TRAVEL_METERS || elapsedMs < MIN_ELAPSED_MS) return null;
  if (returnMeters < MIN_RETURN_METERS) return null;

  const speedMs = traveledMeters / (elapsedMs / 1000);
  if (!(speedMs > 0)) return null;

  const returnMinutes = returnMeters / speedMs / 60;
  const paceMinPerKm = elapsedMs / 60000 / (traveledMeters / 1000);
  const turnBackAt = new Date(
    sunset.getTime() - (returnMinutes + marginMinutes) * 60000,
  );

  return {
    paceMinPerKm,
    returnMinutes,
    turnBackAt,
    minutesToTurnBack: (turnBackAt.getTime() - now) / 60000,
    late: now >= turnBackAt.getTime(),
  };
};

/** Hora local no formato HH:MM, como nos nomes das trilhas. */
export const formatClock = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
