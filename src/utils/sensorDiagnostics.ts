/**
 * Painel de diagnóstico dos sensores (ideia #64).
 *
 * A app assume a convenção de eixos do telemóvel — X para a direita, Y para o
 * topo, Z para fora do ecrã — mas cada aparelho pode ter outra, e a leitura
 * errada de um eixo passa por "bússola mal calibrada". Este módulo junta as
 * contas do painel: tudo puro, para se testar sem sensor.
 */

import type { Vector3 } from './compass';

export type Axis = 'x' | 'y' | 'z';

export const AXES: readonly Axis[] = ['x', 'y', 'z'] as const;

/** Comprimento do vector. */
export const magnitude = (v: Vector3): number =>
  Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);

/**
 * Eixo dominante: o de maior valor absoluto.
 *
 * No acelerómetro, esse é o eixo mais alinhado com a gravidade — o que diz
 * ao utilizador como o aparelho está virado. No magnetómetro, é o eixo que
 * mais aponta para o norte magnético.
 */
export const dominantAxis = (v: Vector3): Axis | null => {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
    return null;
  }
  const values: Record<Axis, number> = {
    x: Math.abs(v.x),
    y: Math.abs(v.y),
    z: Math.abs(v.z),
  };
  let best: Axis = 'x';
  let bestValue = values.x;
  for (const axis of AXES) {
    if (values[axis] > bestValue) {
      best = axis;
      bestValue = values[axis];
    }
  }
  return bestValue > 0 ? best : null;
};

export type CalibrationQuality = {
  /** Há calibração gravada? */
  calibrated: boolean;
  /**
   * Hard iron: o desvio do centro do campo magnético, em µT. Zero é o ideal.
   */
  hardIron: number;
  /**
   * Soft iron: a diferença entre o maior e o menor fator de escala. Zero é o
   * ideal (a esfera é esférica).
   */
  softIron: number;
  /** Amostras usadas na calibração. */
  samples: number;
};

/**
 * Mede o quanto a calibração gravada está a corrigir.
 *
 * `offsets` são o centro do campo (hard iron) e `scales` corrigem a esfera
 * achatada (soft iron): um desvio grande em qualquer um deles é o que faz o
 * norte rodar quando o aparelho muda de pose.
 */
export const calibrationQuality = (
  cal: { offsets: Vector3; scales: Vector3; samples: number } | null,
): CalibrationQuality => {
  if (!cal) {
    return { calibrated: false, hardIron: 0, softIron: 0, samples: 0 };
  }
  const scales = [cal.scales.x, cal.scales.y, cal.scales.z].filter(v =>
    Number.isFinite(v),
  );
  const maxScale = scales.length ? Math.max(...scales) : 1;
  const minScale = scales.length ? Math.min(...scales) : 1;
  return {
    calibrated: true,
    hardIron: magnitude(cal.offsets),
    softIron: maxScale - minScale,
    samples: cal.samples,
  };
};

/** Confirmação do eixo vertical que o utilizador identificou no aparelho. */
export type AxisConfirmation = Axis | null;
