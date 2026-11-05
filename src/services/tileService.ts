import { NativeModules } from 'react-native';
import type { DisplayMode } from './preferencesService';

/**
 * Tiles das Definições Rápidas (ideia #14).
 *
 * Cada tile abre a app já no seu modo. Há um tile por modo — a lista abaixo
 * tem de bater com as classes de `ModeTileService.kt` (uma por tile): um modo
 * que não tenha classe do lado do Android não tem tile, e um tile sem modo
 * aqui não serve para nada.
 */
export const TILE_MODES: DisplayMode[] = [
  'compass',
  'level',
  'ar',
  'camera',
  'metal',
  'theodolite',
  'emf',
  'sun',
  'wind',
  'track',
  'map',
  'notes',
  'odometer',
  'cadence',
  'height',
  'car',
  'tri',
  'selftest',
  'diag',
];

/**
 * O tile do modo de assalto (ideia #107).
 *
 * Não é um modo: é uma acção — abre o ecrã de emergência pelo atalho
 * `bussola://sos`. Vive fora de `TILE_MODES` porque a lista dos modos é a
 * lista dos ecrãs, e este não é um ecrã: é o botão do SOS.
 */
export const SOS_TILE_KEY = 'sos';

const { TileStatus } = NativeModules;

/**
 * Os modos cujos tiles o utilizador já arrastou para o painel.
 *
 * O Android avisa o serviço do tile quando ele é adicionado ou removido, e o
 * serviço guarda a marca; aqui vamos buscá-la. Sem o módulo nativo (iOS, ou
 * um build antigo) a lista é vazia — o resto da app não depende dela.
 */
export const getAddedTiles = async (): Promise<DisplayMode[]> => {
  try {
    const modes = await TileStatus?.getAddedTiles?.();
    if (!Array.isArray(modes)) return [];
    return modes.filter((mode): mode is DisplayMode =>
      TILE_MODES.includes(mode as DisplayMode),
    );
  } catch {
    return [];
  }
};

/**
 * O tile do SOS já está no painel de atalhos?
 *
 * Vai à parte porque `getAddedTiles` só devolve modos — o "sos" não é um
 * modo, e metê-lo na mesma lista faria o diálogo dos tiles dizer que há um
 * modo chamado "sos".
 */
export const isSosTileAdded = async (): Promise<boolean> => {
  try {
    const tiles = await TileStatus?.getAddedTiles?.();
    if (!Array.isArray(tiles)) return false;
    return tiles.includes(SOS_TILE_KEY);
  } catch {
    return false;
  }
};
