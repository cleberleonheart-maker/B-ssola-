import fs from 'fs';
import path from 'path';

const raiz = path.join(__dirname, '..');
const manifest = fs.readFileSync(
  path.join(raiz, 'android/app/src/main/AndroidManifest.xml'),
  'utf8',
);
const idxQueries = manifest.indexOf('<queries>');
const idxApplication = manifest.indexOf('<application');

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
