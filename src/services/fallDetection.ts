import { Vibration } from 'react-native';
import { accelerometer } from 'react-native-sensors';
import { createFallDetector, type FallDetector } from '../utils/fallDetector';
import { detectAccelScale, toG } from './sensorSelfTest';

export type FallCallback = () => void;

type Subscription = { unsubscribe: () => void };

let subscription: Subscription | null = null;
let detector: FallDetector | null = null;
/**
 * A escala do acelerómetro (g ou m/s²) só se sabe depois de algumas
 * leituras: em repouso a magnitude é ~1 (g) ou ~9,8 (m/s²), e o limiar da
 * queda é 2,8 g. Sem esta medida, uma leitura de 4 m/s² num aparelho em
 * g seria lida como 4 g — e um puxão brusco pareceria uma queda.
 */
let scaleSamples: number[] = [];
let scale: 'g' | 'ms2' | null = null;

const SCALE_SAMPLES = 10;

const clearState = () => {
  subscription = null;
  detector = null;
  scaleSamples = [];
  scale = null;
};

/**
 * Liga a detecção de queda.
 *
 * Devolve `true` quando o aparelho leva um embate e fica parado: a partir daí
 * a app decide o que fazer (normalmente, abrir o SOS).
 */
export const startFallDetection = (onFall: FallCallback): boolean => {
  if (subscription) return false;
  clearState();
  detector = createFallDetector();

  try {
    const sub = accelerometer.subscribe({
      next: ({ x, y, z }: { x: number; y: number; z: number }) => {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          return;
        }
        const raw = Math.sqrt(x * x + y * y + z * z);
        if (!Number.isFinite(raw) || raw <= 0) return;

        if (scale == null) {
          scaleSamples.push(raw);
          if (scaleSamples.length < SCALE_SAMPLES) return;
          scale = detectAccelScale(scaleSamples);
        }

        const g = toG(raw, scale);
        if (!detector) return;
        if (detector.push(g, Date.now())) {
          try {
            Vibration.vibrate([200, 100, 200]);
          } catch {}
          onFall();
        }
      },
      error: () => {},
    });
    subscription = {
      unsubscribe: () => {
        try {
          sub.unsubscribe();
        } catch {}
      },
    };
    return true;
  } catch {
    clearState();
    return false;
  }
};

/** Desliga a detecção de queda e limpa o estado a meio. */
export const stopFallDetection = () => {
  if (subscription) {
    subscription.unsubscribe();
  }
  clearState();
};

/** A detecção está ligada? */
export const isFallDetectionRunning = (): boolean => subscription != null;
