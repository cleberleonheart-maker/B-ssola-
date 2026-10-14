/**
 * A última posição conhecida, por partilhar (ideia #15).
 *
 * O tema automático "pelo sol real" precisa de saber onde é o dia, mas o
 * `ThemeProvider` está acima do ecrã e não tem — nem deve ter — o seu próprio
 * `watchLocation`: pedir um fixe no provider seria duplicar o GPS e arriscar um
 * pedido de permissão no arranque só por causa das cores.
 *
 * Quem já conhece a posição é o `CompassScreen`, que a observa de qualquer
 * modo. Escreve-a aqui; o tema lê-a. É só memória: uma posição para decidir se
 * é dia não precisa de sobreviver ao fecho da app.
 */

export type LastLocation = { lat: number; lon: number };

let last: LastLocation | null = null;

export const setLastLocation = (lat: number, lon: number): void => {
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    last = { lat, lon };
  }
};

export const getLastLocation = (): LastLocation | null => last;

/** Só para os testes. */
export const clearLastLocation = (): void => {
  last = null;
};
