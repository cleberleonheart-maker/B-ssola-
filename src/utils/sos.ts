import { buildBeaconMessage, type BeaconMessageParams } from './beacon';

/**
 * Modo de assalto (ideia #107).
 *
 * O SOS de sempre exige duas coisas que numa agressão não há: tempo e um
 * ecrã que se possa mostrar. O modo de assalto junta o que a app já sabe
 * fazer num gesto só: o aviso por SMS ao contacto guardado (em silêncio, sem
 * abrir a app de SMS) e o rastreio ao vivo, para que quem recebe o aviso
 * veja por onde a pessoa vai e não só onde ela estava.
 *
 * A contagem de 5 segundos é o que separa "discreto" de "acidente": um
 * toque no bolso não pode disparar o SOS. Cancelar é sempre visível e
 * sempre funciona.
 */

/** Segundos entre tocar no botão e o SMS sair. */
export const SOS_COUNTDOWN_SECONDS = 5;

/**
 * Um tique da contagem: de `n` para `n - 1`, sem passar do zero.
 *
 * Separado do componente para ser testável sem ecrã: a contagem é a única
 * coisa entre o toque e o SMS, e é ela que impede que um toque no bolso
 * dispare o aviso.
 */
export const sosCountdownTick = (current: number | null): number | null =>
  current == null ? null : Math.max(current - 1, 0);

/** Cabeçalho da mensagem do modo de assalto. */
export const SOS_MESSAGE_TITLE = 'SOS BUSSOLA';

/**
 * A mensagem do modo de assalto: a do beacon, com o cabeçalho do modo de
 * assalto e — quando há — o link do rastreio ao vivo.
 */
export const buildSosMessage = (params: BeaconMessageParams): string =>
  buildBeaconMessage({ ...params, title: params.title || SOS_MESSAGE_TITLE });
