import { Share, Platform } from 'react-native';
import type { FieldNote } from './notesService';

const formatDate = (ts: number) => {
  try {
    return new Date(ts).toISOString().replace('T', ' ').slice(0, 16);
  } catch {
    return String(ts);
  }
};

export const exportNotesReport = async (notes: FieldNote[]) => {
  if (!notes.length) return false;
  const lines: string[] = [];
  lines.push('Bússola - Relatório da Caderneta');
  lines.push(`Gerado: ${formatDate(Date.now())}`);
  lines.push(`Total: ${notes.length} nota(s)`);
  lines.push('');
  notes
    .slice()
    .sort((a, b) => a.at - b.at)
    .forEach((n, i) => {
      lines.push(`## ${i + 1}. ${formatDate(n.at)}`);
      if (Number.isFinite(n.lat) && Number.isFinite(n.lon)) {
        lines.push(`Coordenadas: ${n.lat.toFixed(6)}, ${n.lon.toFixed(6)}`);
        lines.push(`Mapa: https://maps.google.com/?q=${n.lat.toFixed(6)},${n.lon.toFixed(6)}`);
      }
      if (n.alt != null && Number.isFinite(n.alt)) {
        lines.push(`Altitude: ${Math.round(n.alt)} m`);
      }
      if (n.heading != null && Number.isFinite(n.heading)) {
        lines.push(`Rumo: ${Math.round(n.heading)}°`);
      }
      lines.push('');
      lines.push(n.text);
      if (n.photoPath) {
        lines.push('');
        lines.push(`Foto: ${n.photoPath}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    });
  const text = lines.join('\n');
  try {
    await Share.share(
      {
        message: text,
        title: 'Bússola - Relatório da Caderneta',
      },
      Platform.OS === 'android' ? { dialogTitle: 'Exportar relatório' } : undefined,
    );
    return true;
  } catch {
    return false;
  }
};
