import {
  resolveAutoTheme,
  isThemeAutoMode,
  THEME_AUTO_MODES,
} from '../src/theme/themeAuto';
import { sunEvents } from '../src/utils/astro';

const at = (hour: number, minute = 0, day = 15) =>
  new Date(2026, 0, day, hour, minute, 0, 0);

/**
 * O tema automático (ideia #15) é o único sítio onde "que horas são" vira uma
 * decisão de cor. Isolar a decisão numa função pura é o que permite testá-la a
 * qualquer hora — inclusive às 3 da manhã, quando é justamente ela que importa.
 */
describe('resolveAutoTheme — por horário', () => {
  it('Claro de dia, Escuro à noite, com as fronteiras certas', () => {
    expect(resolveAutoTheme('scheduleLight', at(6), null)).toBe('light');
    expect(resolveAutoTheme('scheduleLight', at(12), null)).toBe('light');
    expect(resolveAutoTheme('scheduleLight', at(17, 59), null)).toBe('light');
    expect(resolveAutoTheme('scheduleLight', at(18), null)).toBe('dark');
    expect(resolveAutoTheme('scheduleLight', at(23), null)).toBe('dark');
    expect(resolveAutoTheme('scheduleLight', at(5), null)).toBe('dark');
  });

  it('Sol forte de dia, Noturno à noite', () => {
    expect(resolveAutoTheme('scheduleSun', at(9), null)).toBe('sun');
    expect(resolveAutoTheme('scheduleSun', at(21), null)).toBe('night');
  });
});

describe('resolveAutoTheme — pelo sol real', () => {
  // São Paulo: 12h é dia, 3h é noite, em qualquer fuso do test runner.
  const saoPaulo = { lat: -23.5, lon: -46.6 };

  it('de dia usa o tema claro e de noite o escuro', () => {
    expect(resolveAutoTheme('sunReal', at(12), saoPaulo)).toBe('light');
    expect(resolveAutoTheme('sunReal', at(3), saoPaulo)).toBe('dark');
  });

  it('concorda com o que o próprio astro calcula para o nascer e o pôr', () => {
    const ev = sunEvents(at(12), saoPaulo.lat, saoPaulo.lon);
    expect(ev.sunrise).not.toBeNull();
    expect(ev.sunset).not.toBeNull();
    if (ev.sunrise && ev.sunset) {
      // Um minuto depois do nascer é dia; um minuto depois do pôr é noite.
      expect(resolveAutoTheme('sunReal', new Date(ev.sunrise.getTime() + 60000), saoPaulo)).toBe(
        'light',
      );
      expect(resolveAutoTheme('sunReal', new Date(ev.sunset.getTime() + 60000), saoPaulo)).toBe(
        'dark',
      );
    }
  });

  it('sem posição cai no horário fixo, em vez de adivinhar', () => {
    expect(resolveAutoTheme('sunReal', at(12), null)).toBe('light');
    expect(resolveAutoTheme('sunReal', at(23), null)).toBe('dark');
  });

  it('nos extremos, segue o sol da meia-noite e a noite polar', () => {
    const alto = { lat: 80, lon: 0 };
    // Julho no Ártico: o sol não se põe.
    expect(resolveAutoTheme('sunReal', new Date(2026, 6, 15, 12, 0, 0), alto)).toBe('light');
    // Janeiro no Ártico: o sol não nasce.
    expect(resolveAutoTheme('sunReal', new Date(2026, 0, 15, 12, 0, 0), alto)).toBe('dark');
  });
});

describe('isThemeAutoMode', () => {
  it('aceita as três estratégias e recusa o resto', () => {
    for (const mode of THEME_AUTO_MODES) {
      expect(isThemeAutoMode(mode)).toBe(true);
    }
    expect(isThemeAutoMode('space')).toBe(false);
    expect(isThemeAutoMode(null)).toBe(false);
    expect(isThemeAutoMode('qualquer')).toBe(false);
  });
});
