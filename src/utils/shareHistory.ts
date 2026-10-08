import type { LiveShareHistoryRow } from '../services/cloud';

/**
 * O que o histórico de partilhas (#100) precisa saber de uma linha, em puro.
 *
 * A pergunta de campo é sempre a mesma: "aquele link que mandei, quando
 * começou, quando acabou e quanto durou?". As três respostas saem dos três
 * carimbos que a linha já tem — `started_at`, `stopped_at` e `expires_at` — e
 * nenhuma delas depende de rede, de storage nem de React, para que os casos
 * de borda (sessão a decorrer, parada, expirada sem nunca ser parada,
 * timestamps tortos) sejam testáveis sem um aparelho.
 */
export type ShareState = 'running' | 'stopped' | 'expired';

/**
 * Quando a sessão acabou, em epoch ms.
 *
 * `stopped_at` quando a pessoa parou; senão o prazo, que é quando a sessão
 * acabou sem ninguém dizer nada. Com as duas ausentes, o próprio `now` — uma
 * linha em criação não tem fim, e o fim dela é agora.
 */
export const shareEndMs = (row: LiveShareHistoryRow, now: number): number => {
  const stopped = row.stopped_at ? Date.parse(row.stopped_at) : null;
  if (stopped !== null && !Number.isNaN(stopped)) return stopped;
  const expires = Date.parse(row.expires_at);
  if (!Number.isNaN(expires)) return Math.min(now, expires);
  return now;
};

/** Duração da sessão em ms, nunca negativa. */
export const shareDurationMs = (row: LiveShareHistoryRow, now: number): number =>
  Math.max(0, shareEndMs(row, now) - Date.parse(row.started_at));

/**
 * Estado de uma linha agora.
 *
 * Parada ganha ao expirada: uma sessão que a pessoa parou aos 10 minutos e
 * cujo prazo de 30 venceu depois continua parada, e dizer "expirou" seria
 * mentira sobre a decisão dela.
 */
export const shareState = (row: LiveShareHistoryRow, now: number): ShareState => {
  if (row.stopped_at) return 'stopped';
  return Date.parse(row.expires_at) <= now ? 'expired' : 'running';
};

/**
 * "45 s", "12 min", "1 h 25 min", "3 h".
 *
 * Minutos cheios viram "h" quando são horas inteiras, para o chip não ficar
 * largo; o resto leva as duas partes só quando há horas — "1 h 05 min" é
 * ruído, "1 h 25 min" é informação.
 */
export const shareDurationLabel = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total} s`;
  const minutos = Math.round(total / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
};

/** "14/10 21:04" — o formato do `CloudSection`, para as duas datas concordarem. */
export const shareWhenLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
};
