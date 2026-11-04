export type Axis = 'x' | 'y' | 'z';
export type AxisValues = { x: number; y: number; z: number };

/**
 * Limiares de nível, como fração do desvio face ao ambiente (o `ratio` de 0 a
 * 1). São os mesmos que a barra, o bipe e a vibração usam: comparar o valor
 * absoluto com 40/90 µT marcava "alto" o tempo inteiro em regiões de campo
 * magnético alto e nunca reagia a anomalias reais.
 */
export const EMF_LOW_RATIO = 0.45;
export const EMF_HIGH_RATIO = 0.75;

export type EmfLevel = 'low' | 'medium' | 'high';

export const emfLevel = (ratio: number): EmfLevel =>
  ratio >= EMF_HIGH_RATIO ? 'high' : ratio >= EMF_LOW_RATIO ? 'medium' : 'low';

/**
 * Eixo dominante da leitura EMF.
 *
 * Com linha de base (`baseline`, capturada pelo botão "Ambiente"), o eixo é o
 * que mais *desviou* do ambiente — é o que aponta para a anomalia, e é a
 * leitura que interessa a quem caminha em direção à fonte.
 *
 * Sem linha de base, compara os valores absolutos: aí o eixo dominante diz
 * sobretudo como o aparelho está deitado (o campo da Terra carrega-se quase
 * todo num eixo), e serve como referência, não como direção. Fica escrito para
 * ninguém tratar o segundo caso como o primeiro.
 *
 * Empate fica com o primeiro eixo na ordem x, y, z: desempate determinístico
 * para o valor não saltar entre renderizações.
 */
export const dominantAxis = (
  axes: AxisValues,
  baseline: AxisValues | null,
): Axis => {
  const score = (axis: Axis) => {
    const value = axes[axis];
    const reference = baseline ? baseline[axis] : 0;
    return Math.abs(value - reference);
  };
  let best: Axis = 'x';
  let bestScore = score('x');
  for (const axis of ['y', 'z'] as const) {
    const current = score(axis);
    if (current > bestScore) {
      best = axis;
      bestScore = current;
    }
  }
  return best;
};
