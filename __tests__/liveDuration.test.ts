import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LIVE_DURATION_OPTIONS,
  DEFAULT_LIVE_DURATION,
  loadLiveDuration,
  saveLiveDuration,
} from '../src/services/preferencesService';
import { liveDurationLabel } from '../src/services/liveShareService';
import { createTranslator } from '../src/i18n/strings';

const LANGS = ['pt', 'en', 'es'] as const;

describe('opções de duração do rastreio', () => {
  it('tem o que dá para um recado e o que dá para uma trilha longa', () => {
    expect(LIVE_DURATION_OPTIONS).toEqual([15, 30, 60, 120]);
    expect(LIVE_DURATION_OPTIONS).toContain(DEFAULT_LIVE_DURATION);
  });

  it('nenhuma opção fica abaixo do mínimo que a sessão aceita', () => {
    // `startLiveShare` faz `Math.max(5, minutes)`: uma opção abaixo de 5 min
    // escreveria na tela uma duração que a sessão não ia ter.
    expect(Math.min(...LIVE_DURATION_OPTIONS)).toBeGreaterThanOrEqual(5);
  });
});

describe('liveDurationLabel', () => {
  it('minutos saem em "min"', () => {
    expect(liveDurationLabel(15)).toBe('15 min');
    expect(liveDurationLabel(30)).toBe('30 min');
  });

  it('horas cheias saem em "h", para o chip não ficar largo', () => {
    expect(liveDurationLabel(60)).toBe('1 h');
    expect(liveDurationLabel(120)).toBe('2 h');
  });

  it('nunca promete menos do que a sessão dura', () => {
    // 1 min e 0 caem no mesmo mínimo de 5 min do `Math.max(5, minutes)`.
    expect(liveDurationLabel(1)).toBe('5 min');
    expect(liveDurationLabel(0)).toBe('5 min');
  });

  it('meia hora sai com uma casa decimal', () => {
    expect(liveDurationLabel(90)).toBe('1.5 h');
  });
});

describe('duração guardada', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('sem nada guardado, devolve o default', async () => {
    await expect(loadLiveDuration()).resolves.toBe(DEFAULT_LIVE_DURATION);
  });

  it('guarda e lê o que foi escolhido', async () => {
    for (const minutes of LIVE_DURATION_OPTIONS) {
      await saveLiveDuration(minutes);
      await expect(loadLiveDuration()).resolves.toBe(minutes);
    }
  });

  it('valor fora da lista cai no default, em vez de durar o que ninguém escolheu', async () => {
    await AsyncStorage.setItem('@bussola/liveDuration', '7');
    await expect(loadLiveDuration()).resolves.toBe(DEFAULT_LIVE_DURATION);
  });

  it('lixo no storage não derruba a abertura do modal', async () => {
    await AsyncStorage.setItem('@bussola/liveDuration', 'meia hora');
    await expect(loadLiveDuration()).resolves.toBe(DEFAULT_LIVE_DURATION);
  });

  it('storage a falhar devolve o default em vez de travar o rastreio', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValue(new Error('disco cheio'));
    await expect(loadLiveDuration()).resolves.toBe(DEFAULT_LIVE_DURATION);
    spy.mockRestore();
  });
});

describe('os textos acompanham a duração', () => {
  it('o texto de partilha enche {time} nos três idiomas', () => {
    for (const lang of LANGS) {
      const text = createTranslator(lang)('live_shared', {
        time: liveDurationLabel(120),
      });
      expect(text).toContain('2 h');
      expect(text).not.toContain('{time}');
    }
  });

  it('o botão deixa de anunciar 30 min fixos', () => {
    for (const lang of LANGS) {
      expect(createTranslator(lang)('live_btn')).not.toContain('30');
    }
  });
});