export type Axis = 'x' | 'y' | 'z';
export type AxisValues = { x: number; y: number; z: number };

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
