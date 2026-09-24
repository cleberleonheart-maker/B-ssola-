import {
  loadDeclination,
  saveDeclination,
  loadWindCal,
  saveWindCal,
  loadVoiceGuide,
  saveVoiceGuide,
  loadUseMils,
  saveUseMils,
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
      appMode,
      virtualWpName,
      carSpot,
      odometer: { lastDays: totals.lastDays },
    },
  };
  return JSON.stringify(envelope, null, 2);
};

export type BackupResult = { ok: true } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const applyBackup = async (raw: string): Promise<BackupResult> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (!isRecord(parsed) || parsed.app !== 'bussola' || !parsed.fileVersion) {
    return { ok: false, error: 'invalid' };
  }
  if (!isRecord(parsed.data)) {
    return { ok: false, error: 'invalid' };
  }
  const data = parsed.data as Partial<BackupData>;

  try {
    if (Array.isArray(data.waypoints)) {
      await replaceWaypoints(data.waypoints as Waypoint[]);
    }
    if (Array.isArray(data.tracks)) {
      await replaceTracks(data.tracks as RecordedTrack[]);
    }
    if (Array.isArray(data.notes)) {
      await replaceNotes(data.notes as FieldNote[]);
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
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
};