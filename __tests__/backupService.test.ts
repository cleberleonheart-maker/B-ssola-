import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyBackup,
  BACKUP_FILE_VERSION,
  buildBackup,
} from '../src/services/backupService';
import { loadWaypoints } from '../src/services/waypointsService';

/**
 * Validação do envelope do backup.
 *
 * A guarda antiga era `!parsed.fileVersion`, que é falso para `0` e para
 * qualquer string não vazia — um backup com `fileVersion: 99` (ou `"1"`)
 * passava e era aplicado por cima dos dados atuais. `applyBackup` grava em
 * dozens de chaves e não há como desfazer, então um arquivo de outra geração do
 * formato tem de ser recusado antes de tocar em nada.
 *
 * Estes testes usam os serviços reais sobre o AsyncStorage mockado, para
 * confirmar também que um envelope recusado não escreve nada.
 */
const envelope = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    app: 'bussola',
    fileVersion: BACKUP_FILE_VERSION,
    exportedAt: '2026-10-01T10:00:00.000Z',
    data: {},
    ...over,
  });

describe('applyBackup — envelope', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('aplica um backup com a versao atual', async () => {
    const raw = envelope({
      data: {
        waypoints: [
          { id: 'w1', name: 'Marco', lat: 41.15, lon: -8.61, createdAt: 1 },
        ],
      },
    });

    await expect(applyBackup(raw)).resolves.toEqual({ ok: true });
    const waypoints = await loadWaypoints();
    expect(waypoints).toHaveLength(1);
    expect(waypoints[0].name).toBe('Marco');
  });

  it('recusa JSON quebrado como invalido', async () => {
    await expect(applyBackup('{ isto nao e json')).resolves.toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('recusa um arquivo que nao e do app', async () => {
    await expect(
      applyBackup(envelope({ app: 'outro-app' })),
    ).resolves.toEqual({ ok: false, error: 'invalid' });
  });

  it('recusa fileVersion ausente', async () => {
    const raw = JSON.stringify({
      app: 'bussola',
      exportedAt: '2026-10-01T10:00:00.000Z',
      data: { waypoints: [{ id: 'w9', name: 'Nao deve entrar', lat: 1, lon: 1 }] },
    });

    await expect(applyBackup(raw)).resolves.toEqual({
      ok: false,
      error: 'unsupported_version',
    });
    // Nada gravado: o guarda de versao vem antes de qualquer escrita.
    expect(await loadWaypoints()).toHaveLength(0);
  });

  it('recusa fileVersion 0, que a guarda antiga aceitava', async () => {
    // `!0` e verdadeiro, mas `!parsed.fileVersion` nao pegava 0 como valor
    // utilizavel... o que importava mesmo era o 99: um numero alto e nao-zero
    // passava pela guarda e era aplicado. Os dois casos ficam de fora.
    await expect(
      applyBackup(envelope({ fileVersion: 0 })),
    ).resolves.toEqual({ ok: false, error: 'unsupported_version' });
  });

  it('recusa uma versao futura em vez de a aplicar', async () => {
    const raw = envelope({
      fileVersion: BACKUP_FILE_VERSION + 98,
      data: {
        waypoints: [{ id: 'w9', name: 'Do futuro', lat: 1, lon: 1 }],
      },
    });

    await expect(applyBackup(raw)).resolves.toEqual({
      ok: false,
      error: 'unsupported_version',
    });
    expect(await loadWaypoints()).toHaveLength(0);
  });

  it('recusa fileVersion em string', async () => {
    // `"1"` !== 1 em JS. A guarda antiga via `!parsed.fileVersion`, que é
    // falso para esta string, portanto o arquivo entrava.
    await expect(
      applyBackup(envelope({ fileVersion: String(BACKUP_FILE_VERSION) })),
    ).resolves.toEqual({ ok: false, error: 'unsupported_version' });
  });

  it('recusa fileVersion fracionario', async () => {
    await expect(
      applyBackup(envelope({ fileVersion: 1.5 })),
    ).resolves.toEqual({ ok: false, error: 'unsupported_version' });
  });

  it('recusa data ausente como invalido', async () => {
    const raw = JSON.stringify({
      app: 'bussola',
      fileVersion: BACKUP_FILE_VERSION,
      exportedAt: '2026-10-01T10:00:00.000Z',
    });

    await expect(applyBackup(raw)).resolves.toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('devolve write_failed com detalhe quando a gravacao falha', async () => {
    const AsyncStorageReal = jest.requireActual(
      '@react-native-async-storage/async-storage',
    );
    const spy = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('disco cheio'));

    const result = await applyBackup(envelope({ data: { waypoints: [] } }));

    expect(result).toEqual({
      ok: false,
      error: 'write_failed',
      detail: 'disco cheio',
    });
    spy.mockRestore();
    void AsyncStorageReal;
  });
});

describe('buildBackup + applyBackup', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('o que exporta volta a entrar com a versao atual', async () => {
    const raw = await buildBackup();
    const parsed = JSON.parse(raw);

    expect(parsed.fileVersion).toBe(BACKUP_FILE_VERSION);
    await expect(applyBackup(raw)).resolves.toEqual({ ok: true });
  });
});