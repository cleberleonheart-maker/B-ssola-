export type StepDetectorOptions = {
  gravityAlpha?: number;
  threshold?: number;
  release?: number;
  minStepGapMs?: number;
};

export type StepDetector = {
  push(nowMs: number, x: number, y: number, z: number): boolean;
};

const DEFAULT_GRAVITY_ALPHA = 0.8;
const DEFAULT_THRESHOLD = 0.25;
const DEFAULT_RELEASE = 0.08;
const DEFAULT_MIN_STEP_GAP_MS = 250;

/**
 * Detecta passadas a partir de amostras do acelerómetro. Compara a magnitude
 * atual com a gravidade em passagem baixa (razão, não diferença): assim o
 * limiar é o mesmo quer o sensor entregue m/s² (Android, ~9,81 em repouso)
 * quer g (iOS, ~1). Um passo é um pico de razão acima de `1 + threshold` que
 * depois desce abaixo de `1 + release` (histerese) respeitando o intervalo
 * mínimo entre passos.
 */
export const createStepDetector = (
  opts: StepDetectorOptions = {},
): StepDetector => {
  const gravityAlpha = opts.gravityAlpha ?? DEFAULT_GRAVITY_ALPHA;
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const release = opts.release ?? DEFAULT_RELEASE;
  const minStepGapMs = opts.minStepGapMs ?? DEFAULT_MIN_STEP_GAP_MS;

  let gravity = 0;
  let armed = true;
  let lastStepMs = -Infinity;

  return {
    push(nowMs, x, y, z) {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (gravity === 0) {
        gravity = magnitude;
      } else {
        gravity = gravityAlpha * gravity + (1 - gravityAlpha) * magnitude;
      }
      const dynamic = magnitude / gravity - 1;

      if (!armed) {
        if (dynamic < release) armed = true;
      } else if (dynamic > threshold) {
        if (nowMs - lastStepMs < minStepGapMs) return false;
        armed = false;
        lastStepMs = nowMs;
        return true;
      }
      return false;
    },
  };
};