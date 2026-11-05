/**
 * A partilha de trilha por link (ideia #37).
 *
 * O que se prova aqui e o que nao da para ver na nuvem: o link tem de levar o
 * token no hash (e nao na query), o token tem de ser diferente em cada
 * partilha, e a trilha tem de estar na nuvem ANTES de o link existir -- um
 * link para uma trilha que o servidor nao tem abre uma pagina vazia do
 * outro lado, e isso parece um bug do link e nao e.
 */

type CloudMock = {
  ensureCloudUser: jest.Mock;
  pushTracks: jest.Mock;
  createTrackShare: jest.Mock;
};

const loadLinkService = (cloud: CloudMock) => {
  jest.doMock('../src/services/cloud', () => cloud);
  let service!: typeof import('../src/services/trackLinkShare');
  jest.isolateModules(() => {
    service = jest.requireActual(
      '../src/services/trackLinkShare',
    ) as typeof import('../src/services/trackLinkShare');
  });
  return service;
};

const TRACK = {
  id: 'trk-2026',
  name: 'Trilha da manhã',
  startedAt: Date.UTC(2026, 10, 5, 9, 30, 0),
  endedAt: Date.UTC(2026, 10, 5, 10, 15, 0),
  points: [{ lat: 38.7223, lon: -9.1393, alt: 42, ts: Date.UTC(2026, 10, 5, 9, 30, 0) }],
  pois: [],
  distance: 1234,
  eleGain: 80,
  eleLoss: 60,
  maxAlt: 120,
  minAlt: 40,
  maxSpeedKmh: 8,
};

const cloudOk = (): CloudMock => ({
  ensureCloudUser: jest.fn().mockResolvedValue('user-1'),
  pushTracks: jest.fn().mockResolvedValue(true),
  createTrackShare: jest.fn().mockResolvedValue(true),
});

describe('o link da trilha', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock('../src/services/cloud');
  });

  it('leva o token no hash, e nao na query', () => {
    const { trackLinkUrl } = loadLinkService(cloudOk());

    const url = trackLinkUrl('abc123');

    expect(url).toBe('https://cleberleonheart-maker.github.io/B-ssola-/gpx.html#tkn=abc123');
    expect(url).not.toContain('?');
  });

  it('escapa o token, para nao partir a pagina', () => {
    const { trackLinkUrl } = loadLinkService(cloudOk());

    expect(trackLinkUrl('a b&c')).toContain('#tkn=a%20b%26c');
  });

  it('cada partilha tem o seu token', () => {
    const { newTrackToken } = loadLinkService(cloudOk());

    const a = newTrackToken();
    const b = newTrackToken();

    expect(a.startsWith('trk')).toBe(true);
    expect(a.length).toBeGreaterThan(8);
    expect(a).not.toBe(b);
  });

  it('sem nuvem nao ha link', async () => {
    const cloud = cloudOk();
    cloud.ensureCloudUser.mockResolvedValue(null);
    const { createTrackLink } = loadLinkService(cloud);

    const result = await createTrackLink(TRACK);

    expect(result).toEqual({ ok: false, reason: 'cloud' });
    expect(cloud.pushTracks).not.toHaveBeenCalled();
  });

  it('a trilha sobe para a nuvem antes do link existir', async () => {
    const cloud = cloudOk();
    const { createTrackLink } = loadLinkService(cloud);

    const result = await createTrackLink(TRACK);

    expect(result.ok).toBe(true);
    expect(cloud.pushTracks).toHaveBeenCalledTimes(1);
    expect(cloud.pushTracks.mock.calls[0][0]).toBe('user-1');
    expect(cloud.pushTracks.mock.calls[0][1][0].id).toBe(TRACK.id);
    expect(cloud.createTrackShare).toHaveBeenCalledTimes(1);
  });

  it('se a trilha nao sobe, nao ha link', async () => {
    const cloud = cloudOk();
    cloud.pushTracks.mockResolvedValue(false);
    const { createTrackLink } = loadLinkService(cloud);

    const result = await createTrackLink(TRACK);

    expect(result).toEqual({ ok: false, reason: 'error' });
    expect(cloud.createTrackShare).not.toHaveBeenCalled();
  });

  it('se a partilha nao se cria, nao ha link', async () => {
    const cloud = cloudOk();
    cloud.createTrackShare.mockResolvedValue(false);
    const { createTrackLink } = loadLinkService(cloud);

    const result = await createTrackLink(TRACK);

    expect(result).toEqual({ ok: false, reason: 'error' });
  });

  it('o link que sai tem o token que foi guardado', async () => {
    const cloud = cloudOk();
    const { createTrackLink } = loadLinkService(cloud);

    const result = await createTrackLink(TRACK);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const token = cloud.createTrackShare.mock.calls[0][1];
    expect(result.url).toContain(`#tkn=${token}`);
    expect(cloud.createTrackShare.mock.calls[0][0]).toBe('user-1');
    expect(cloud.createTrackShare.mock.calls[0][2]).toBe(TRACK.id);
    expect(cloud.createTrackShare.mock.calls[0][3]).toBeGreaterThan(Date.now());
  });
});

// Modulo, e nao script: um `const` de topo num script passa a ser global e
// choca com os nomes das outras suites.
export {};
