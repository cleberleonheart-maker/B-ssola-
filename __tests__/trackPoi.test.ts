import {
  createPoiId,
  computeTrackStats,
  loadTracks,
  saveTrack,
  replaceTracks,
  type RecordedTrack,
  type TrackPoi,
} from '../src/services/trackService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const origem = { lat: 38.7223, lon: -9.1393, alt: 0, ts: 0 };

const pois: TrackPoi[] = [
  {
    id: 'poi-abc',
    lat: origem.lat,
    lon: origem.lon,
    alt: 12,
    ts: 1,
    note: 'miradouro',
    photoPath: 'file:///cache/photos/fn-1.jpg',
  },
];

const makeTrack = (overrides: Partial<RecordedTrack> = {}): RecordedTrack => ({
  id: 't1',
  name: 'teste',
  startedAt: 0,
  endedAt: 1000,
  points: [
    { lat: origem.lat, lon: origem.lon, alt: 0, ts: 0 },
    { lat: origem.lat + 0.001, lon: origem.lon, alt: 2, ts: 1000 },
  ],
  pois,
  distance: 0,
  eleGain: 0,
  eleLoss: 0,
  maxAlt: 0,
  minAlt: 0,
  maxSpeedKmh: 0,
  ...overrides,
});

describe('POIs de trilha', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await replaceTracks([]);
  });

  it('cria id no formato esperado', () => {
    expect(createPoiId()).toMatch(/^poi-[a-z0-9-]+$/);
  });

  it('persiste e restaura os POIs junto da trilha', async () => {
    await saveTrack(makeTrack());
    const all = await loadTracks();
    expect(all).toHaveLength(1);
    expect(all[0].pois).toEqual(pois);
  });

  it('aceita trilhas antigas sem o campo pois (nil → lista vazia)', async () => {
    const legacy: Partial<RecordedTrack> = { ...makeTrack() };
    delete legacy.pois;
    await saveTrack(legacy as RecordedTrack);
    const all = await loadTracks();
    expect((all[0].pois ?? []).length).toBe(0);
  });

  it('as estatísticas ignoram os POIs (continuam a só depender dos pontos)', () => {
    const stats = computeTrackStats(makeTrack().points);
    expect(stats).toMatchObject({ eleGain: 2, eleLoss: 0 });
    expect(stats.distance).toBeGreaterThan(0);
  });
});