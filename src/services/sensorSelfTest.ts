/**
 * Invariantes que o app checa no aparelho, para o usuário descobrir sozinho o
 * que antes só o desenvolvedor podia saber.
 *
 * Tudo aqui é função pura sobre amostras já coletadas: nenhuma assinatura de
 * sensor, nenhum import de `react-native`. O painel que assina o magnetômetro e
 * o acelerômetro é que chama estas funções, e elas são testáveis sem mock.
 */

export const G_MS2 = 9.80665;

/** Faixa aceita para o acelerômetro em repouso, em g. */
export const REST_MIN_G = 0.98;
export const REST_MAX_G = 1.02;

/** Variação máxima do norte parado, em graus. */
export const STABILITY_MAX_DEG = 2;

/**
 * Descobre em que unidade o acelerômetro entrega.
 *
 * O Android reporta m/s² e o iOS reporta g, e o app não sabe qual está lendo
 * num aparelho dado. Decide pela ordem de grandeza da mediana: em repouso a
 * norma é ~1 em g e ~9,8 em m/s², que é uma separação de quase uma década —
 * larga o bastante para que uma escala errada seja detectada antes de virar
 * "PASSOU" falso.
 */
export const detectAccelScale = (magnitudes: number[]): 'g' | 'ms2' => {
  const med = median(magnitudes.filter(m => Number.isFinite(m) && m > 0));
  if (med === null) {
    return 'g';
  }
  return med > 3 ? 'ms2' : 'g';
};

/** Converte uma norma de acelerômetro para g, dada a escala detectada. */
export const toG = (magnitude: number, scale: 'g' | 'ms2'): number =>
  scale === 'ms2' ? magnitude / G_MS2 : magnitude;

export type CheckStatus = 'pending' | 'running' | 'pass' | 'fail';

export type CheckResult = {
  id: string;
  status: CheckStatus;
  /** Números medidos, já formatáveis pela UI. */
  value: string;
  /** O que era esperado, com o mesmo formato de `value`. */
  expected: string;
};

export type RestAnalysis = {
  scale: 'g' | 'ms2';
  min: number;
  max: number;
  mean: number;
  /** true se toda a janela ficou dentro de [REST_MIN_G, REST_MAX_G]. */
  inRange: boolean;
};

/**
 * Aceleração em repouso.
 *
 * Usa o mínimo e o máximo da janela, não a média: a média esconde um sensor que
 * sai de faixa na metade do tempo, que é exatamente o defeito que interessa.
 */
export const analyzeRest = (
  magnitudes: number[],
  min = REST_MIN_G,
  max = REST_MAX_G,
): RestAnalysis | null => {
  // Zero entra como amostra válida de propósito: um sensor morto reporta 0 e é
  // justamente o caso que precisa aparecer como FALHOU. Filtrar `> 0` aqui
  // transformaria "sensor quebrado" em "sem dados", escondendo o defeito mais
  // grave que o teste existe para achar.
  const valid = magnitudes.filter(Number.isFinite).filter(m => m >= 0);
  if (valid.length < 1) {
    return null;
  }
  const scale = detectAccelScale(valid);
  const gs = valid.map(m => toG(m, scale));
  return {
    scale,
    min: Math.min(...gs),
    max: Math.max(...gs),
    mean: gs.reduce((s, v) => s + v, 0) / gs.length,
    inRange: Math.min(...gs) >= min && Math.max(...gs) <= max,
  };
};

/**
 * Amplitude do norte em uma janela de azimutes, em graus.
 *
 * Precisa tratar a quebra do 0/360: medindo de 359° a 1° o aparelho não girou
 * 358°, girou 2°. Sem isso o teste reprovaria justamente quando a bússola está
 * mais estável — perto do norte, que é onde o usuário mais checa.
 */
export const headingSpread = (headings: number[]): number | null => {
  const valid = headings.filter(Number.isFinite);
  if (valid.length < 2) {
    return null;
  }
  const base = valid[0];
  const deltas = valid.map(h => wrap180(h - base));
  return Math.max(...deltas) - Math.min(...deltas);
};

/**
 * Resposta do `verticalAngle` à inclinação.
 *
 * Passa se o ângulo acompanhar o movimento, e não se o valor for grande. Um
 * sensor travado em 0 dá `range` 0; um sensor que responde mesmo sem o eixo
 * certo dá `range` grande, e o teste deixa passar — a convenção do eixo é
 * problema da ideia 64/65, não deste.
 */
export const tiltResponse = (angles: number[]): {
  range: number;
  min: number;
  max: number;
  responded: boolean;
} | null => {
  const valid = angles.filter(Number.isFinite);
  if (valid.length < 2) {
    return null;
  }
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return { range: max - min, min, max, responded: max - min > 5 };
};

/** Dobra um delta para [-180, 180]. */
export const wrap180 = (deg: number): number => {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

const median = (values: number[]): number | null => {
  if (!values.length) {
    return null;
  }
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
