import { DISPLAY_MODES, type DisplayMode } from '../services/preferencesService';

/**
 * Atalhos que abrem a app (ideia #14).
 *
 * O `bussola://sos` já existia (o botão do widget abre o ecrã de emergência).
 * Os tiles das Definições Rápidas usam `bussola://mode/<modo>`: o tile abre a
 * app já no modo pedido, sem passar pelo menu de modos.
 */
export const MODE_URL_PREFIX = 'bussola://mode/';

/**
 * O modo pedido por um atalho, ou null se o url não for um atalho de modo
 * (ou pedir um modo que não existe).
 */
export const parseModeUrl = (url: string | null | undefined): DisplayMode | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed.toLowerCase().startsWith(MODE_URL_PREFIX)) return null;
  const mode = trimmed.slice(MODE_URL_PREFIX.length).toLowerCase();
  return DISPLAY_MODES.includes(mode as DisplayMode) ? (mode as DisplayMode) : null;
};
