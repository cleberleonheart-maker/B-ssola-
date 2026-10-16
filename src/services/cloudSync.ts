import {
  deleteCloudRecords,
  ensureCloudUser,
  fetchCloudNotes,
  fetchCloudTracks,
  fetchCloudWaypoints,
  pushNotes,
  pushTracks,
  pushWaypoints,
} from './cloud';
import {
  clearDeletedIds,
  loadDeletedIds,
  type SyncCollection,
} from './syncTombstones';
import {
  loadWaypoints,
  replaceWaypoints,
  type Waypoint,
} from './waypointsService';
import { loadNotes, replaceNotes, type FieldNote } from './notesService';
import {
  loadTracks,
  replaceTracks,
  type RecordedTrack,
  type TrackPoint,
  type TrackPoi,
} from './trackService';

/**
 * Sincronização de dados com a nuvem (ideia #18).
 *
 * O que existia até aqui: escrita sem leitura. `pushNotes` e `pushTracks` eram
 * chamados por botões à mão, e `fetchCloudNotes`/`fetchCloudTracks` não tinham
 * nenhum chamador — de um telemóvel para o outro, só a memória da assistente
 * viajava. E os waypoints não falavam com a nuvem de modo nenhum: mudar de
 * aparelho perdia-os por completo.
 *
 * Este módulo fecha isso com um ciclo pull → merge → push, que é o mesmo em
 * três coleções (pontos, anotações, trilhas):
 *
 *   1. lê o local e o da nuvem (uma só conta anónima, a de `ensureCloudUser`);
 *   2. junta por `id` — o local ganha no empate, porque é o que o usuário tem
 *      à frente, e os itens que só existem na nuvem entram (é o que recupera um
 *      aparelho novo);
 *   3. grava o resultado localmente e sobe só o que mudou (comparação do
 *      payload) — um arranque sem novidades não empurra trilhas inteiras de
 *      novo;
 *   4. apaga na nuvem os itens com lápide local (ver `syncTombstones`).
 *
 * O `upsert` é idempotente e o merge nunca remove linhas, portanto uma falha de
 * rede a meio não parte nada: o pior que acontece é o arranque seguinte
 * repetir. Isso é o "aviso de offline" do #18 — o painel de Configurações lê o
 * resultado por `cloudSyncStatus` em vez de prometer que correu.
 *
 * Limitação conhecida: o "Substituir" de um backup (`applyBackup`) troca as
 * listas sem gravar lápides, e o sync seguinte volta a juntar o que estava na
 * nuvem. Substituir por engano continua a recuperar-se com "Mesclar"; apagar
 * item a item propaga normalmente.
 */

export type SyncState = 'ok' | 'offline' | 'fail';

/** O que o `cloud.ts` devolve por linha: o `id` da chave e o payload em `data`. */
type CloudRecordLite = { id: string; data: unknown };

export type CloudSyncResult = {
  waypoints: Waypoint[];
  notes: FieldNote[];
  tracks: RecordedTrack[];
  state: SyncState;
};

let lastSync: { at: number; state: SyncState } | null = null;

/** Estado do último sync, para o painel de Configurações (ideia #99). */
export const cloudSyncStatus = (): { at: number; state: SyncState } | null =>
  lastSync;

/**
 * Junta duas listas por `id`, com o local a ganhar no empate.
 *
 * É o mesmo desenho do `mergeById` do backup (#70), mas com o vencedor ao
 * contrário: ali quem restaura quer o que trouxe; aqui o item local é o estado
 * mais recente do aparelho que a pessoa está a usar, e o da nuvem só serve para
 * preencher o que falta. A ordem do local preserva-se; os itens só da nuvem
 * entram no fim.
 */
export const mergeCloudItems = <T extends { id: string }>(
  local: T[],
  remote: T[],
): T[] => {
  const byId = new Map<string, T>();
  for (const item of local) byId.set(item.id, item);
  for (const item of remote) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const decodeWaypoint = (record: CloudRecordLite): Waypoint | null => {
  const d = record.data;
  if (!isRecord(d)) return null;
  const latitude = asNumber(d.latitude);
  const longitude = asNumber(d.longitude);
  if (latitude === null || longitude === null) return null;
  return {
    id: record.id,
    name: asString(d.name),
    latitude,
    longitude,
    altitude: asNumber(d.altitude),
    createdAt: asNumber(d.createdAt) ?? 0,
  };
};

const encodeWaypoint = (wp: Waypoint): unknown => ({
  name: wp.name,
  latitude: wp.latitude,
  longitude: wp.longitude,
  altitude: wp.altitude,
  createdAt: wp.createdAt,
});

const decodeNote = (record: CloudRecordLite): FieldNote | null => {
  const d = record.data;
  if (!isRecord(d)) return null;
  const lat = asNumber(d.lat);
  const lon = asNumber(d.lon);
  if (lat === null || lon === null) return null;
  return {
    id: record.id,
    text: asString(d.text),
    lat,
    lon,
    alt: asNumber(d.alt),
    at: asNumber(d.at) ?? 0,
    photoPath: typeof d.photoPath === 'string' ? d.photoPath : null,
    heading: asNumber(d.heading),
    // Veio da nuvem: já está sincronizada, mesmo que o sinal tenha vindo do
    // `push` de outro aparelho.
    cloudSynced: true,
  };
};

const encodeNote = (note: FieldNote): unknown => ({
  text: note.text,
  lat: note.lat,
  lon: note.lon,
  alt: note.alt,
  at: note.at,
  photoPath: note.photoPath,
  heading: note.heading,
});

const decodeTrack = (record: CloudRecordLite): RecordedTrack | null => {
  const d = record.data;
  if (!isRecord(d) || typeof d.name !== 'string' || !Array.isArray(d.points)) {
    return null;
  }
  return {
    id: record.id,
    name: d.name,
    startedAt: asNumber(d.startedAt) ?? 0,
    endedAt: asNumber(d.endedAt) ?? 0,
    points: d.points as TrackPoint[],
    // As trilhas antigas foram subidas sem POIs nem extremos (o botão do
    // `TrackView` mandava só o essencial). O que faltar entra a zero em vez de
    // deitar a trilha fora — o viewer e o mapa aguentam uma trilha sem POIs.
    pois: Array.isArray(d.pois) ? (d.pois as TrackPoi[]) : [],
    distance: asNumber(d.distance) ?? 0,
    eleGain: asNumber(d.eleGain) ?? 0,
    eleLoss: asNumber(d.eleLoss) ?? 0,
    maxAlt: asNumber(d.maxAlt),
    minAlt: asNumber(d.minAlt),
    maxSpeedKmh: asNumber(d.maxSpeedKmh) ?? 0,
  };
};

const encodeTrack = (track: RecordedTrack): unknown => ({
  name: track.name,
  startedAt: track.startedAt,
  endedAt: track.endedAt,
  points: track.points,
  pois: track.pois,
  distance: track.distance,
  eleGain: track.eleGain,
  eleLoss: track.eleLoss,
  maxAlt: track.maxAlt,
  minAlt: track.minAlt,
  maxSpeedKmh: track.maxSpeedKmh,
});

type CollectionPlan<T> = {
  name: SyncCollection;
  load: () => Promise<T[]>;
  replace: (list: T[]) => Promise<T[]>;
  fetch: (userId: string) => Promise<CloudRecordLite[]>;
  push: (
    userId: string,
    items: { id: string; data: unknown }[],
  ) => Promise<boolean>;
  decode: (record: CloudRecordLite) => T | null;
  encode: (item: T) => unknown;
};

const syncCollection = async <T extends { id: string }>(
  plan: CollectionPlan<T>,
): Promise<{ list: T[]; state: SyncState }> => {
  const local = await plan.load();
  const userId = await ensureCloudUser();
  if (!userId) {
    // Sem conta/sessão não há nuvem para falar. O local fica como está — é o
    // mesmo caminho da memória da assistente quando a nuvem está desligada.
    return { list: local, state: 'offline' };
  }

  const remoteRecords = await plan.fetch(userId);
  const deleted = await loadDeletedIds(plan.name);
  const mortos = new Set(Object.keys(deleted));

  const remote: T[] = [];
  const remoteData = new Map<string, unknown>();
  for (const record of remoteRecords) {
    remoteData.set(record.id, record.data);
    if (mortos.has(record.id)) continue;
    const item = plan.decode(record);
    if (item) remote.push(item);
  }

  const merged = mergeCloudItems(local, remote);
  await plan.replace(merged);

  let state: SyncState = 'ok';

  const changed = merged
    .filter(item => {
      const anterior = remoteData.get(item.id);
      if (anterior === undefined) return true;
      return JSON.stringify(anterior) !== JSON.stringify(plan.encode(item));
    })
    .map(item => ({ id: item.id, data: plan.encode(item) }));
  if (changed.length > 0) {
    const ok = await plan.push(userId, changed);
    if (!ok) state = 'fail';
  }

  const idsMortos = Object.keys(deleted);
  if (idsMortos.length > 0) {
    const ok = await deleteCloudRecords(plan.name, userId, idsMortos);
    // Só esquece a lápide quando a nuvem confirma: apagá-la antes seria
    // ressuscitar a linha no arranque seguinte.
    if (ok) await clearDeletedIds(plan.name, idsMortos);
    else state = 'fail';
  }

  return { list: merged, state };
};

const WAYPOINTS_PLAN: CollectionPlan<Waypoint> = {
  name: 'waypoints',
  load: loadWaypoints,
  replace: replaceWaypoints,
  fetch: fetchCloudWaypoints,
  push: pushWaypoints,
  decode: decodeWaypoint,
  encode: encodeWaypoint,
};

const NOTES_PLAN: CollectionPlan<FieldNote> = {
  name: 'notes',
  load: loadNotes,
  replace: replaceNotes,
  fetch: fetchCloudNotes,
  push: pushNotes,
  decode: decodeNote,
  encode: encodeNote,
};

const TRACKS_PLAN: CollectionPlan<RecordedTrack> = {
  name: 'tracks',
  load: loadTracks,
  replace: replaceTracks,
  fetch: fetchCloudTracks,
  push: pushTracks,
  decode: decodeTrack,
  encode: encodeTrack,
};

const pior = (states: SyncState[]): SyncState =>
  states.includes('fail')
    ? 'fail'
    : states.includes('offline')
      ? 'offline'
      : 'ok';

/**
 * Sincroniza as três coleções e devolve as listas já unidas.
 *
 * Sequencial de propósito: partilham o mesmo `ensureCloudUser` (uma sessão
 * anónima) e não há vantagem em mandar três idas à rede em paralelo a partir do
 * arranque da app, onde já há trabalho a competir por rede e bateria.
 */
export const syncAllCollections = async (): Promise<CloudSyncResult> => {
  const waypoints = await syncCollection(WAYPOINTS_PLAN);
  const notes = await syncCollection(NOTES_PLAN);
  const tracks = await syncCollection(TRACKS_PLAN);
  const state = pior([waypoints.state, notes.state, tracks.state]);
  lastSync = { at: Date.now(), state };
  return {
    waypoints: waypoints.list,
    notes: notes.list,
    tracks: tracks.list,
    state,
  };
};

/**
 * Só os waypoints, para chamar logo a seguir a guardar ou apagar um ponto.
 *
 * Devolve a lista final para quem tem o `waypoints` em estado (o
 * `CompassScreen`) a poder actualizar sem uma segunda leitura.
 */
export const syncWaypoints = async (): Promise<Waypoint[]> => {
  const result = await syncCollection(WAYPOINTS_PLAN);
  lastSync = { at: Date.now(), state: result.state };
  return result.list;
};
