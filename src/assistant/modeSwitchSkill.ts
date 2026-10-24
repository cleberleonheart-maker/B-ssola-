import type { Skill } from './types';
import type { DisplayMode } from '../services/preferencesService';

const MAP: Array<[RegExp, DisplayMode]> = [
  [/metal|detector/i, 'metal'],
  [/bússola|compass/i, 'compass'],
  [/sol|sun/i, 'sun'],
  [/vento|wind/i, 'wind'],
  [/emf/i, 'emf'],
  [/trilha|track/i, 'track'],
  [/mapa|map/i, 'map'],
  [/altura|height/i, 'height'],
  [/teod/i, 'theodolite'],
  [/nivel|level/i, 'level'],
  [/ar|vis[aã]o/i, 'ar'],
  [/c[aâ]mera|camera/i, 'camera'],
  [/carro|meu carro/i, 'car'],
  [/triang/i, 'tri'],
  [/od[oô]metro|odometro/i, 'odometer'],
  [/cad[eê]ncia|passo|metr[oô]nomo/i, 'cadence'],
  [/anota|nota|caderneta/i, 'notes'],
];

export const modeSwitchSkill: Skill = {
  id: 'modeSwitch',
  name: 'Mudar modo',
  intents: ['mode', 'switch', 'open', 'mudar', 'abre', 'troca'],
  patterns: [
    'abre o ...',
    'abrir o ...',
    'muda para ...',
    'mude para ...',
    'troca para ...',
    'troque para ...',
    'vai para ...',
    'coloca no ...',
    'modo ...',
    'ativar modo ...',
  ],
  run: async (ctx, query) => {
    const q = (query || ctx.text || '').toLowerCase();
    for (const [re, mode] of MAP) {
      if (re.test(q)) {
        ctx.setDisplayMode?.(mode);
        return { text: `Abrindo modo ${mode}.` };
      }
    }
    return { text: 'Não identifiquei o modo.' };
  },
};
