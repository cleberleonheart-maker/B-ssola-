/**
 * Quando é que o app volta a pedir o PIN.
 *
 * A função é pura de propósito: a decisão depende do relógio e do estado do
 * telemóvel, que são as duas coisas que mais depressa mudam de ideias — por
 * isso fica fora do componente e é testada sem ecrã.
 */

/**
 * Quanto tempo o app pode ficar em segundo plano antes de voltar a pedir o
 * PIN. Trancar logo a cada saída tornava o bloqueio insuportável (uma
 * calculadora, uma chamada), mas manter o ecrã aberto durante minutos é
 * justamente o caso que o bloqueio quer cobrir: o telemóvel emprestado.
 */
export const RELOCK_GRACE_MS = 30_000;

export type RelockParams = {
  /** Há PIN definido? Sem PIN não há nada para trancar. */
  hasPin: boolean;
  /** Quando o app foi para segundo plano (ms do relógio), ou null. */
  backgroundedAt: number | null;
  /** Agora (ms do relógio). */
  now: number;
  /** Janela de tolerância; por omissão, {@link RELOCK_GRACE_MS}. */
  graceMs?: number;
};

/**
 * Decide se o app se volta a trancar ao voltar ao primeiro plano.
 *
 * Sem PIN, ou sem ter estado em segundo plano, nunca se tranca. Relógio para
 * trás (mudança de hora, NTP a meio) conta como tempo passado: o bloqueio
 * depende do telemóvel, não do relógio que ele mostra.
 */
export const shouldRelock = ({
  hasPin,
  backgroundedAt,
  now,
  graceMs = RELOCK_GRACE_MS,
}: RelockParams): boolean => {
  if (!hasPin) return false;
  if (backgroundedAt == null) return false;
  const elapsed = now - backgroundedAt;
  if (elapsed < 0) return true;
  return elapsed >= graceMs;
};
