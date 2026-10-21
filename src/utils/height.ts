/**
 * Média de N leituras de ângulo de inclinação.
 *
 * Ao mirar um topo à mão, o tremor do braço faz cada leitura cair num valor
 * diferente; capturar uma só ("instantâneo") é capturar o tremor. A média das
 * últimas leituras estabiliza — com as limitações do caso: o ângulo é pequeno
 * e contínuo, então a média aritmética basta e não é preciso a circular usada
 * no rumo (que dá a volta aos 360°).
 */
export const meanAngle = (angles: number[]): number => {
  const valid = angles.filter(a => Number.isFinite(a));
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, a) => acc + a, 0);
  return sum / valid.length;
};

/**
 * Limite, em graus, para a auto-detecção da convenção de inclinação (#65).
 *
 * Mirar o topo para o céu tem de dar um ângulo claramente positivo. Um valor
 * abaixo de −45° não é "apontou um pouco para baixo" — é o sensor a devolver o
 * sinal trocado (a nota de campo descreve o `verticalAngle` a dar negativo a
 * subir em algum hardware). A folga de 45° existe para o gesto real, nunca
 * perfeitamente vertical, não disparar a correção por engano.
 */
export const CONVENTION_THRESHOLD = -45;

/**
 * Diz se a leitura "topo para o céu" revela a convenção de inclinação
 * invertida. `skyAngle` é o `verticalAngle` cru capturado ao apontar o topo do
 * aparelho para cima.
 */
export const isInvertedConvention = (skyAngle: number): boolean =>
  Number.isFinite(skyAngle) && skyAngle <= CONVENTION_THRESHOLD;

/**
 * Aplica a convenção à leitura crua. A correção só troca o sinal: a
 * magnitude é a mesma, o que muda é o sentido (subir deixa de marcar negativo).
 */
export const applyConvention = (rawAngle: number, inverted: boolean): number =>
  inverted ? -rawAngle : rawAngle;

/**
 * Altura de um objeto por dois ângulos verticais e a distância horizontal.
 *
 * `top` e `base` em graus (positivo = apontando para cima), `distance` em
 * metros. Devolve a diferença de altura entre os dois pontos, ou `null` quando
 * falta leitura, a distância não é positiva ou o resultado dá negativo (base
 * capturada acima do topo — sinal de convenção invertida, que a tela avisa).
 */
export const heightFromAngles = (
  top: number | null,
  base: number | null,
  distance: number,
): number | null => {
  if (top === null || base === null || !(distance > 0)) return null;
  if (![top, base, distance].every(Number.isFinite)) return null;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const height = distance * (Math.tan(rad(top)) - Math.tan(rad(base)));
  return height >= 0 ? height : null;
};
