import { NativeModules } from 'react-native';
import type { DisplayMode } from './preferencesService';

/**
 * Tiles das Definições Rápidas (ideia #14).
 *
 * Cada tile abre a app já no seu modo. A lista abaixo tem de bater com as
 * classes de `ModeTileService.kt` (uma por tile): um tile que não exista
 * aqui simplesmente não aparece nas definições.
 */
export const TILE_MODES: DisplayMode[] = [
  'compass',
  'ar',
  'level',
  'metal',
  'emf',
  'sun',
  'track',
  'tri',
];

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
