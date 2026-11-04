/**
 * Regras do beacon de emergência (ideia #6).
 *
 * O beacon é a posição enviada por SMS a um contacto guardado, de tempos a
 * tempos, para quem está a andar fora de rede. Não depende de internet: o
 * SMS sai pela rede da operadora, mesmo sem dados.
 *
 * Aqui fica só a lógica — intervalos, "está na hora?" e o texto da mensagem —
 * para ser testável sem telemóvel e sem SMS.
 */

/** Intervalos que o utilizador pode escolher, em minutos. */
export const BEACON_INTERVAL_OPTIONS = [5, 10, 15, 30, 60] as const;

export const DEFAULT_BEACON_INTERVAL_MINUTES = 30;

/** Intervalo aceite: o mais próximo da lista. */
export const clampBeaconInterval = (minutes: number): number => {
  if (!Number.isFinite(minutes)) return DEFAULT_BEACON_INTERVAL_MINUTES;
  const target = Math.round(minutes);
  return BEACON_INTERVAL_OPTIONS.reduce((best, option) =>
    Math.abs(option - target) < Math.abs(best - target) ? option : best,
  );
};

/**
 * O beacon está na hora?
 *
 * Sem envio registado (`lastSentAt` nulo) vence logo: quem liga o beacon
 * quer o primeiro aviso quanto antes.
 */
export const isBeaconDue = (
  lastSentAt: number | null,
  intervalMinutes: number,
  now: number,
): boolean => {
  if (lastSentAt == null || !Number.isFinite(lastSentAt)) return true;
  if (!Number.isFinite(now) || now < lastSentAt) return false;
  const intervalMs = clampBeaconInterval(intervalMinutes) * 60_000;
  return now - lastSentAt >= intervalMs;
};

/** Número de telefone normalizado: só dígitos, com `+` à frente se houver. */
export const normalizePhone = (raw: string): string => {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/\D/g, '');
};

/** Um número é plausível para SMS? (6 a 15 dígitos, como o E.164 permite) */
export const isValidPhone = (raw: string): boolean => {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
};

export type BeaconMessageParams = {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  altitude?: number | null;
  battery?: number | null;
  network?: string | null;
  time?: Date;
};

/**
 * Texto do beacon: coordenadas, precisão, altitude, bateria e rede.
 *
 * O mapa vem como link para não precisar de escrever coordenadas à mão num
 * telemóvel com o ecrã partido — que é o caso em que o SOS importa.
 */
export const buildBeaconMessage = (params: BeaconMessageParams): string => {
  const time = params.time ?? new Date();
  const lat = params.latitude != null ? params.latitude.toFixed(6) : '?';
  const lon = params.longitude != null ? params.longitude.toFixed(6) : '?';
  const acc = params.accuracy != null ? Math.round(params.accuracy) : '?';
  const alt = params.altitude != null ? Math.round(params.altitude) : '?';
  const bat = params.battery != null ? Math.round(params.battery) : '?';
  const net = params.network || '?';
  const hasCoord = params.latitude != null && params.longitude != null;
  const maps = hasCoord
    ? `https://maps.google.com/?q=${params.latitude},${params.longitude}`
    : '';
  return (
    `SOS BEACON Bussola\n${time.toISOString()}\n` +
    `Lat:${lat} Lon:${lon} acc:${acc}m alt:${alt}m\n` +
    `Bateria:${bat}% Rede:${net}\n${maps}`
  ).trim();
};
