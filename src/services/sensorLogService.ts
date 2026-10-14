/**
 * Log curto dos sensores (ideia #63).
 *
 * Um relato de bug vale o que valer o contexto que o acompanha. "A bússola
 * travou" não diz nada; "a bússola travou e neste minuto o magnetómetro estava
 * aos saltos e o heading ficou parado" diz quase tudo. Isto guarda esse minuto.
 *
 * Só em memória, e só o último minuto: o caso de uso é relatar um problema que
 * acabou de acontecer, com a app ainda viva. Não persiste porque um buffer de
 * sensores no disco é mais uma coisa a vazar do que uma coisa a guardar, e o
 * momento do crash não é recuperável por definição (o processo morre com ele).
 *
 * **Sem coordenadas, de propósito** — a ideia diz "pode filtrar coordenadas" e
 * a resposta é que as coordenadas nem chegam aqui. Guardam-se os valores brutos
 * de aceleração e magnetómetro, o heading, e a *qualidade* do GPS (precisão e
 * velocidade), que é o que reproduz "o GPS estava a perder fixe" sem dizer onde
 * a pessoa estava. Um relatório de bug não precisa de saber o endereço.
 */

export type SensorSample = {
  t: number;
  ax: number;
  ay: number;
  az: number;
  mx: number;
  my: number;
  mz: number;
  h: number | null;
  /** Precisão do GPS em metros, ou o último valor conhecido. Nunca lat/lon. */
  acc: number | null;
  /** Velocidade em m/s. */
  spd: number | null;
};

const MAX_AGE_MS = 60000;
const MIN_INTERVAL_MS = 1000;

let samples: SensorSample[] = [];
let lastSample = 0;
let lastFix: { acc: number | null; spd: number | null } = { acc: null, spd: null };

const round1 = (n: number): number => Math.round(n * 10) / 10;

const finiteOr = (n: number | null | undefined, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : fallback;

/** A qualidade do GPS é atualizada à parte, no callback da localização. */
export const updateFixQuality = (
  accuracy: number | null | undefined,
  speed: number | null | undefined,
): void => {
  lastFix = {
    acc: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : lastFix.acc,
    spd: typeof speed === 'number' && Number.isFinite(speed) ? speed : lastFix.spd,
  };
};

/**
 * Guarda uma amostra de movimento, no ritmo de 1/s. O `lastSample` faz o
 * throttle: o acelerómetro chega a 5 Hz, e 60 s disso seriam 300 linhas para
 * dizer o que 60 dizem.
 */
export const recordMotionSample = (
  motion: {
    ax: number;
    ay: number;
    az: number;
    mx: number;
    my: number;
    mz: number;
    heading: number | null;
  },
  now: number = Date.now(),
): void => {
  if (now - lastSample < MIN_INTERVAL_MS) return;
  lastSample = now;
  samples = [
    ...samples.filter(s => now - s.t <= MAX_AGE_MS),
    {
      t: now,
      ax: round1(finiteOr(motion.ax, 0)),
      ay: round1(finiteOr(motion.ay, 0)),
      az: round1(finiteOr(motion.az, 0)),
      mx: round1(finiteOr(motion.mx, 0)),
      my: round1(finiteOr(motion.my, 0)),
      mz: round1(finiteOr(motion.mz, 0)),
      h:
        motion.heading != null && Number.isFinite(motion.heading)
          ? Math.round(motion.heading)
          : null,
      acc: lastFix.acc != null ? Math.round(lastFix.acc) : null,
      spd: lastFix.spd != null ? round1(lastFix.spd) : null,
    },
  ];
};

/**
 * O log em texto, pronto a anexar. CSV com um cabeçalho legível: quem lê o
 * relatório não tem de ter a app para o interpretar. Devolve `null` quando não
 * há nada — melhor um relato sem log do que um log a fingir de dados.
 */
export const sensorLogText = (): string | null => {
  if (samples.length === 0) return null;
  const t0 = samples[0].t;
  const linhas = samples.map(s => {
    const dt = ((s.t - t0) / 1000).toFixed(1);
    return [
      dt,
      s.ax,
      s.ay,
      s.az,
      s.mx,
      s.my,
      s.mz,
      s.h ?? '',
      s.acc ?? '',
      s.spd ?? '',
    ].join(',');
  });
  const span = ((samples[samples.length - 1].t - t0) / 1000).toFixed(0);
  return [
    '# sensorlog v1 — sem coordenadas (ax,ay,az m/s2 | mx,my,mz uT | h graus | acc m | spd m/s)',
    `# inicio ${new Date(t0).toISOString()} · ${samples.length} amostras · ${span}s`,
    'dt,ax,ay,az,mx,my,mz,h,acc,spd',
    ...linhas,
  ].join('\n');
};

/** Só para os testes. */
export const clearSensorLog = (): void => {
  samples = [];
  lastSample = 0;
  lastFix = { acc: null, spd: null };
};

/** Quantas amostras estão no buffer (o relatório mostra isto). */
export const sensorSampleCount = (): number => samples.length;
