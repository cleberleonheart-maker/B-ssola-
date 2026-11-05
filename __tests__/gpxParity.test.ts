import fs from 'fs';
import path from 'path';
import vm from 'vm';

import { serializeTrackToGpx } from '../src/utils/gpx';
import type { RecordedTrack } from '../src/services/trackService';

/**
 * O GPX e escrito duas vezes: em TypeScript para o app (`src/utils/gpx.ts`) e
 * em ES5 dentro de `web/gpx.html`, a pagina da trilha partilhada (ideia #37).
 *
 * As duas copias divergem em silencio: o telefone exporta um GPX e quem
 * recebe o link descarrega outro. O problema aparece longe de quem escreve o
 * codigo -- no e-mail que a pessoa mandou -- e assim ninguem sabe qual das
 * duas esta certa. Este ficheiro corre as duas no mesmo fixture e compara as
 * strings byte a byte.
 */

const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'gpx.html'), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));

/** A copia ES5 comeca na fuga do XML e acaba em `function $(id)`. */
const BLOCK_START = 'function escapeXml(value)';
const BLOCK_END = 'function $(id)';

type PageGpx = {
  buildGpx: (name: string, startedAt: number, points: RecordedTrack['points']) => string;
};

const readPageGpx = (): PageGpx => {
  const from = script.indexOf(BLOCK_START);
  const to = script.indexOf(BLOCK_END);
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);

  const block = script.slice(from, to);
  const sandbox: Record<string, unknown> = { Math, Date, isFinite, String };
  vm.createContext(sandbox);
  vm.runInContext(
    `${block}
     __gpx = { buildGpx: buildGpx };`,
    sandbox,
  );

  const gpx = sandbox.__gpx as PageGpx;
  expect(typeof gpx.buildGpx).toBe('function');
  return gpx;
};

const page = readPageGpx();

const TRACK = (name: string, points: RecordedTrack['points']): RecordedTrack => ({
  id: 'trk-1',
  name,
  startedAt: Date.UTC(2026, 10, 5, 9, 30, 0),
  endedAt: Date.UTC(2026, 10, 5, 10, 15, 0),
  points,
  pois: [],
  distance: 1234.5,
  eleGain: 80,
  eleLoss: 60,
  maxAlt: 120,
  minAlt: 40,
  maxSpeedKmh: 8.5,
});

const POINTS: RecordedTrack['points'] = [
  { lat: 38.7223, lon: -9.1393, alt: 42.4, ts: Date.UTC(2026, 10, 5, 9, 30, 0) },
  { lat: 38.7231, lon: -9.1381, alt: null, ts: Date.UTC(2026, 10, 5, 9, 32, 30) },
  { lat: 38.7245, lon: -9.1402, alt: 51.05, ts: Date.UTC(2026, 10, 5, 9, 35, 0) },
];

describe('o GPX da página é o mesmo que o do app', () => {
  it('numa trilha simples', () => {
    const track = TRACK('Trilha da manhã', POINTS);

    expect(page.buildGpx(track.name, track.startedAt, track.points)).toBe(
      serializeTrackToGpx(track),
    );
  });

  it('num nome com caracteres que o XML guarda', () => {
    const track = TRACK('Pé & "Serra" <do Vale>', POINTS);

    const gpx = page.buildGpx(track.name, track.startedAt, track.points);

    expect(gpx).toBe(serializeTrackToGpx(track));
    expect(gpx).toContain('&');
    expect(gpx).not.toContain('<Serra>');
  });

  it('numa trilha sem pontos', () => {
    const track = TRACK('Trilha vazia', []);

    expect(page.buildGpx(track.name, track.startedAt, track.points)).toBe(
      serializeTrackToGpx(track),
    );
  });

  it('o GPX tem o cabecalho, o nome e os pontos', () => {
    const track = TRACK('Trilha da manhã', POINTS);
    const gpx = serializeTrackToGpx(track);

    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(gpx).toContain('<name>Trilha da manhã</name>');
    expect(gpx).toContain('<trkpt lat="38.7223000" lon="-9.1393000">');
    expect(gpx).toContain('<ele>42.4</ele>');
    expect(gpx.trimEnd().endsWith('</gpx>')).toBe(true);
  });
});
