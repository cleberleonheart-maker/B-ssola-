import Voice from '@react-native-community/voice';
import {
  startListening,
  setVoiceEngine,
  getVoiceEngine,
  listVoiceServices,
} from '../src/assistant/voice';

/**
 * Fallback de motor de voz (#179).
 *
 * Quando o motor padrão do aparelho recusa a sessão (erro 5 - ERROR_CLIENT,
 * 11 - LANGUAGE_NOT_SUPPORTED, 12 - LANGUAGE_UNAVAILABLE) o motor Google costuma
 * aceitar. `setVoiceEngine('GOOGLE')` faz o `start` passar RECOGNIZER_ENGINE,
 * que o nativo traduz para o ComponentName do Google.
 */
describe('voice — fallback de motor (#179)', () => {
  afterEach(() => {
    setVoiceEngine(null);
    jest.clearAllMocks();
  });

  it('começa no motor padrão do aparelho', () => {
    expect(getVoiceEngine()).toBeNull();
  });

  it('sem motor fixado, abre sem opções extra', async () => {
    await startListening();
    expect(Voice.start).toHaveBeenCalledWith('pt-BR');
  });

  it('usa RECOGNIZER_ENGINE=GOOGLE depois de fixado', async () => {
    setVoiceEngine('GOOGLE');
    await startListening();
    expect(Voice.start).toHaveBeenCalledWith('pt-BR', {
      RECOGNIZER_ENGINE: 'GOOGLE',
    });
  });

  it('lista os motores de reconhecimento instalados', async () => {
    await expect(listVoiceServices()).resolves.toEqual([]);
  });
});
