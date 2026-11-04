/**
 * Detecção de queda: regras puras sobre a magnitude do acelerómetro.
 *
 * A queda tem duas partes: o embate (pico de força) e a imobilidade logo a
 * seguir (o aparelho fica no chão, ou na mão de quem caiu). O embate sozinho
 * não chega — atirar o telemóvel para a mesa também o dá — e a imobilidade
 * sozinha é o estado normal de um telemóvel pousado.
 *
 * Não há sensores aqui: o serviço de queda (`services/fallDetection.ts`) é que
 * assina o acelerómetro e traduz a leitura para estas regras, que assim se
 * podem testar sem aparelho.
 */

export type FallDetectorOptions = {
  /** Pico de força, em g, que conta como embate. */
  impactG?: number;
  /** Tolerância, em g, para considerar o aparelho parado (magnitude ≈ 1 g). */
  stillToleranceG?: number;
  /** Janela, em ms, dentro da qual o embate continua a valer. */
  impactWindowMs?: number;
  /** Tempo, em ms, que o aparelho tem de ficar parado antes do aviso. */
  stillHoldMs?: number;
  /** Tempo, em ms, sem novo aviso depois de uma queda. */
  cooldownMs?: number;
};

export type FallDetectorState = {
  /** Há um embate à espera de confirmação. */
  impacted: boolean;
  /** Instante em que o aparelho começou a estar parado (null se ainda não). */
  stillSince: number | null;
  /** Instante do último aviso, ou null se nunca avisou. */
  lastTriggerAt: number | null;
};

export type FallDetector = {
  /**
   * Processa uma leitura de magnitude (em g).
   * Devolve `true` no instante em que a queda é confirmada — e só nesse.
   */
  push: (magnitudeG: number, now: number) => boolean;
  /** Limpa o estado: um embate a meio não fica à espera para sempre. */
  reset: () => void;
  /** Estado atual, para a interface mostrar o que o detetor está a ver. */
  state: () => FallDetectorState;
};

export const FALL_DEFAULTS = {
  impactG: 2.8,
  stillToleranceG: 0.4,
  impactWindowMs: 1500,
  stillHoldMs: 2000,
  cooldownMs: 30000,
} as const;

export const createFallDetector = (
  options: FallDetectorOptions = {},
): FallDetector => {
  const impactG = options.impactG ?? FALL_DEFAULTS.impactG;
  const stillToleranceG = options.stillToleranceG ?? FALL_DEFAULTS.stillToleranceG;
  const impactWindowMs = options.impactWindowMs ?? FALL_DEFAULTS.impactWindowMs;
  const stillHoldMs = options.stillHoldMs ?? FALL_DEFAULTS.stillHoldMs;
  const cooldownMs = options.cooldownMs ?? FALL_DEFAULTS.cooldownMs;

  let impactAt: number | null = null;
  let stillSince: number | null = null;
  let lastTriggerAt: number | null = null;

  const reset = () => {
    impactAt = null;
    stillSince = null;
  };

  const push = (magnitudeG: number, now: number) => {
    if (!Number.isFinite(magnitudeG)) return false;
    const g = Math.abs(magnitudeG);

    if (g >= impactG) {
      // Embate novo: a janela recomeça. Outro embate dentro da janela é do
      // mesmo episódio (a queda tem ressaltos), não uma queda nova.
      if (impactAt == null || now - impactAt > impactWindowMs) {
        impactAt = now;
        stillSince = null;
      }
      return false;
    }

    if (impactAt == null) return false;

    // Embate já velho demais: não vale a pena confirmar a queda agora.
    if (now - impactAt > impactWindowMs + stillHoldMs) {
      reset();
      return false;
    }

    const still = Math.abs(g - 1) <= stillToleranceG;
    if (!still) {
      stillSince = null;
      return false;
    }

    if (stillSince == null) stillSince = now;
    if (now - stillSince < stillHoldMs) return false;

    // Já avisou há pouco: a pessoa continua no chão, não é uma queda nova.
    if (lastTriggerAt != null && now - lastTriggerAt < cooldownMs) {
      reset();
      return false;
    }

    lastTriggerAt = now;
    reset();
    return true;
  };

  return {
    push,
    reset,
    state: () => ({ impacted: impactAt != null, stillSince, lastTriggerAt }),
  };
};
