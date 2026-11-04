import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Levantamento de EMF com posição (ideia #48).
 *
 * O leitor de EMF já sabia guardar um "ponto quente", mas esse ponto ia parar
 * à lista de marcos — que serve para navegar até lá, não para ver a mancha.
 * A pergunta que fica sem resposta é "onde é que o campo sobe, e até onde
 * chega": para isso é preciso que cada leitura marcada fique com a posição
 * onde foi tomada e a magnitude que se lia nesse instante.
 *
 * O registo fica no `AsyncStorage` e não na nuvem: é um levantamento do sítio
 * onde se está, não um dado para partilhar. O mini-mapa do levantamento
 * desenha os pontos por cima da posição actual e a cor de cada ponto diz
 * quão longe da leitura estava do ambiente (a mesma medida da barra e do
 * bipe, para o mapa e o número falarem a mesma língua).
 */

export type EmfSurveyPoint = {
  id: string;
  lat: number;
  lon: number;
  /** Magnitude em µT no momento da marcação. */
  value: number;
  /** Desvio face ao ambiente em µT, ou null se o ambiente não foi medido. */
  delta: number | null;
  /**
   * Nível de 0 a 1 (o mesmo `ratio` da barra do leitor). Fica guardado para a
   * cor do ponto no mapa ser a mesma que a leitura tinha no ecrã, mesmo que o
   * ambiente seja medido outra vez depois.
   */
  ratio: number | null;
  createdAt: number;
};

const STORAGE_KEY = '@bussola/emfSurvey';

/**
 * Teto de pontos guardados. 500 marcações são muitas horas de levantamento;
 * passados isso, o mais antigo sai — a lista é um registo do trabalho em
 * curso, não um arquivo.
 */
const MAX_POINTS = 500;

const isValidPoint = (point: unknown): point is EmfSurveyPoint => {
  if (!point || typeof point !== 'object') return false;
  const p = point as Partial<EmfSurveyPoint>;
  return (
    typeof p.id === 'string' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    Number.isFinite(p.value) &&
    Number.isFinite(p.createdAt) &&
    (p.delta == null || Number.isFinite(p.delta)) &&
    (p.ratio == null || Number.isFinite(p.ratio))
  );
};

export const loadEmfSurvey = async (): Promise<EmfSurveyPoint[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Uma escrita interrompida pode deixar JSON a meio: o que não se
    // reconhece como ponto é deitado fora em vez de fazer o ecrã falhar.
    return parsed.filter(isValidPoint).slice(-MAX_POINTS);
  } catch {
    return [];
  }
};

export const saveEmfSurvey = async (list: EmfSurveyPoint[]) => {
  const next = list.slice(-MAX_POINTS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const addEmfSurveyPoint = async (point: EmfSurveyPoint) => {
  const list = await loadEmfSurvey();
  return saveEmfSurvey([...list, point]);
};

export const removeEmfSurveyPoint = async (id: string) => {
  const list = await loadEmfSurvey();
  return saveEmfSurvey(list.filter(p => p.id !== id));
};

export const clearEmfSurvey = async () => saveEmfSurvey([]);

export const createEmfSurveyId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
