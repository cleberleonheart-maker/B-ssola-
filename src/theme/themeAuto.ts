import { sunEvents } from '../utils/astro';
import type { ThemeName } from './themes';

/**
 * Tema automático (ideia #15).
 *
 * A ideia é seguir o ciclo do dia e trocar de tema antes de a escuridão chegar,
 * sem ninguém ter de lá ir. Há três maneiras de decidir "é dia?", e o dono
 * escolheu que as três existam — a lógica fica aqui, pura, para o
 * `ThemeContext` a chamar e o teste a confirmar sem relógio nem GPS.
 */

export type ThemeAutoMode = 'scheduleLight' | 'scheduleSun' | 'sunReal';

export const THEME_AUTO_MODES: ThemeAutoMode[] = [
  'scheduleLight',
  'scheduleSun',
  'sunReal',
];

export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 18;

export const isThemeAutoMode = (value: unknown): value is ThemeAutoMode =>
  typeof value === 'string' && (THEME_AUTO_MODES as string[]).includes(value);

type GeoPoint = { lat: number; lon: number };

/**
 * Resolve a estratégia num tema concreto.
 *
 * `sunReal` precisa de posição: sem ela cai no horário fixo em vez de adivinhar
 * — um tema que muda porque não houve fixe seria pior do que não mudar. Nos
 * extremos (sol da meia-noite, noite polar) o `sunEvents` diz o que se passa e
 * não há nascer nem pôr para comparar.
 */
export const resolveAutoTheme = (
  mode: ThemeAutoMode,
  date: Date,
  loc: GeoPoint | null,
): ThemeName => {
  if (mode === 'sunReal' && loc) {
    const ev = sunEvents(date, loc.lat, loc.lon);
    if (ev.polarDay) return 'light';
    if (ev.polarNight) return 'dark';
    if (ev.sunrise && ev.sunset) {
      const t = date.getTime();
      return t >= ev.sunrise.getTime() && t < ev.sunset.getTime() ? 'light' : 'dark';
    }
  }

  const hour = date.getHours();
  const day = hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
  if (mode === 'scheduleSun') {
    return day ? 'sun' : 'night';
  }
  return day ? 'light' : 'dark';
};
