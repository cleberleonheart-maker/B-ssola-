import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Histórico de pressão do barómetro (ideias #64 e #104).
 *
 * O `BarometerPanel` guardava isto sozinho, e por isso o histórico só existia
 * enquanto o painel estava montado — ou seja, só no modo Completo com os
 * painéis à vista. A ideia #104 quer o contrário: o caso de uso é a queda de
 * pressão que acontece enquanto ninguém está a olhar (dentro da tenda, à
 * noite), e um histórico que só cresce quando o painel está à frente não serve.
 *
 * Por isso a coleta saiu do painel para aqui. Quem observa o barómetro é o
 * `CompassScreen`, que já o faz globalmente; ele alimenta este módulo com cada
 * leitura e o painel passa a ser só mais um assinante. O estado é de módulo,
 * como o `muted` do `voice.ts`: uma série, uma persistência, e todos a lêem a
 * mesma — sem duas cópias a divergir no mesmo `AsyncStorage`.
 */

export const HISTORY_KEY = '@bussola/baroHistory';
const SAMPLE_INTERVAL_MS = 10000;
const SAVE_INTERVAL_MS = 90000;
const LIVE_MAX = 120;
const PERSIST_MAX = 140;
const STALE_MS = 30 * 60 * 1000;

export type BaroEntry = { ts: number; p: number };

let entries: BaroEntry[] = [];
let loaded = false;
let lastSample = 0;
let lastSave = 0;
const listeners = new Set<(series: BaroEntry[]) => void>();

const snapshot = (): BaroEntry[] => entries.slice();

const notify = (): void => {
  const snap = snapshot();
  for (const listener of listeners) {
    listener(snap);
  }
};

const isEntry = (e: unknown): e is BaroEntry => {
  const v = e as BaroEntry | null;
  return !!v && typeof v.ts === 'number' && typeof v.p === 'number';
};

/** Avisa sempre que a série muda, e uma vez logo à cabeça com o que já existe. */
export const subscribePressureHistory = (
  listener: (series: BaroEntry[]) => void,
): (() => void) => {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Lê o que ficou gravado. Corre uma vez; o painel e o alarme partilham esta
 * leitura, e as amostras já coletadas nesta sessão são preservadas por cima do
 * que vem do disco (a leitura pode resolver depois da primeira amostra).
 */
export const loadPressureHistory = async (): Promise<void> => {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return;
    const stored = arr.filter(isEntry).slice(-PERSIST_MAX);
    const now = Date.now();
    const fresh = stored.filter(e => now - e.ts < STALE_MS).slice(-LIVE_MAX);
    entries = [...fresh, ...entries]
      .filter((e, i, merged) => merged.findIndex(x => x.ts === e.ts) === i)
      .sort((a, b) => a.ts - b.ts)
      .slice(-LIVE_MAX);
    notify();
  } catch {
    // Dado corrompido não pode impedir a app de arrancar com um histórico vazio.
  }
};

/**
 * Junta uma leitura à série, com o mesmo ritmo do painel (uma amostra a cada
 * 10 s). Devolve a série já atualizada para quem quer avaliar a tendência no
 * mesmo passo — é isso que o alarme faz sem ter de esperar por um listener.
 */
export const recordPressure = (
  pressure: number,
  now: number = Date.now(),
): BaroEntry[] => {
  if (!Number.isFinite(pressure)) return snapshot();
  if (now - lastSample < SAMPLE_INTERVAL_MS) return snapshot();
  lastSample = now;
  entries = [...entries.slice(-(LIVE_MAX - 1)), { ts: now, p: pressure }];
  if (now - lastSave >= SAVE_INTERVAL_MS) {
    lastSave = now;
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-PERSIST_MAX))).catch(
      () => {},
    );
  }
  notify();
  return snapshot();
};

/** Só para os testes e para o "zerar" do painel, se um dia existir. */
export const clearPressureHistory = (): void => {
  entries = [];
  lastSample = 0;
  lastSave = 0;
  notify();
};

export type PressureDrop = {
  /** Negativo: quantos hPa a pressão perdeu na janela. */
  dropHpa: number;
  /** Janela coberta pela amostra mais antiga dentro do limite, em horas. */
  windowH: number;
  /** hPa/h. Negativo numa queda. */
  rate: number;
};

/**
 * A regra clássica de campo (ideia #104): uma queda de ~4 hPa em 3 h anuncia
 * tempo a piorar, e uma queda mais abrupta anuncia-o antes. Avaliam-se as duas
 * janelas e vale a primeira que dispare — a de 3 h para a tendência lenta, a
 * de 1 h para o caso brusco, que a média de 3 h diluía.
 *
 * A função é pura e recebe a série pronta (assumida ordenada por `ts`) para
 * poder ser testada sem sensores nem relógio. Devolve `null` enquanto não há
 * dados que cheguem — melhor não avisar do que avisar a fingir.
 */
export const fastPressureDrop = (
  series: BaroEntry[],
  now: number = Date.now(),
): PressureDrop | null => {
  if (series.length < 2) return null;

  const evaluate = (windowMs: number, thresholdHpa: number): PressureDrop | null => {
    const within = series.filter(e => e.ts >= now - windowMs && e.ts <= now);
    if (within.length < 2) return null;
    const base = within[0];
    const last = within[within.length - 1];
    const windowH = (last.ts - base.ts) / 3600000;
    if (windowH <= 0) return null;
    const dropHpa = last.p - base.p;
    if (dropHpa <= -thresholdHpa) {
      return { dropHpa, windowH, rate: dropHpa / windowH };
    }
    return null;
  };

  return evaluate(3 * 3600000, 4) ?? evaluate(3600000, 2);
};
