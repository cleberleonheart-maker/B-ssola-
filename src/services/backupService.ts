import {
  loadDeclination,
  saveDeclination,
  loadWindCal,
  saveWindCal,
  loadVoiceGuide,
  saveVoiceGuide,
  loadUseMils,
  saveUseMils,
  loadUnitSystem,
  saveUnitSystem,
  loadAppMode,
  saveAppMode,
  loadVirtualWp,
  saveVirtualWp,
  type AppMode,
  type WindCal,
} from './preferencesService';
import {
  loadWaypoints,
  replaceWaypoints,
  type Waypoint,
} from './waypointsService';
import {
  loadTracks,
  replaceTracks,
  type RecordedTrack,
} from './trackService';
import { loadNotes, replaceNotes, type FieldNote } from './notesService';
import { loadFov, saveFov } from './fovService';
import { carSpotService, type CarSpot } from './carSpotService';
import {
  getTotals,
  setTotals,
  type DayTotal,
} from './odometerService';
import type { Declination } from '../utils/declination';
import type { UnitSystem } from '../utils/units';

export const BACKUP_FILE_VERSION = 1;

export type BackupData = {
  waypoints: Waypoint[];
  tracks: RecordedTrack[];
  notes: FieldNote[];
  declination: Declination;
  windCal: WindCal;
  fov: number;
  voiceGuide: boolean;
  useMils: boolean;
  unitSystem: UnitSystem;
  appMode: AppMode;
  virtualWpName: string | null;
  carSpot: CarSpot | null;
  odometer: { lastDays: DayTotal[] };
};

type BackupEnvelope = {
  app: 'bussola';
  fileVersion: number;
  exportedAt: string;
  data: BackupData;
};

export const buildBackup = async (): Promise<string> => {
  const [
    waypoints,
    tracks,
    notes,
    declination,
    windCal,
    fov,
    voiceGuide,
    useMils,
    unitSystem,
    appMode,
    virtualWpId,
    carSpot,
    totals,
  ] = await Promise.all([
    loadWaypoints(),
    loadTracks(),
    loadNotes(),
    loadDeclination(),
    loadWindCal(),
    loadFov(),
    loadVoiceGuide(),
    loadUseMils(),
    loadUnitSystem(),
    loadAppMode(),
    loadVirtualWp(),
    carSpotService.load(),
    getTotals(),
  ]);

  let virtualWpName: string | null = null;
  if (virtualWpId) {
    const wp = waypoints.find(w => w.id === virtualWpId);
    virtualWpName = wp ? wp.name : null;
  }

  const envelope: BackupEnvelope = {
    app: 'bussola',
    fileVersion: BACKUP_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      waypoints,
      tracks,
      notes,
      declination,
      windCal,
      fov,
      voiceGuide,
      useMils,
      unitSystem,
      appMode,
      virtualWpName,
      carSpot,
      odometer: { lastDays: totals.lastDays },
    },
  };
  return JSON.stringify(envelope, null, 2);
};

/**
 * `invalid` = não é um backup do Bússola (JSON quebrado, `app` errado, `data`
 * ausente). `unsupported_version` = é um backup, mas de outra geração do
 * formato. `write_failed` = o arquivo era válido mas uma gravação falhou no
 * meio (ver `detail`).
 *
 * Os três são diferentes na cara do usuário: o primeiro diz "não consegui ler",
 * o segundo diz "esse arquivo vem de uma versão do app que você não tem" e o
 * terceiro diz "não consegui gravar". Colapsar os dois primeiros fazia um
 * backup do futuro ser aplicado como se fosse do presente — o
 * `!parsed.fileVersion` antigo aceitava 99.
 */
export type BackupError = 'invalid' | 'unsupported_version' | 'write_failed';
export type BackupResult =
  | { ok: true }
  | { ok: false; error: BackupError; detail?: string };

/**
 * `replace` aplica o backup por cima dos dados atuais (o comportamento de
 * sempre). `merge` junta as coleções (pontos, trilhas, anotações) sem apagar o
 * que já cá está: a ideia #70 — importar sem perder por engano o que já era
 * bom. As preferências de valor único (declinação, calibrações, ajustes) não
 * têm como se "juntar", por isso são aplicadas nos dois modos.
 */
export type BackupMode = 'replace' | 'merge';

/** O que o backup traz, para a pré-visualização antes de aplicar (#70). */
export type BackupSummary = {
  waypoints: number;
  tracks: number;
  notes: number;
};

export type BackupInspection =
  | { ok: true; summary: BackupSummary; data: BackupData }
  | { ok: false; error: BackupError };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Valida o envelope e devolve o `data` já tipado. Partilhado por
 * `inspectBackup` e `applyBackup` para que a pré-visualização e a aplicação
 * nunca discordem sobre o que é um backup válido.
 */
const parseEnvelope = (
  raw: string,
): { ok: true; data: Partial<BackupData> } | { ok: false; error: BackupError } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (!isRecord(parsed) || parsed.app !== 'bussola') {
    return { ok: false, error: 'invalid' };
  }
  if (
    parsed.fileVersion !== BACKUP_FILE_VERSION ||
    !Number.isInteger(parsed.fileVersion)
  ) {
    return { ok: false, error: 'unsupported_version' };
  }
  if (!isRecord(parsed.data)) {
    return { ok: false, error: 'invalid' };
  }
  return { ok: true, data: parsed.data as Partial<BackupData> };
};

/**
 * Lê o backup sem gravar nada: devolve o resumo para o ecrã de
 * pré-visualização (quantos pontos, trilhas e anotações vêm) ou o erro pelo
 * qual seria recusado. Síncrono de propósito — é só leitura.
 */
export const inspectBackup = (raw: string): BackupInspection => {
  const parsed = parseEnvelope(raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  const data = parsed.data;
  return {
    ok: true,
    summary: {
      waypoints: Array.isArray(data.waypoints) ? data.waypoints.length : 0,
      tracks: Array.isArray(data.tracks) ? data.tracks.length : 0,
      notes: Array.isArray(data.notes) ? data.notes.length : 0,
    },
    data: data as BackupData,
  };
};

/**
 * Junta duas listas por `id`, preservando a ordem do que já existe e deixando
 * o item do backup ganhar quando o `id` coincide (quem restaura quer o valor
 * que trouxe, não o que estava). Itens novos entram no fim.
 */
const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
  const byId = new Map<string, T>();
  for (const item of current) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
};

export const applyBackup = async (
  raw: string,
  options: { mode?: BackupMode } = {},
): Promise<BackupResult> => {
  const parsed = parseEnvelope(raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  const data = parsed.data;
  const mode = options.mode ?? 'replace';

  try {
    if (Array.isArray(data.waypoints)) {
      const incoming = data.waypoints as Waypoint[];
      await replaceWaypoints(
        mode === 'merge' ? mergeById(await loadWaypoints(), incoming) : incoming,
      );
    }
    if (Array.isArray(data.tracks)) {
      const incoming = data.tracks as RecordedTrack[];
      await replaceTracks(
        mode === 'merge' ? mergeById(await loadTracks(), incoming) : incoming,
      );
    }
    if (Array.isArray(data.notes)) {
      const incoming = data.notes as FieldNote[];
      await replaceNotes(
        mode === 'merge' ? mergeById(await loadNotes(), incoming) : incoming,
      );
    }
    if (isRecord(data.declination)) {
      await saveDeclination(data.declination as Declination);
    }
    if (isRecord(data.windCal)) {
      await saveWindCal(data.windCal as WindCal);
    }
    if (typeof data.fov === 'number') {
      await saveFov(data.fov);
    }
    if (typeof data.voiceGuide === 'boolean') {
      await saveVoiceGuide(data.voiceGuide);
    }
    if (typeof data.useMils === 'boolean') {
      await saveUseMils(data.useMils);
    }
    if (data.unitSystem === 'metric' || data.unitSystem === 'imperial') {
      await saveUnitSystem(data.unitSystem);
    }
    if (typeof data.appMode === 'string') {
      await saveAppMode(data.appMode as AppMode);
    }
    if (isRecord(data.carSpot)) {
      await carSpotService.save(data.carSpot as CarSpot);
    } else {
      await carSpotService.clear();
    }
    if (isRecord(data.odometer) && Array.isArray(data.odometer.lastDays)) {
      const map: Record<string, number> = {};
      for (const entry of data.odometer.lastDays) {
        if (isRecord(entry) && typeof entry.day === 'string' && typeof entry.meters === 'number') {
          map[entry.day] = entry.meters;
        }
      }
      await setTotals(map);
    }
    if (data.virtualWpName && Array.isArray(data.waypoints)) {
      const wp = (data.waypoints as Waypoint[]).find(
        w => w.name === data.virtualWpName,
      );
      await saveVirtualWp(wp ? wp.id : null);
    } else {
      await saveVirtualWp(null);
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: 'write_failed',
      detail: error instanceof Error ? error.message : 'unknown',
    };
  }
};