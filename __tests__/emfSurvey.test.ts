import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addEmfSurveyPoint,
  clearEmfSurvey,
  createEmfSurveyId,
  loadEmfSurvey,
  removeEmfSurveyPoint,
  saveEmfSurvey,
  type EmfSurveyPoint,
} from '../src/services/emfSurveyService';
import { emfLevel, EMF_LOW_RATIO, EMF_HIGH_RATIO } from '../src/utils/emf';

const STORAGE_KEY = '@bussola/emfSurvey';

const point = (over: Partial<EmfSurveyPoint> = {}): EmfSurveyPoint => ({
  id: createEmfSurveyId(),
  lat: 38.7223,
  lon: -9.1393,
  value: 45.2,
  delta: 12.1,
  ratio: 0.5,
  createdAt: 1700000000000,
  ...over,
});

describe('levantamento de EMF', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('começa vazio', async () => {
    expect(await loadEmfSurvey()).toEqual([]);
  });

  it('guarda e volta a ler os pontos', async () => {
    await saveEmfSurvey([point({ value: 10 }), point({ value: 20 })]);
    const list = await loadEmfSurvey();
    expect(list).toHaveLength(2);
    expect(list[0].value).toBe(10);
    expect(list[1].value).toBe(20);
  });

  it('acrescenta mantendo a ordem das marcações', async () => {
    await addEmfSurveyPoint(point({ value: 11 }));
    await addEmfSurveyPoint(point({ value: 22 }));
    await addEmfSurveyPoint(point({ value: 33 }));
    const list = await loadEmfSurvey();
    expect(list.map(p => p.value)).toEqual([11, 22, 33]);
  });

  it('apaga um ponto pelo id e deixa os outros', async () => {
    const alvo = point({ value: 42 });
    await addEmfSurveyPoint(point({ value: 1 }));
    await addEmfSurveyPoint(alvo);
    const rest = await removeEmfSurveyPoint(alvo.id);
    expect(rest).toHaveLength(1);
    expect(rest[0].value).toBe(1);
    expect((await loadEmfSurvey())[0].value).toBe(1);
  });

  it('limpa tudo', async () => {
    await addEmfSurveyPoint(point());
    await clearEmfSurvey();
    expect(await loadEmfSurvey()).toEqual([]);
  });

  it('atira fora o que não parece um ponto', async () => {
    // Uma escrita interrompida pode deixar lixo no armazenamento: o que não
    // se reconhece é deitado fora em vez de fazer o ecrã falhar.
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'sem-coordenadas' }, point({ value: 7 })]),
    );
    const list = await loadEmfSurvey();
    expect(list).toHaveLength(1);
    expect(list[0].value).toBe(7);
  });

  it('devolve lista vazia quando o JSON guardado não é válido', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{isto não é json');
    expect(await loadEmfSurvey()).toEqual([]);
  });

  it('guarda no máximo 500 pontos, deitando fora os mais antigos', async () => {
    const many = Array.from({ length: 501 }, (_, i) => point({ value: i }));
    await saveEmfSurvey(many);
    const list = await loadEmfSurvey();
    expect(list).toHaveLength(500);
    expect(list[0].value).toBe(1);
    expect(list[499].value).toBe(500);
  });
});

describe('nível de uma leitura de EMF', () => {
  it('classifica pelos mesmos limiares da barra', () => {
    expect(emfLevel(0)).toBe('low');
    expect(emfLevel(EMF_LOW_RATIO - 0.01)).toBe('low');
    expect(emfLevel(EMF_LOW_RATIO)).toBe('medium');
    expect(emfLevel(EMF_HIGH_RATIO - 0.01)).toBe('medium');
    expect(emfLevel(EMF_HIGH_RATIO)).toBe('high');
    expect(emfLevel(1)).toBe('high');
  });
});
