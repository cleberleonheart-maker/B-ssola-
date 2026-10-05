import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureCloudUser, pushCrashReport, type CrashReport } from './cloud';
import { APP_VERSION, APP_VERSION_CODE } from '../version.generated';

/**
 * Relatório de crash (ideia #56).
 *
 * O problema que isto resolve: um erro em produção é invisível. A pessoa vê a
 * app fechar e não há nada — nem stack, nem versão, nem quando — e o custo de
 * um bug ser descoberto por quem usa é o mais caro que há numa app de bússola e
 * de SOS. O dono lia o stack num produto de terceiros; aqui lê na tabela dele.
 *
 * Duas decisões que moldam o resto, e que o dono escolheu sem mim as pedir:
 *
 *   1. **Supabase, não Sentry.** A ideia #56 propunha Sentry. Não é que o
 *      Sentry seja pior: é que mandar o stack e o dispositivo de quem usa uma
 *      app de emergência para fora é uma decisão do dono, não uma conversa de
 *      implementação — e uma tabela que já existe, com RLS e com o CI a saber
 *      aplicá-la e verificá-la, resolve o problema sem conta nova nem DSN.
 *
 *   2. **No arranque seguinte, não durante o crash.** Uma app que acabou de
 *      partir não tem rede garantida para reportar antes de partir outra vez —
 *      e um reporter que lança dentro do tratamento do erro é um crash que se
 *      reproduz sozinho. O erro vai para `AsyncStorage` e sai no start seguinte.
 *
 * O que se guarda é o suficiente para encontrar e fechar o bug (mensagem,
 * stack, versão, quando, e um `fingerprint` que permite contar) e não o
 * suficiente para fazer disto uma lista de quem usa a app: sem device id, sem
 * nome, sem email, sem coordenadas. O `user_id` está lá porque a RLS é por
 * utilizador e é ele que impede que o crash de um aparelho vá para a linha de
 * outro — não porque interessasse guardar quem é a pessoa.
 *
 * **Só JavaScript.** Um crash nativo (Kotlin) é outro mecanismo, e não é o
 * que mais interessa: o bug mais caro e mais silencioso desta app não é uma
 * excepção, é o `Log.w` e o link parado quando o push do serviço falha. Um
 * reporter de crash não apanha isso. Ficou de fora de propósito, não por
 * esquecimento.
 */
const QUEUE_KEY = 'crash:fila';
const MAX_QUEUE = 20;

/** Uma fila, e não uma linha: dois erros na mesma sessão são dois bugs. */
type QueuedCrash = CrashReport & { tries: number };

/** Quantos dias o relatório sobrevive antes de a purga o levar. */
const DIAS = 90;

/**
 * Hash da mensagem, para contar quantas vezes o mesmo bug aconteceu.
 *
 * `djb2` com sinal, em hexadecimal: duas implementações do mesmo bug têm a
 * mesma mensagem quase sempre, e o que se quer é "isto aconteceu 400 vezes", não
 * "estes 400 erros". Não é um hash criptográfico — um atacante que quisesse
 * colarReports na mesma linha só precisaria de colar-se na fila de Reports do
 * próprio aparelho, e essa já é a conta dele.
 *
 * Só a primeira linha da mensagem entra: o stack muda entre builds da mesma
 * app, e se entrasse no hash um bug novo pareceria outro sempre que o código
 * à volta mudasse um linha.
 */
export const fingerprintOf = (message: string): string => {
  const primeira = message.split('\n')[0] ?? '';
  let h = 5381;
  for (let i = 0; i < primeira.length; i += 1) {
    // >>> 0 para não sair do inteiro de 32 bits: em JS o bitwise devolve signed,
    // e sem isto metade dos fingerprints nasce negativa e a contagem separa-se
    // ao acaso.
    // O `no-bitwise` está desligado porque um hash é operações de bits por
    // definição; o resto dos ficheiros não usa, e deve continuar a não usar.
    // eslint-disable-next-line no-bitwise
    h = (((h << 5) + h + primeira.charCodeAt(i)) | 0) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

/**
 * O relatório de um erro, sem o device id e sem o caminho do projecto.
 *
 * O stack do Hermes traz o bundle e o número da linha, que é o que interessa,
 * mas também pode trazer um caminho do filesystem em alguns builds. Fica o
 * primeiro, que é onde a excepção nasceu, e o resto vai tal e qual: um stack
 * truncado é um stack que não se pode ler.
 */
const reportFor = (message: string, stack: string | null): CrashReport => ({
  message: message.slice(0, 2000),
  stack: stack ? stack.slice(0, 8000) : null,
  fingerprint: fingerprintOf(message),
  appVersion: APP_VERSION,
  versionCode: APP_VERSION_CODE,
  happenedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + DIAS * 24 * 60 * 60 * 1000).toISOString(),
});

/**
 * Junta um crash à fila.
 *
 * Nunca lança. É chamado de dentro do tratamento de erros, e qualquer coisa que
 * corra aqui pode ser a razão de o crash estar a acontecer.
 */
export const recordCrash = async (error: unknown): Promise<void> => {
  try {
    const e = error as { message?: unknown; stack?: unknown } | null;
    const message =
      e && typeof e.message === 'string' && e.message.length > 0
        ? e.message
        : String(error);
    const stack = e && typeof e.stack === 'string' ? e.stack : null;
    const fila = await readQueue();
    // A mesma mensagem duas vezes na mesma sessão é o mesmo bug a acontecer
    // duas vezes; guardar as duas só ocupa lugar e faz a contagem mentir.
    if (fila.some(c => c.fingerprint === fingerprintOf(message))) return;
    fila.push({ ...reportFor(message, stack), tries: 0 });
    // A fila tem tecto porque um loop de crashes a escrever em crashes — que é
    // bem o género de coisa que um bug de escrita provoca — não pode ocupar o
    // armazenamento todo e impedir a app de arrancar.
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(fila.slice(-MAX_QUEUE)));
  } catch {
    // Um reporter de crash que falha é o fim: silenciar é a única opção, e é o
    // que o resto do app faz com os erros de armazenamento.
  }
};

const readQueue = async (): Promise<QueuedCrash[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedCrash[]) : [];
  } catch {
    return [];
  }
};

/**
 * Manda o que está na fila, e limpa o que foi aceite.
 *
 * Corre no arranque, e volta a correr na próxima vez se falhar: o relatório de
 * um crash que morre sem rede não pode ser um relatório perdido, que era
 * exactamente o problema que está a ser resolvido. `tries` limita a tentativa
 * para que um relatório que o Supabase rejeita para sempre (uma coluna que não
 * existe, um RLS que mudou) não seja reenviado em cada arranque para sempre.
 */
export const flushCrashes = async (): Promise<number> => {
  let enviados = 0;
  try {
    const fila = await readQueue();
    if (fila.length === 0) return 0;
    const userId = await ensureCloudUser();
    if (!userId) return 0;
    const restantes: QueuedCrash[] = [];
    for (const crash of fila) {
      if (crash.tries >= 3) continue; // e some: não volta a tentar
      const ok = await pushCrashReport(userId, crash);
      if (ok) enviados += 1;
      else restantes.push({ ...crash, tries: crash.tries + 1 });
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(restantes));
  } catch {
    // Igual: um arranque não pode morrer por causa de um relatório de crash.
  }
  return enviados;
};

/**
 * Instala o tratamento global de erros não tratados.
 *
 * Chamar uma vez, no arranque. O `ErrorUtils` do Hermes é o ponto de entrada
 * do que o `try/catch` não apanhou: um erro dentro de um `setTimeout`, dentro
 * de um `useEffect`, ou dentro de um gestor de evento. Devolve uma função para
 * desfazer, que os testes usam para não deixar um handler global vivo durante
 * a suite.
 */
export const installCrashReporter = (): (() => void) => {
  const anterior = (ErrorUtils as unknown as { getGlobalHandler?: () => unknown })
    .getGlobalHandler?.();
  (ErrorUtils as unknown as { setGlobalHandler: (h: unknown) => void }).setGlobalHandler(
    (error: unknown) => {
      void recordCrash(error);
      // O handler anterior continua a ser chamado: sem isto o crash deixa de
      // aparecer no logcat e no ecrã vermelho do Metro, e quem desenvolve passa
      // a depurar às cegas num aparelho que fecha sem dizer nada.
      const anteriorFn = anterior as ((e: unknown) => void) | undefined;
      if (typeof anteriorFn === 'function') anteriorFn(error);
    },
  );
  return () => {
    (ErrorUtils as unknown as { setGlobalHandler: (h: unknown) => void }).setGlobalHandler(
      anterior,
    );
  };
};
