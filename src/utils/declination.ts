import { normalizeHeading } from './compass';
import { haversine } from './geo';

export type Declination = {
  enabled: boolean;
  degrees: number;
};

export const DEFAULT_DECLINATION: Declination = {
  enabled: false,
  degrees: 0,
};

export const applyDeclination = (heading: number, decl: Declination) => {
  if (!decl.enabled) return heading;
  return normalizeHeading(heading + decl.degrees);
};

const REFERENCE_POINTS: {
  city: string;
  uf: string;
  lat: number;
  lon: number;
  decl: number;
}[] = [
  { city: 'São Paulo', uf: 'SP', lat: -23.55, lon: -46.63, decl: -21 },
  { city: 'Rio de Janeiro', uf: 'RJ', lat: -22.9, lon: -43.17, decl: -22 },
  { city: 'Belo Horizonte', uf: 'MG', lat: -19.92, lon: -43.93, decl: -21 },
  { city: 'Brasília', uf: 'DF', lat: -15.79, lon: -47.88, decl: -19 },
  { city: 'Salvador', uf: 'BA', lat: -12.97, lon: -38.5, decl: -22 },
  { city: 'Recife', uf: 'PE', lat: -8.05, lon: -34.88, decl: -22 },
  { city: 'Fortaleza', uf: 'CE', lat: -3.72, lon: -38.54, decl: -22 },
  { city: 'Natal', uf: 'RN', lat: -5.79, lon: -35.2, decl: -23 },
  { city: 'João Pessoa', uf: 'PB', lat: -7.11, lon: -34.86, decl: -22 },
  { city: 'Manaus', uf: 'AM', lat: -3.11, lon: -60.02, decl: -12 },
  { city: 'Belém', uf: 'PA', lat: -1.45, lon: -48.49, decl: -9 },
  { city: 'Porto Alegre', uf: 'RS', lat: -30.03, lon: -51.22, decl: -14 },
  { city: 'Curitiba', uf: 'PR', lat: -25.42, lon: -49.26, decl: -16 },
  { city: 'Florianópolis', uf: 'SC', lat: -27.59, lon: -48.54, decl: -15 },
  { city: 'Goiânia', uf: 'GO', lat: -16.68, lon: -49.25, decl: -19 },
  { city: 'Campo Grande', uf: 'MS', lat: -20.44, lon: -54.64, decl: -14 },
  { city: 'Cuiabá', uf: 'MT', lat: -15.6, lon: -56.1, decl: -15 },
];

export const suggestDeclination = (lat: number, lon: number) => {
  if (!lat && !lon) return null;
  let best = null as null | { city: string; uf: string; decl: number; dist: number };
  for (const p of REFERENCE_POINTS) {
    const dist = haversine(lat, lon, p.lat, p.lon);
    if (!best || dist < best.dist) {
      best = { city: p.city, uf: p.uf, decl: p.decl, dist };
    }
  }
  if (!best || best.dist > 600_000) return null;
  return best;
};