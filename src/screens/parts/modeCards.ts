import type { Translator } from '../../i18n/strings';
import type { DisplayMode } from '../../services/preferencesService';

export type ModeCard = {
  key: DisplayMode;
  icon: string;
  label: string;
  sub: string;
};

export const buildModeCards = (t: Translator): ModeCard[] => [
  { key: 'compass', icon: '🧭', label: t('ui_mode_compass').replace(/^\S+\s*/, ''), sub: t('ui_card_compass') },
  { key: 'level', icon: '◉', label: t('ui_mode_level').replace(/^\S+\s*/, ''), sub: t('ui_card_level') },
  { key: 'metal', icon: '🧲', label: t('ui_mode_metal').replace(/^\S+\s*/, ''), sub: t('ui_card_metal') },
  { key: 'emf', icon: '📡', label: t('ui_mode_emf').replace(/^\S+\s*/, ''), sub: t('ui_card_emf') },
  { key: 'ar', icon: '✨', label: t('ui_mode_ar').replace(/^\S+\s*/, ''), sub: t('ui_card_ar') },
  { key: 'camera', icon: '📷', label: t('ui_mode_camera').replace(/^\S+\s*/, ''), sub: t('ui_card_camera') },
  { key: 'theodolite', icon: '📐', label: t('ui_mode_theodolite').replace(/^\S+\s*/, ''), sub: t('ui_card_theodolite') },
  { key: 'sun', icon: '☀️', label: t('ui_mode_sun').replace(/^\S+\s*/, ''), sub: t('ui_card_sun') },
  { key: 'wind', icon: '🍃', label: t('ui_mode_wind').replace(/^\S+\s*/, ''), sub: t('ui_card_wind') },
  { key: 'track', icon: '🗺️', label: t('ui_mode_track').replace(/^\S+\s*/, ''), sub: t('ui_card_track') },
  { key: 'map', icon: '📍', label: t('ui_mode_map').replace(/^\S+\s*/, ''), sub: t('ui_card_map') },
  { key: 'notes', icon: '📓', label: t('ui_mode_notes').replace(/^\S+\s*/, ''), sub: t('ui_card_notes') },
  { key: 'odometer', icon: '📏', label: t('ui_mode_odometer').replace(/^\S+\s*/, ''), sub: t('ui_card_odometer') },
  { key: 'height', icon: '⌖', label: t('ui_mode_height').replace(/^\S+\s*/, ''), sub: t('ui_card_height') },
  { key: 'car', icon: '🚗', label: t('ui_mode_car').replace(/^\S+\s*/, ''), sub: t('ui_card_car') },
  { key: 'tri', icon: '📐', label: t('ui_mode_tri').replace(/^\S+\s*/, ''), sub: t('ui_card_tri') },
  { key: 'selftest', icon: '🧪', label: t('ui_mode_selftest').replace(/^\S+\s*/, ''), sub: t('ui_card_selftest') },
];
