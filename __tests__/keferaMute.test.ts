import Tts from 'react-native-tts';
import {
  isMuted,
  setMuted,
  speak,
  speakAndWait,
  stopSpeaking,
} from '../src/assistant/voice';

/**
 * Silenciar a Kefera (#69).
 *
 * Toda a fala passa por `speak`/`speakAndWait`, então desligar a fala na fonte
 * é o que cala a assistente inteira sem espalhar verificações. O que se testa
 * aqui é justamente isso: com o silêncio ligado nada chega ao motor de TTS, e
 * ao reativar a fala volta. `speakAndWait` tem de resolver na hora — quem
 * espera a fala terminar (a saudação de ativação, por exemplo) não pode ficar
 * pendurado durante o silêncio.
 */
describe('voice — silenciar (#69)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMuted(false);
  });

  afterEach(async () => {
    setMuted(false);
    // `speak` arma um watchdog de 15 s para o TTS destravar; sem o mock não há
    // evento de fim, então é aqui que ele é limpo para o teste não deixar timer
    // aberto (foi o que fez o worker do Jest não sair sozinho).
    await stopSpeaking();
  });

  it('começa sem silêncio', () => {
    expect(isMuted()).toBe(false);
  });

  it('não fala enquanto silenciada', async () => {
    setMuted(true);
    await speak('bom dia');
    expect(Tts.speak).not.toHaveBeenCalled();
  });

  it('volta a falar depois de reativar', async () => {
    setMuted(true);
    await speak('nada');
    setMuted(false);
    await speak('olá');
    expect(Tts.speak).toHaveBeenCalledWith('olá');
  });

  it('speakAndWait resolve na hora quando silenciada', async () => {
    setMuted(true);
    await expect(speakAndWait('x')).resolves.toBeUndefined();
    expect(Tts.speak).not.toHaveBeenCalled();
  });
});
