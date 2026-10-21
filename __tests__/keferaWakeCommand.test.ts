import { detectWakeCommand } from '../src/assistant/AssistantContext';
import { isWakeWord, stripWakeWord } from '../src/assistant/voice';
import { KeferaEngine } from '../src/assistant/engine';

// O `engine.init()` passa pelo `loadMemory`, que faz login anónimo no Supabase.
// Sem rede o teste ficava 5 s à espera do timeout do fetch; aqui a memória é
// local e o motor arranca na hora.
jest.mock('../src/assistant/memory', () => {
  const actual = jest.requireActual('../src/assistant/memory');
  return {
    ...actual,
    loadMemory: jest.fn(async () => actual.cloneMemory(actual.DEFAULT_MEMORY)),
    saveMemory: jest.fn(async () => {}),
  };
});

/**
 * A palavra de ativação chegando junto do comando.
 *
 * O wake-command abre a escuta como 'manual' (build 190) e o reconhecedor
 * devolve a frase inteira — "kefera, qual a minha localização". Se "kefera"
 * for para o motor, nenhum comando casa e a Kefera fica só no "ouvi", com uma
 * resposta de fallback. O `send` tira a palavra de ativação antes de mandar ao
 * motor; é essa transformação que estes testes fixam.
 */
const toCommand = (raw: string): string => {
  const wakeCmd = detectWakeCommand(raw);
  if (wakeCmd) {
    return raw;
  }
  return stripWakeWord(raw) || raw;
};

describe('send — limpeza da palavra de ativação', () => {
  it('a frase inteira com a wake word vira comando sem ela', () => {
    expect(toCommand('kefera, qual a minha localização')).toBe(
      'qual a minha localizacao',
    );
    expect(isWakeWord('kefera, qual a minha localização')).toBe(true);
  });

  it('variações reconhecidas do nome também são removidas', () => {
    expect(toCommand('quefera qual minha localizacao')).toBe(
      'qual minha localizacao',
    );
    expect(toCommand('keyfera quanto é 2 mais 2')).toBe('quanto e 2 mais 2');
  });

  it('"ativar kefera" continua sendo um comando de escuta, não vira "ativar"', () => {
    // A wake word está no fim e é o objeto do comando: tirá-la o quebrava.
    expect(detectWakeCommand('ativar a kefera')).toBe('on');
    expect(detectWakeCommand('desativa a kefera')).toBe('off');
    expect(toCommand('ativar a kefera')).toBe('ativar a kefera');
  });

  it('uma frase só com a wake word não vira comando vazio', () => {
    expect(toCommand('kefera')).toBe('kefera');
  });

  it('texto sem wake word passa intacto', () => {
    expect(toCommand('qual minha localizacao')).toBe('qual minha localizacao');
  });
});

describe('send — o comando limpo executa no motor', () => {
  it('"kefera, qual a minha localização" responde a localização', async () => {
    const engine = new KeferaEngine();
    await engine.init();
    engine.setContext({ latitude: -23.5, longitude: -46.6, accuracy: 8 });

    const result = await engine.handle(toCommand('kefera, qual a minha localização'));

    expect(result.kind).toBe('answer');
    expect(result.text).toContain('23.500000 S');

    // Sem limpar, o motor não casaria nenhum comando — o bug original.
    const semLimpar = await engine.handle('kefera, qual a minha localização');
    expect(semLimpar.kind).toBe('help');
  });
});
