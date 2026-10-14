import fs from 'fs';
import path from 'path';

const raiz = path.join(__dirname, '..');
const manifest = fs.readFileSync(
  path.join(raiz, 'android/app/src/main/AndroidManifest.xml'),
  'utf8',
);
const idxQueries = manifest.indexOf('<queries>');
const idxApplication = manifest.indexOf('<application');

const patch = fs.readFileSync(
  path.join(raiz, 'patches/@react-native-community+voice+1.1.9.patch'),
  'utf8',
);
const voiceJs = fs.readFileSync(
  path.join(raiz, 'node_modules/@react-native-community/voice/dist/index.js'),
  'utf8',
);

/**
 * Android 11+ (API 30) esconde servicos de terceiros por omissao. Sem declarar
 * o servico de reconhecimento de voz, `SpeechRecognizer.isRecognitionAvailable()`
 * devolve false, o app conclui que nao ha voz (`voiceSupported=false`) e o
 * microfone nunca abre pela palavra de ativacao -- so o comando escrito funciona.
 * O botao da palavra de ativacao ate acende, o que torna o defeito silencioso:
 * nenhum teste de JS o apanhava. Este teste existe para nao voltar.
 */
describe('manifest de voz', () => {
  it('declara o servico de reconhecimento para o Android 11+', () => {
    expect(manifest).toMatch(/android\.speech\.RecognitionService/);
    expect(idxQueries).toBeGreaterThan(-1);
  });

  it('poe o <queries> fora do <application> (exigencia da plataforma)', () => {
    // Dentro do <application> o aapt reclama e o elemento e ignorado.
    expect(idxApplication).toBeGreaterThan(idxQueries);
  });

  it('nenhum comentario XML contem "--"', () => {
    // Um "--" dentro de um comentario e XML invalido: o aapt rebenta no build
    // (SAXParseException) e o erro so aparece no CI, minutos depois. Custa
    // pouco apanhar aqui.
    const comentarios = manifest.match(/<!--[\s\S]*?-->/g) ?? [];
    for (const c of comentarios) {
      expect(c.slice(4, -3)).not.toContain('--');
    }
  });
});

/**
 * `@react-native-community/voice@1.1.9` regista o modulo nativo no Android
 * como "RCTVoice", mas o JavaScript da mesma versao le `NativeModules.Voice`.
 * Com a New Architecture o modulo nao aparece sob o nome errado, `Voice` fica
 * `undefined`, `isAvailable()` falha dentro da Promise e `voiceSupported`
 * fica false: o microfone nasce cinza e a palavra de ativacao nunca funciona.
 * O patch peca-lhe o `getName()` a devolver "Voice". Sem ele o APK compila e
 * o app abre sem reclamar -- o defeito so existe no aparelho.
 */
describe('nome do modulo de voz', () => {
  it('o JavaScript procura NativeModules.Voice', () => {
    expect(voiceJs).toMatch(/NativeModules\.Voice\b/);
    expect(voiceJs).not.toMatch(/NativeModules\.RCTVoice/);
  });

  it('o patch faz o getName() do Android devolver "Voice"', () => {
    expect(patch).toContain('VoiceModule.java');
    expect(patch).toMatch(/-[ \t]+return "RCTVoice";/);
    expect(patch).toMatch(/\+[ \t]+return "Voice";/);
  });
});

/**
 * `startListening` do nativo destruía e recriava o `SpeechRecognizer` a cada
 * início. Numa conversa (ativação -> comando -> novo ciclo de ativação) o
 * Android respondia `RECOGNIZER_BUSY`: só bipes e "nenhuma fala", sem resposta.
 * O patch passa a reusar a mesma instância (`cancel()` antes de reiniciar) e,
 * se o `startListening` rebentar na mesma, recria uma vez.
 */
describe('reuso do reconhecedor de voz', () => {
  it('deixa de destruir o reconhecedor a cada inicio', () => {
    expect(patch).toMatch(/-[ \t]+speech\.destroy\(\);/);
    expect(patch).toMatch(/\+[ \t]+speech\.cancel\(\);/);
  });

  it('tenta outra vez se o start falhar apos o reuso', () => {
    expect(patch).toContain('start apos reuso');
    expect(patch).toMatch(/\+[ \t]+speech\.startListening\(intent\);/);
  });
});
