import { DISPLAY_MODES } from '../src/services/preferencesService';
import { getAddedTiles, TILE_MODES } from '../src/services/tileService';

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
});
