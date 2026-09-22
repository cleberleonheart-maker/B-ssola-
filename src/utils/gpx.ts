import type { RecordedTrack } from '../services/trackService';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toIso = (ms: number) => new Date(ms).toISOString();

export const serializeTrackToGpx = (track: RecordedTrack): string => {
  const name = escapeXml(track.name);
  const pts = track.points
    .map(p => {
      const ele =
        p.alt != null && isFinite(p.alt)
          ? `        <ele>${p.alt.toFixed(1)}</ele>\n`
          : '';
      const time = `        <time>${toIso(p.ts)}</time>`;
      return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">\n${ele}${time}\n      </trkpt>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="B\u00fassola" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    `    <name>${name}</name>`,
    `    <time>${toIso(track.startedAt)}</time>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${name}</name>`,
    '    <trkseg>',
    pts,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
};