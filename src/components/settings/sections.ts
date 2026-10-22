/**
 * As secções de Configurações, por ordem.
 *
 * A lista vive aqui para que o índice (as fichas no topo) e o ecrã não possam
 * divergir: o índice desenha o que está nesta lista, e cada secção do ecrã é
 * identificada pelo mesmo `id`. Uma secção nova entra aqui uma vez só.
 */
export type SettingsSectionId =
  | 'aparencia'
  | 'utilizacao'
  | 'busola'
  | 'voz'
  | 'dados'
  | 'nuvem'
  | 'conta'
  | 'seguranca'
  | 'app';

export type SettingsSectionDef = {
  id: SettingsSectionId;
  /** Chave de tradução do rótulo da secção. */
  labelKey: string;
  /** Emoji do índice. */
  icon: string;
};

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  { id: 'aparencia', labelKey: 'set_section_appearance', icon: '🎨' },
  { id: 'utilizacao', labelKey: 'set_section_usage', icon: '🧰' },
  { id: 'busola', labelKey: 'set_section_compass', icon: '🧭' },
  { id: 'voz', labelKey: 'set_section_voice', icon: '🔊' },
  { id: 'dados', labelKey: 'set_section_data', icon: '💾' },
  { id: 'nuvem', labelKey: 'set_section_cloud', icon: '☁️' },
  { id: 'conta', labelKey: 'set_section_account', icon: '🆔' },
  { id: 'seguranca', labelKey: 'set_section_security', icon: '🔐' },
  { id: 'app', labelKey: 'set_section_app', icon: '📦' },
];

export const SECTION_IDS = SETTINGS_SECTIONS.map(s => s.id);
