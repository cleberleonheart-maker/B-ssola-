import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyBackup,
  BACKUP_FILE_VERSION,
  buildBackup,
  inspectBackup,
} from '../src/services/backupService';
import {
  loadWaypoints,
  saveWaypoint,
  type Waypoint,
} from '../src/services/waypointsService';
import { loadTracks, saveTrack, type RecordedTrack } from '../src/services/trackService';
import { loadNotes, saveNote, type FieldNote } from '../src/services/notesService';

const wp = (id: string, name: string): Waypoint => ({
  id,
  name,
  latitude: 1,
  longitude: 2,
  altitude: null,
  createdAt: 1,
});

const track = (id: string, name: string): RecordedTrack => ({
  id,
  name,
  startedAt: 1,
  endedAt: 2,
  points: [
    { lat: 1, lon: 1, alt: null, ts: 1 },
    { lat: 1.001, lon: 1.001, alt: null, ts: 2000 },
  ],
  pois: [],
  distance: 0,
  eleGain: 0,
  eleLoss: 0,
  maxAlt: null,
  minAlt: null,
  maxSpeedKmh: 0,
});

const note = (id: string, text: string): FieldNote => ({
  id,
  text,
  lat: 1,
  lon: 2,
  alt: null,
  at: 1,
  photoPath: null,
  heading: null,
  cloudSynced: false,
});

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

/**
 * Pré-visualização (ideia #70): o `inspectBackup` lê o arquivo sem gravar e
 * devolve o que ele traz, para o diálogo perguntar Substituir ou Mesclar antes
 * de tocar em nada.
 */
describe('inspectBackup — pré-visualização sem escrita', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('conta pontos, trilhas e anotações do backup', () => {
    const raw = envelope({
      data: {
        waypoints: [wp('w1', 'A'), wp('w2', 'B')],
        tracks: [track('t1', 'Ida')],
        notes: [note('n1', 'Pedra'), note('n2', 'Rio'), note('n3', 'Fim')],
      },
    });

    const result = inspectBackup(raw);
    expect(result).toEqual({
      ok: true,
      summary: { waypoints: 2, tracks: 1, notes: 3 },
      data: expect.any(Object),
    });
  });

  it('não escreve nada no aparelho', async () => {
    const raw = envelope({ data: { waypoints: [wp('w1', 'A')] } });
    inspectBackup(raw);
    expect(await loadWaypoints()).toHaveLength(0);
  });

  it('devolve os mesmos erros que o applyBackup recusaria', () => {
    expect(inspectBackup('{ quebrado')).toEqual({ ok: false, error: 'invalid' });
    expect(inspectBackup(envelope({ app: 'outro' }))).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(inspectBackup(envelope({ fileVersion: 99 }))).toEqual({
      ok: false,
      error: 'unsupported_version',
    });
  });

  it('conta zero quando o backup não traz coleções', () => {
    expect(inspectBackup(envelope({ data: {} }))).toEqual({
      ok: true,
      summary: { waypoints: 0, tracks: 0, notes: 0 },
      data: expect.any(Object),
    });
  });
});

/**
 * Mesclar x Substituir (ideia #70). O modo padrão continua a ser `replace`
 * (substitui tudo), e `merge` é a novidade: junta por id sem apagar o que já
 * estava — é o que impede um arquivo trocado de levar os dados bons.
 */
describe('applyBackup — mesclar vs substituir', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('substituir (padrão) descarta o que já existia', async () => {
    await saveWaypoint(wp('local', 'Local'));
    await expect(
      applyBackup(envelope({ data: { waypoints: [wp('novo', 'Novo')] } })),
    ).resolves.toEqual({ ok: true });

    const names = (await loadWaypoints()).map(w => w.name);
    expect(names).toEqual(['Novo']);
  });

  it('mesclar junta pontos novos sem perder os atuais', async () => {
    await saveWaypoint(wp('local', 'Local'));
    await applyBackup(
      envelope({ data: { waypoints: [wp('novo', 'Novo')] } }),
      { mode: 'merge' },
    );

    const names = (await loadWaypoints()).map(w => w.name).sort();
    expect(names).toEqual(['Local', 'Novo']);
  });

  it('mesclar deixa o item do backup ganhar quando o id coincide', async () => {
    await saveWaypoint(wp('x', 'Nome antigo'));
    await applyBackup(
      envelope({ data: { waypoints: [wp('x', 'Nome do backup')] } }),
      { mode: 'merge' },
    );

    const list = await loadWaypoints();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Nome do backup');
  });

  it('mesclar também junta trilhas e anotações', async () => {
    await saveTrack(track('t-local', 'Trilha local'));
    await saveNote(note('n-local', 'Nota local'));

    await applyBackup(
      envelope({
        data: {
          tracks: [track('t-backup', 'Trilha do backup')],
          notes: [note('n-backup', 'Nota do backup')],
        },
      }),
      { mode: 'merge' },
    );

    expect((await loadTracks()).map(t => t.name).sort()).toEqual([
      'Trilha do backup',
      'Trilha local',
    ]);
    expect((await loadNotes()).map(n => n.text).sort()).toEqual([
      'Nota do backup',
      'Nota local',
    ]);
  });
});