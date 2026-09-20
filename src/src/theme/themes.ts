export type ColorScheme = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  accent: string;
  north: string;
  border: string;
  success: string;
  danger: string;
  warning: string;
};

export type ThemeName = 'dark' | 'light' | 'minimal' | 'adventure' | 'neon';

export const themes: Record<ThemeName, ColorScheme> = {
  dark: {
    background: '#05070F',
    surface: '#0D1220',
    surfaceAlt: '#151B2E',
    text: '#EAF2FF',
    textMuted: '#7E8BB0',
    primary: '#39D6FF',
    accent: '#B48BFF',
    north: '#FF5C6C',
    border: '#1B2440',
    success: '#34E28C',
    danger: '#FF3B5C',
    warning: '#FFB020',
  },
  light: {
    background: '#F2F5FB',
    surface: '#FFFFFF',
    surfaceAlt: '#E8EDF7',
    text: '#1A2233',
    textMuted: '#6B7690',
    primary: '#00838F',
    accent: '#F9A825',
    north: '#D32F2F',
    border: '#DDE5F2',
    success: '#2E7D32',
    danger: '#C62828',
    warning: '#EF6C00',
  },
  minimal: {
    background: '#000000',
    surface: '#101010',
    surfaceAlt: '#1B1B1B',
    text: '#FFFFFF',
    textMuted: '#6E6E6E',
    primary: '#CFCFCF',
    accent: '#9E9E9E',
    north: '#FFFFFF',
    border: '#262626',
    success: '#DFDFDF',
    danger: '#DFDFDF',
    warning: '#9E9E9E',
  },
  adventure: {
    background: '#0E1F0C',
    surface: '#15281A',
    surfaceAlt: '#1D3422',
    text: '#F3F0DE',
    textMuted: '#93A28F',
    primary: '#7BC66E',
    accent: '#F2A33C',
    north: '#FF5B45',
    border: '#2A402B',
    success: '#8FD14F',
    danger: '#E5484D',
    warning: '#F2A33C',
  },
  neon: {
    background: '#03040B',
    surface: '#0A0D22',
    surfaceAlt: '#131840',
    text: '#EAF6FF',
    textMuted: '#7E8BC4',
    primary: '#00E5FF',
    accent: '#FF3DA9',
    north: '#FF4D6D',
    border: '#1F2450',
    success: '#00E98A',
    danger: '#FF1E4F',
    warning: '#FFB300',
  },
};

export const THEME_OPTIONS: { key: ThemeName; label: string }[] = [
  { key: 'dark', label: 'Escuro' },
  { key: 'light', label: 'Claro' },
  { key: 'minimal', label: 'Minimalista' },
  { key: 'adventure', label: 'Aventura' },
  { key: 'neon', label: 'Neon' },
];