import { DISPLAY_MODES } from '../src/services/preferencesService';
import { NativeModules } from 'react-native';

import {
  getAddedTiles,
  isSosTileAdded,
  SOS_TILE_KEY,
  TILE_MODES,
} from '../src/services/tileService';

describe('os tiles das Definições Rápidas', () => {
  it('só há tiles para modos que existem', () => {
    for (const mode of TILE_MODES) {
      expect(DISPLAY_MODES).toContain(mode);
    }
  });

  it('há um tile para cada modo do app', () => {
    expect([...TILE_MODES].sort()).toEqual([...DISPLAY_MODES].sort());
  });

  it('sem o módulo nativo a lista de tiles é vazia', async () => {
    // No Jest não há módulo nativo: a app tem de saber isso sem breaking.
    await expect(getAddedTiles()).resolves.toEqual([]);
  });

  it('o tile do SOS não é um modo', () => {
    // O "sos" abre o ecrã de emergência: é uma acção, não um modo. Se
    // entrasse na lista dos modos, o diálogo diria que há um modo chamado
    // "sos" e a app abriria um ecrã que não existe.
    expect(TILE_MODES).not.toContain(SOS_TILE_KEY as never);
  });
});

describe('o tile do modo de assalto', () => {
  /**
   * O `tileService` lê o módulo nativo no import, por isso o mock tem de
   * estar montado antes de o módulo ser carregado — daí o `isolateModules`.
   */
  const loadWithTiles = (tiles: string[]) => {
    (NativeModules as Record<string, unknown>).TileStatus = {
      getAddedTiles: jest.fn().mockResolvedValue(tiles),
    };
    let mod!: typeof import('../src/services/tileService');
    jest.isolateModules(() => {
      mod = require('../src/services/tileService');
    });
    return mod;
  };

  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).TileStatus;
  });

  it('diz se o Android o pôs no painel', async () => {
    const mod = loadWithTiles(['compass', 'sos']);

    await expect(mod.isSosTileAdded()).resolves.toBe(true);
  });

  it('sem o módulo nativo, diz que não', async () => {
    await expect(isSosTileAdded()).resolves.toBe(false);
  });

  it('o tile do SOS não entra na lista dos modos', async () => {
    const mod = loadWithTiles(['compass', 'sos']);

    await expect(mod.getAddedTiles()).resolves.toEqual(['compass']);
  });
});
