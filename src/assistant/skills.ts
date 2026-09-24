import type { Translator } from '../i18n/strings';
import { matches } from './matcher';
import { normalizeText } from './normalizer';
import { evalArithmetic } from './math';
import { cardinalOf, formatCoord } from '../utils/compass';
import { haversine, initialBearing, formatDistance } from '../utils/geo';
import { toDMS, toUTM, formatUTM } from '../utils/coords';
import type { DisplayMode } from '../services/preferencesService';
import { getTotals } from '../services/odometerService';
import { loadTracks, type RecordedTrack } from '../services/trackService';
import type { AssistantAction, AssistantContextData } from './types';

export type SkillOutput =
  | string
  | { text: string; action: AssistantAction }
  | null;

export type Skill = {
  id: string;
  patterns: string[];
  run: (
    ctx: AssistantContextData,
    normalized: string,
    tokens: string[],
    wildcards: string[],
    t: Translator,
  ) => SkillOutput | Promise<SkillOutput>;
};

const nowTime = (): string => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const nowDate = (t: Translator): string => {
  const d = new Date();
  try {
    const locale = t('util_locale') as string;
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return d.toDateString();
  }
};

const findWaypoint = (
  ctx: AssistantContextData,
  phrase: string,
) => {
  const target = phrase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!target) {
    return null;
  }
  for (const wp of ctx.waypoints) {
    const name = wp.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (name.includes(target) || target.includes(name)) {
      return wp;
    }
  }
  return null;
};

const pick = (list: string[]): string => list[Math.floor(Math.random() * list.length)];

const capitalizeName = (phrase: string): string => {
  const cleaned = phrase.trim().replace(/[.,;!?]+$/, '');
  if (!cleaned) {
    return cleaned;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const waypointVoiceSkill: Skill = {
  id: 'waypoint_voice',
  patterns: [
    'marca este ponto como ...',
    'marque este ponto como ...',
    'marcar este ponto como ...',
    'salva este ponto como ...',
    'salve este ponto como ...',
    'salvar este ponto como ...',
    'guarda este ponto como ...',
    'guarde este ponto como ...',
    'registra este ponto como ...',
    'marca um ponto como ...',
    'salva um ponto como ...',
    'marca aqui como ...',
    'marca este ponto',
    'marque este ponto',
    'marca um ponto',
    'salva este ponto',
    'guarda este ponto',
    'marca un punto como ...',
    'guarda este punto como ...',
    'guardar este punto como ...',
    'mark this point as ...',
    'save this point as ...',
    'registra este punto como ...',
  ],
  run: (ctx, _n, _tokens, wildcards, t) => {
    if (ctx.latitude == null || ctx.longitude == null) {
      return t('as_wp_voz_waiting');
    }
    const captured = wildcards[wildcards.length - 1] || '';
    const name = captured.trim()
      ? capitalizeName(captured)
      : t('as_wp_voz_default');
    return {
      text: t('as_wp_voz_added', { name }),
      action: { type: 'addWaypoint', name },
    };
  },
};

const longestTrackOf = (
  tracks: RecordedTrack[],
): RecordedTrack | null => {
  if (tracks.length === 0) return null;
  return tracks.reduce<RecordedTrack | null>(
    (best, track) =>
      best === null || track.distance > best.distance ? track : best,
    null,
  );
};

const trackHistorySkill: Skill = {
  id: 'track_history',
  patterns: [
    'quanto andei hoje',
    'quanto eu andei hoje',
    'quanto caminhei hoje',
    'quanto andei ontem',
    'quanto eu andei ontem',
    'quanto caminhei ontem',
    'quanto andei esta semana',
    'quanto andei essa semana',
    'quanto andei na semana',
    'quanto eu andei esta semana',
    'quanto andei nesta semana',
    'quanto caminhei esta semana',
    '* andei * semana',
    '* caminhei * semana',
    'qual * trilha mais longa',
    'qual * trilha * grande',
    'a trilha mais longa',
    '* mais longa',
    'quantas trilhas *',
    'quantas rotas *',
    '* trilhas salvas',
    '* rotas salvas',
    'how much did i walk today',
    'how far did i walk today',
    'how much did i walk this week',
    'which * longest track',
    'longest track',
    'how many tracks *',
    'cuanto camine hoy',
    'cuanto anduve hoy',
    'cuanto camine esta semana',
    'cuanto anduve esta semana',
    'cual * ruta mas larga',
    'cuantas rutas *',
  ],
  run: async (_ctx, normalized, _tokens, _wildcards, t) => {
    const totals = await getTotals();

    if (/hoje|today|hoy/.test(normalized) && !/semana|week/.test(normalized)) {
      return totals.today > 0
        ? t('as_hist_today', { d: formatDistance(totals.today) })
        : t('as_hist_today_zero');
    }

    if (/ontem|yesterday|ayer/.test(normalized)) {
      const yesterday = totals.lastDays[1]?.meters ?? 0;
      return yesterday > 0
        ? t('as_hist_yesterday', { d: formatDistance(yesterday) })
        : t('as_hist_yesterday_zero');
    }

    if (/semana|week/.test(normalized)) {
      return totals.week > 0
        ? t('as_hist_week', { d: formatDistance(totals.week) })
        : t('as_hist_week_zero');
    }

    const tracks = await loadTracks();

    if (/mais longa|mas larga|longest|la mas larga/.test(normalized)) {
      const longest = longestTrackOf(tracks);
      return longest
        ? t('as_hist_longest', {
            name: longest.name,
            d: formatDistance(longest.distance),
          })
        : t('as_hist_no_tracks');
    }

    if (/quantas trilhas|quantas rotas|how many tracks|cuantas rutas/.test(normalized)) {
      if (tracks.length === 0) {
        return t('as_hist_no_tracks');
      }
      const total = tracks.reduce((acc, track) => acc + track.distance, 0);
      return t('as_hist_tracks', {
        count: tracks.length,
        d: formatDistance(total),
      });
    }

    return null;
  },
};

const jokeSkill: Skill = {
  id: 'joke',
  patterns: [
    'conte * piada',
    '* uma piada',
    'me faz rir',
    'conta * piada',
    '* piada',
    'algo engracado',
  ],
  run: (_ctx, _n, _tokens, _wildcards, t) =>
    pick([t('as_joke_1'), t('as_joke_2'), t('as_joke_3')]),
};

const headingSkill: Skill = {
  id: 'heading',
  patterns: [
    'para onde * bussola * aponta',
    'qual * rumo',
    'qual * direcao',
    'para onde eu * * indo',
    'onde * norte',
    'qual * orientacao',
    '* bussola aponta * norte',
    '* rumo atual',
  ],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    if (ctx.heading == null) {
      return t('as_heading_waiting');
    }
    const card = ctx.cardinal || cardinalOf(ctx.heading).full;
    const real = ctx.heading;
    const decl =
      ctx.declinationEnabled && ctx.declination !== 0
        ? t('as_heading_decl', { deg: Math.round(ctx.declination) })
        : '';
    return t('as_heading_now', {
      deg: Math.round(real),
      card,
    }) + decl;
  },
};

const locationSkill: Skill = {
  id: 'location',
  patterns: [
    'onde eu estou',
    'qual * minha localizacao',
    'qual * localizacao',
    'minhas coordenadas',
    'qual * latitude',
    'qual * longitude',
    'coordenadas atuais',
    'onde estou agora',
  ],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    if (ctx.latitude == null || ctx.longitude == null) {
      return t('as_location_waiting');
    }
    const parts = [
      t('as_loc_lat', { v: formatCoord(ctx.latitude, true) }),
      t('as_loc_lon', { v: formatCoord(ctx.longitude, false) }),
    ];
    if (ctx.accuracy != null) {
      parts.push(t('as_loc_acc', { v: Math.round(ctx.accuracy) }));
    }
    return t('as_location_now', { parts: parts.join(', ') });
  },
};

const pressureSkill: Skill = {
  id: 'pressure',
  patterns: [
    'qual * pressao',
    '* pressao atmosferica',
    '* pressao barometrica',
    '* barometro',
    '* pressao atual',
  ],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    if (!ctx.baroAvailable) {
      return t('as_pressure_unavailable');
    }
    if (ctx.pressure == null) {
      return t('as_pressure_waiting');
    }
    return t('as_pressure_now', { hpa: Math.round(ctx.pressure) });
  },
};

const altitudeSkill: Skill = {
  id: 'altitude',
  patterns: [
    'qual * altitude',
    '* altitude atual',
    '* altitude barometrica',
    'quanto de altitude * estou',
    '* altitude estou',
    'estou a que altitude',
  ],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    if (ctx.altitude != null) {
      return t('as_altitude_gps', { m: Math.round(ctx.altitude) });
    }
    if (ctx.baroAvailable && ctx.pressure != null) {
      return t('as_altitude_baro');
    }
    return t('as_altitude_none');
  },
};

const coordsDmsSkill: Skill = {
  id: 'coords_dms',
  patterns: [
    'coordenadas * graus minutos segundos',
    'coordenadas em dms',
    'coordenadas dms',
    'coordenadas em graus',
    '* em graus minutos e segundos',
    'coordenadas sexagesimais',
  ],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    if (ctx.latitude == null || ctx.longitude == null) {
      return t('as_location_waiting');
    }
    return t('as_coords_dms', {
      lat: toDMS(ctx.latitude, true),
      lon: toDMS(ctx.longitude, false),
    });
  },
};

const coordsUtmSkill: Skill = {
  id: 'coords_utm',
  patterns: [
    'coordenadas em utm',
    'coordenadas utm',
    'em utm',
    'coordenada utm',
  ],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    if (ctx.latitude == null || ctx.longitude == null) {
      return t('as_location_waiting');
    }
    const utm = toUTM(ctx.latitude, ctx.longitude);
    if (!utm) {
      return t('as_utm_unavailable');
    }
    return t('as_coords_utm', {
      utm: formatUTM(utm),
    });
  },
};

const declinationSkill: Skill = {
  id: 'declination',
  patterns: ['qual * declinacao', '* declinacao magnetica', '* declinacao atual'],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    if (ctx.declinationEnabled) {
      return t('as_decl_on', { deg: Math.round(ctx.declination) });
    }
    return t('as_decl_off');
  },
};

const waypointsSkill: Skill = {
  id: 'waypoints',
  patterns: [
    'quais * meus pontos',
    'quais * meus waypoints',
    'quais * pontos * referencia',
    'lista * pontos',
    'lista * waypoints',
    'meus pontos * referencia',
    'quantos pontos',
    'quantos waypoints',
    '* pontos salvos',
  ],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    if (ctx.waypoints.length === 0) {
      return t('as_wp_none');
    }
    const names = ctx.waypoints
      .map(wp => `${wp.name} (${wp.distance != null ? formatDistance(wp.distance) : t('as_wp_no_gps')})`)
      .slice(0, 8)
      .join('; ');
    return t('as_wp_count', {
      count: ctx.waypoints.length,
      names,
    });
  },
};

const waypointDistanceSkill: Skill = {
  id: 'waypoint_distance',
  patterns: [
    'qual * distancia ate ...',
    'distancia ate ...',
    'quanto falta para ...',
    'rumo ate ...',
    'como chegar ate ...',
    'como chegar em ...',
    '* distancia * ...',
    'que distancia * ...',
    'perto de ...',
  ],
  run: (ctx, _n, _tokens, wildcards, t) => {
    if (ctx.waypoints.length === 0) {
      return t('as_wp_none');
    }
    if (ctx.latitude == null || ctx.longitude == null) {
      return t('as_wp_no_gps');
    }
    const phrase = wildcards[wildcards.length - 1] || '';
    const wp = findWaypoint(ctx, phrase);
    if (!wp) {
      return t('as_wp_not_found', { phrase });
    }
    const distance = wp.distance != null ? wp.distance : haversine(ctx.latitude, ctx.longitude, wp.latitude, wp.longitude);
    const bearing = wp.bearing != null ? wp.bearing : initialBearing(ctx.latitude, ctx.longitude, wp.latitude, wp.longitude);
    return t('as_wp_distance', {
      name: wp.name,
      distance: formatDistance(distance),
      deg: Math.round(bearing),
    });
  },
};

const odometerSkill: Skill = {
  id: 'odometer',
  patterns: ['qual * odometro', 'quanto eu andei', '* distancia percorrida'],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    if (ctx.odometer > 0) {
      return t('as_odo', { distance: formatDistance(ctx.odometer) });
    }
    return t('as_odo_zero');
  },
};

const speedSkill: Skill = {
  id: 'speed',
  patterns: [
    'qual * minha velocidade',
    'qual * velocidade',
    'minha velocidade',
    '* velocidade atual',
    '* velocidade do gps',
    '* velocidade do gps',
    'quao rapido',
    'how fast',
    'what * my speed',
    'my speed',
    'mi velocidad',
    'a que velocidad',
    'a que velocidad voy',
  ],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    if (ctx.speed == null || !isFinite(ctx.speed)) {
      return t('as_speed_none');
    }
    return t('as_speed_now', {
      kmh: Math.round(ctx.speed * 3.6),
    });
  },
};

const MODE_ALIASES: { mode: DisplayMode; terms: string[] }[] = [
  {
    mode: 'compass',
    terms: ['bussola', 'compass', 'brujula', 'compas', 'bússola'],
  },
  {
    mode: 'level',
    terms: ['nivel', 'level', 'nivel de bolha', 'nivel bolha', 'bolha'],
  },
  {
    mode: 'ar',
    terms: ['realidade aumentada', 'ar', 'augmented reality'],
  },
  {
    mode: 'camera',
    terms: ['visao', 'vision', 'camara', 'camera', 'câmera'],
  },
  {
    mode: 'metal',
    terms: [
      'detector de metais',
      'detector de metal',
      'detector',
      'metal detector',
      'metal',
      'deteccion de metales',
    ],
  },
  {
    mode: 'theodolite',
    terms: ['teodolito', 'theodolite', 'teodolite'],
  },
  {
    mode: 'emf',
    terms: ['emf', 'campo eletromagnetico', 'campo electromagnetico'],
  },
  {
    mode: 'sun',
    terms: ['relogio de sol', 'reloj de sol', 'sun watch', 'sol', 'sun'],
  },
  {
    mode: 'wind',
    terms: ['indice de vento', 'indice do vento', 'vento', 'wind'],
  },
  {
    mode: 'track',
    terms: ['trilha', 'track', 'rota', 'ruta', 'gravar trilha'],
  },
  {
    mode: 'notes',
    terms: ['caderneta de campo', 'caderneta', 'fieldbook', 'libreta', 'anotacoes', 'field notes'],
  },
  {
    mode: 'odometer',
    terms: ['odometro', 'odometer', 'odómetro', 'historico de distancia', 'distancia por dia'],
  },
];

const MODE_ARTICLES = new Set([
  'o',
  'a',
  'os',
  'as',
  'um',
  'uma',
  'uns',
  'umas',
  'no',
  'na',
  'nos',
  'nas',
  'do',
  'da',
  'dos',
  'das',
  'para',
  'pro',
  'pra',
]);

const normalizePhrase = (phrase: string): string[] =>
  normalizeText(phrase)
    .split(' ')
    .filter(Boolean);

const findModeFromTokens = (tokens: string[]): DisplayMode | null => {
  const words = MODE_ARTICLES.has(tokens[0]) ? tokens.slice(1) : tokens;
  for (const { mode, terms } of MODE_ALIASES) {
    for (const term of terms) {
      const tt = term.split(' ');
      for (let i = 0; i + tt.length <= words.length; i += 1) {
        let ok = true;
        for (let j = 0; j < tt.length; j += 1) {
          if (words[i + j] !== tt[j]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          return mode;
        }
      }
    }
  }
  return null;
};

const switchModeSkill: Skill = {
  id: 'switch_mode',
  patterns: [
    'muda para ...',
    'muda pra ...',
    'mude para ...',
    'mude pra ...',
    'mudar para ...',
    'troca para ...',
    'troca pra ...',
    'troque para ...',
    'vai para ...',
    'vai pra ...',
    'va para ...',
    'vai pro ...',
    'abre ...',
    'abra ...',
    'abrir ...',
    'abre o ...',
    'abra o ...',
    'ativa ...',
    'ative ...',
    'ativar ...',
    'ativa o modo ...',
    'ative o modo ...',
    'muda o modo para ...',
    'mude o modo para ...',
    'coloca no modo ...',
    'coloque no modo ...',
    'deixa no modo ...',
    'deixe no modo ...',
    'deixa o app no modo ...',
    'quero usar ...',
    'quero o modo ...',
    'modo ...',
  ],
  run: (ctx, _n, _tokens, wildcards, t) => {
    const phrase = wildcards[wildcards.length - 1] || '';
    const mode = findModeFromTokens(normalizePhrase(phrase));
    if (!mode) {
      return null;
    }
    const label = t(`ui_mode_${mode}`);
    if (ctx.displayMode === mode) {
      return t('as_mode_switch_same', { mode: label });
    }
    return {
      text: t('as_mode_switch_done', { mode: label }),
      action: { type: 'setMode', mode },
    };
  },
};

const modeSkill: Skill = {
  id: 'mode',
  patterns: [
    'qual * modo * ativo',
    'qual * modo atual',
    'qual * modo',
    'em qual modo',
    '* modo ativo',
    'que modo esta ativo',
    'which mode',
    'what mode',
    'que modo',
    'en que modo',
    'modo actual',
    'modo atual',
  ],
  run: (ctx, _n, _tokens, _wildcards, t) => {
    const label = ctx.displayMode ? t(`ui_mode_${ctx.displayMode}`) : '';
    return t('as_mode_now', { mode: label || ctx.displayMode || '—' });
  },
};

const timeSkill: Skill = {
  id: 'time',
  patterns: ['que horas sao', 'que horas * agora', 'que hora sao', '* horas agora', 'que horas'],
  run: (_ctx, _n, _tokens, _wildcards, t) => t('as_time', { time: nowTime() }),
};

const dateSkill: Skill = {
  id: 'date',
  patterns: [
    'que dia e hoje',
    'qual * data de hoje',
    'qual * data hoje',
    'que dia e',
    '* data atual',
    'que dia estamos',
  ],
  run: (_ctx, _n, _tokens, _wildcards, t) => t('as_date', { date: nowDate(t) }),
};

const mathSkill: Skill = {
  id: 'math',
  patterns: [
    'quanto e ...',
    'quanto da ...',
    'quanto faz ...',
    'quanto * ...',
    'calcule ...',
    'calcula ...',
  ],
  run: (_ctx, _normalized, tokens, wildcards, t) => {
    const full = tokens.join(' ');
    const m = full.match(/quanto (?:e|da|faz) (.+)$/);
    const c = full.match(/calcul[ae] (.+)$/);
    const fallback = wildcards.length > 0 ? wildcards[wildcards.length - 1] : '';
    const exprRaw = m ? m[1] : c ? c[1] : fallback;
    if (exprRaw == null || !exprRaw.trim()) {
      return null;
    }
    const expr = exprRaw
      .replace(/ mais /g, ' + ')
      .replace(/ menos /g, ' - ')
      .replace(/ vezes /g, ' * ')
      .replace(/ dividido por /g, ' / ')
      .replace(/ x /g, ' * ');
    const result = evalArithmetic(expr);
    if (result == null) {
      return t('as_math_unknown');
    }
    return t('as_math_result', { expr, result });
  },
};

const greetingSkill: Skill = {
  id: 'greeting',
  patterns: ['oi', 'ola', 'opa', 'e ai', 'ei', 'bom dia', 'boa tarde', 'boa noite', 'salve', 'ola kefera', 'oi kefera'],
  run: (_ctx, _n, _tokens, _wildcards, t) => {
    const h = new Date().getHours();
    const part = h < 6 ? t('as_greeting_dawn') : h < 12 ? t('as_greeting_morning') : h < 18 ? t('as_greeting_afternoon') : t('as_greeting_night');
    return t('as_greeting_part', { part });
  },
};

const identitySkill: Skill = {
  id: 'identity',
  patterns: [
    'qual * seu nome',
    'como voce se chama',
    'o que e voce',
    'voce e uma ia',
    'voce e inteligente',
    'que nome voce tem',
    'como te chamam',
  ],
  run: (_ctx, _n, _tokens, _wildcards, t) => t('as_identity'),
};

const originSkill: Skill = {
  id: 'origin',
  patterns: [
    'quem e voce',
    'quem e a kefera',
    'como voce nasceu',
    'como foi que voce nasceu',
    'qual * sua historia',
    'qual * sua origem',
    'de onde voce veio',
    'quem te criou',
    'como voce surgiu',
    'sua historia de origem',
  ],
  run: (_ctx, _n, _tokens, _wildcards, t) => t('as_origin_story'),
};

const helpSkill: Skill = {
  id: 'help',
  patterns: [
    'ajuda',
    'help',
    'o que voce sabe',
    'o que voce pode fazer',
    'quais * comandos',
    'como eu te uso',
    'para que voce serve',
    'me ajuda',
    'comandos disponiveis',
  ],
  run: (_ctx, _n, _tokens, _wildcards, t) => t('as_help'),
};

const thanksSkill: Skill = {
  id: 'thanks',
  patterns: ['obrigado', 'obrigada', 'valeu', 'muito obrigado', 'muito obrigada', 'agradecido'],
  run: (_ctx, _n, _tokens, _wildcards, t) =>
    pick([t('as_thanks_1'), t('as_thanks_2'), t('as_thanks_3')]),
};

const byeSkill: Skill = {
  id: 'bye',
  patterns: ['tchau', 'adeus', 'ate logo', 'vou indo', 'ate mais', 'falou'],
  run: (_ctx, _n, _tokens, _wildcards, t) =>
    pick([t('as_bye_1'), t('as_bye_2'), t('as_bye_3')]),
};

const howAreYouSkill: Skill = {
  id: 'how_are_you',
  patterns: ['como voce esta', 'como vai voce', 'tudo bem', 'como esta a kefera', 'voce esta bem'],
  run: (_ctx, _n, _tokens, _wildcards, t) => t('as_how_are_you'),
};

const complimentSkill: Skill = {
  id: 'compliment',
  patterns: ['voce e demais', 'te amo kefera', 'amo voce', 'voce e incrivel', 'muito legal'],
  run: (_ctx, _n, _tokens, _wildcards, t) =>
    pick([t('as_compliment_1'), t('as_compliment_2'), t('as_compliment_3')]),
};

const skills: Skill[] = [
  greetingSkill,
  identitySkill,
  originSkill,
  helpSkill,
  headingSkill,
  locationSkill,
  coordsDmsSkill,
  coordsUtmSkill,
  pressureSkill,
  altitudeSkill,
  declinationSkill,
  waypointVoiceSkill,
  trackHistorySkill,
  waypointsSkill,
  waypointDistanceSkill,
  odometerSkill,
  speedSkill,
  switchModeSkill,
  modeSkill,
  timeSkill,
  dateSkill,
  mathSkill,
  jokeSkill,
  thanksSkill,
  byeSkill,
  howAreYouSkill,
  complimentSkill,
];

export const runSkills = async (
  ctx: AssistantContextData,
  normalized: string,
  tokens: string[],
  t: Translator,
): Promise<SkillOutput> => {
  for (const skill of skills) {
    for (const pattern of skill.patterns) {
      const result = matches(pattern, normalized, tokens);
      if (result.matched) {
        const output = await skill.run(ctx, normalized, tokens, result.wildcards, t);
        if (output != null) {
          return output;
        }
        continue;
      }
    }
  }
  return null;
};