import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeferaEngine } from './engine';
import { pushHistory } from './memory';
import { normalizeText } from './normalizer';
import {
  attachVoice,
  isVoiceAvailable,
  isWakeWord,
  stripWakeWord,
  speak,
  speakAndWait,
  startListening,
  stopSpeaking,
  destroyVoice,
  setVoiceLanguage,
  setMuted,
  isMuted,
  whenSpeechIdle,
  setVoiceEngine,
  getVoiceEngine,
  listVoiceServices,
} from './voice';
import {
  buildEmptyContext,
  type AssistantAction,
  type AssistantContextData,
  type ChatMessage,
} from './types';
import { useLanguage } from '../i18n/LanguageContext';
import { migrateKey } from '../utils/storage';

const WAKE_PREF_KEY = '@bussola/kefera/wake';
const LEGACY_WAKE_PREF_KEY = '@bussola/virgin/wake';

// O nativo envia o erro como "%d/%s" (ex.: "11/Didn't understand..."). Extrai o
// número para decidir se vale trocar de motor.
const parseVoiceErrorCode = (raw: string): number | null => {
  const match = /^\s*(\d+)/.exec(raw);
  return match ? Number(match[1]) : null;
};

// 11 = ERROR_LANGUAGE_NOT_SUPPORTED, 12 = ERROR_LANGUAGE_UNAVAILABLE: o motor
// padrão do aparelho não tem o idioma; aí vale fixar o motor Google. Erros
// passageiros (5 = ERROR_CLIENT, 10 = ERROR_SERVER_DISCONNECTED, 7 = NO_MATCH)
// NÃO entram aqui: trocar de motor por causa deles e de forma permanente piorava
// tudo — no aparelho do usuário, depois de um erro 10, todo start passou a usar
// o motor Google e a palavra de ativação deixou de ser reconhecida (erro 7).
const VOICE_ENGINE_FALLBACK_CODES = new Set([11, 12]);

type AssistantApi = {
  ready: boolean;
  voiceSupported: boolean;
  listening: boolean;
  wakeOn: boolean;
  toggleWake: () => void;
  /** Instante (epoch ms) até quando a Kefera está silenciada, ou null. */
  mutedUntil: number | null;
  muteFor: (minutes: number) => void;
  unmute: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleVoice: () => Promise<void>;
  messages: ChatMessage[];
  send: (text: string) => Promise<void>;
  welcome: () => Promise<void>;
  clear: () => void;
  setContextData: (partial: Partial<AssistantContextData>) => void;
  setActionHandler: (fn: (action: AssistantAction) => void) => void;
};

const AssistantContext = createContext<AssistantApi | null>(null);

const createMessage = (
  role: ChatMessage['role'],
  text: string,
  speakFlag: boolean,
): ChatMessage => ({
  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
  role,
  text,
  speak: speakFlag,
  at: Date.now(),
});

type VoiceMode = 'none' | 'manual' | 'wake' | 'command';

const MAX_COMMAND_RETRIES = 5;

const detectWakeCommand = (text: string): 'on' | 'off' | null => {
  const n = normalizeText(text);
  const target =
    '(?:a )?(?:kefera|escuta por voz da kefera|escuta por voz|escuta)';
  const onRe = new RegExp(
    `^(?:ativ(a|ar|e)|lig(a|ar|ue)|acord(a|ar|e)|cham(a|ar|e)|vem|venha|despert(a|ar|e)) ${target}(?: |$)`,
  );
  const offRe = new RegExp(
    `^(?:desativ(a|ar|e)|deslig(a|ar|ue)|silenci(a|ar|e)|cal(a|ar|e)) ${target}(?: |$)`,
  );

  if (offRe.test(n)) {
    return 'off';
  }
  if (onRe.test(n)) {
    return 'on';
  }
  return null;
};

export const AssistantProvider = ({ children }: { children: ReactNode }) => {
  const engineRef = useRef<KeferaEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new KeferaEngine();
  }
  const { t, lang } = useLanguage();

  const [ready, setReady] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [wakeOn, setWakeOnState] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // DIAGNÓSTICO TEMPORÁRIO (remover depois): mostra na conversa o que o
  // reconhecedor de voz ouve e os erros que devolve, para descobrir por que a
  // pergunta não chega ao motor. `coalesce` troca a mesma linha em vez de
  // encher a conversa com cada resultado parcial.
  const debugMsgIdRef = useRef<string | null>(null);
  const pushDebug = useCallback((text: string, coalesce = false) => {
    setMessages(prev => {
      if (coalesce && debugMsgIdRef.current) {
        const idx = prev.findIndex(m => m.id === debugMsgIdRef.current);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = { ...next[idx], text };
          return next;
        }
      }
      const msg = createMessage('assistant', text, false);
      if (coalesce) {
        debugMsgIdRef.current = msg.id;
      }
      return [...prev, msg];
    });
  }, []);

  const sendRef = useRef<(text: string) => Promise<void>>(async () => {});
  const initPromiseRef = useRef<Promise<void> | null>(null);

  const wakeOnRef = useRef(false);
  const appActiveRef = useRef(true);
  const sessionActiveRef = useRef(false);
  const awaitingCommandRef = useRef(false);
  const commandRetriesRef = useRef(0);
  const voiceModeRef = useRef<VoiceMode>('none');
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleWakeRef = useRef<() => void>(() => {});
  const actionHandlerRef = useRef<(action: AssistantAction) => void>(() => {});

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) {
        return;
      }
      setMessages(prev => [...prev, createMessage('user', clean, false)]);

      const wakeCmd = detectWakeCommand(clean);
      if (wakeCmd) {
        // 'on' é idempotente: pedir para ativar quando já está ativa não
        // pode desligar a escuta
        const next = wakeCmd === 'off' ? false : true;
        if (next !== wakeOnRef.current) {
          toggleWakeRef.current();
        }
        const phrase = next
          ? t('as_wake_activated')
          : t('as_wake_deactivated');
        setMessages(prev => [...prev, createMessage('assistant', phrase, true)]);
        speak(phrase);
        return;
      }

      const engine = engineRef.current;
      if (!engine) {
        return;
      }
      try {
        const result = await engine.handle(clean);
        setMessages(prev => [
          ...prev,
          createMessage('assistant', result.text, result.speak),
        ]);
        if (result.speak) {
          speak(result.text);
        }
        if (result.action) {
          actionHandlerRef.current(result.action);
        }
      } catch {
        const fallback = t('as_eng_error');
        setMessages(prev => [...prev, createMessage('assistant', fallback, false)]);
      }
    },
    [t],
  );

  sendRef.current = send;

  const welcome = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }
    try {
      if (initPromiseRef.current) {
        await initPromiseRef.current;
      } else {
        await engine.init();
        initPromiseRef.current = Promise.resolve();
      }
    } catch {
      // segue mesmo se a memória falhar
    }
    setReady(true);
    const name = engine.getMemory().facts.nome;
    const base = name
      ? t('ui_welcome_name', { name })
      : t('ui_welcome_no_name');
    pushHistory(engine.getMemory(), 'assistant', base);
    setOpen(true);
    setMessages(prev => [...prev, createMessage('assistant', base, true)]);
    speak(base);
  }, [t]);

  const clearWakeTimer = useCallback(() => {
    if (wakeTimerRef.current) {
      clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = null;
    }
  }, []);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const stopSession = useCallback(async () => {
    sessionActiveRef.current = false;
    voiceModeRef.current = 'none';
    awaitingCommandRef.current = false;
    commandRetriesRef.current = 0;
    clearSettleTimer();
    await destroyVoice();
    setListening(false);
  }, [clearSettleTimer]);

  const beginSession = useCallback(
    async (mode: Exclude<VoiceMode, 'none' | 'manual'>) => {
      // Silenciada: não reabrir o microfone, senão a palavra de ativação
      // voltaria a disparar e a assistente continuaria a ouvir apesar do
      // "silêncio". A escuta volta sozinha quando o prazo termina.
      if (isMuted()) {
        return;
      }
      if (
        mode === 'command' &&
        sessionActiveRef.current &&
        voiceModeRef.current === 'command'
      ) {
        return;
      }
      if (mode !== 'command' && sessionActiveRef.current) {
        return;
      }
      if (mode === 'wake' && (!wakeOnRef.current || !appActiveRef.current)) {
        return;
      }
      if (!voiceSupported && mode === 'wake') {
        return;
      }
      if (mode === 'command') {
        awaitingCommandRef.current = true;
      }
      // abrir o microfone durante o TTS realimentaria a palavra de ativação
      // (várias respostas contêm "Kefera") e reiniciaria o ciclo sozinha
      if (mode === 'wake') {
        await whenSpeechIdle();
        if (!appActiveRef.current) {
          return;
        }
      }
      sessionActiveRef.current = true;
      voiceModeRef.current = mode;
      setListening(true);
      const started = await startListening();
      if (!started) {
        pushDebug(`⚠️ escuta não iniciou (${mode})`);
        sessionActiveRef.current = false;
        voiceModeRef.current = 'none';
        setListening(false);
        if (mode === 'wake') {
          clearWakeTimer();
          wakeTimerRef.current = setTimeout(() => {
            if (appActiveRef.current) {
              beginSession('wake');
            }
          }, 3000);
        }
      }
    },
    [clearWakeTimer, pushDebug, voiceSupported],
  );

  const scheduleWakeCycle = useCallback(() => {
    clearWakeTimer();
    wakeTimerRef.current = setTimeout(() => {
      beginSession('wake');
    }, 450);
  }, [beginSession, clearWakeTimer]);

  const clearUnmuteTimer = useCallback(() => {
    if (unmuteTimerRef.current) {
      clearTimeout(unmuteTimerRef.current);
      unmuteTimerRef.current = null;
    }
  }, []);

  /**
   * Silencia a Kefera até `Date.now() + minutes` (#69).
   *
   * Cala a fala na fonte (`setMuted`), corta o que estiver a tocar e fecha a
   * escuta — sem isto o microfone continuaria aberto e a palavra de ativação
   * dispararia respostas que ninguém ouve mas que gastam bateria e rede. O
   * prazo pedido é reposto a cada chamada: escolher "30 min" depois de um
   * "5 min" não pode deixar o prazo mais curto a mandar.
   */
  const muteFor = useCallback(
    (minutes: number) => {
      clearUnmuteTimer();
      const until = Date.now() + minutes * 60_000;
      setMuted(true);
      setMutedUntil(until);
      stopSpeaking();
      if (sessionActiveRef.current) {
        stopSession();
      }
      setListening(false);
      unmuteTimerRef.current = setTimeout(() => {
        unmuteTimerRef.current = null;
        setMuted(false);
        setMutedUntil(null);
        if (wakeOnRef.current && appActiveRef.current) {
          scheduleWakeCycle();
        }
      }, minutes * 60_000);
    },
    [clearUnmuteTimer, scheduleWakeCycle, stopSession],
  );

  const unmute = useCallback(() => {
    clearUnmuteTimer();
    setMuted(false);
    setMutedUntil(null);
    if (wakeOnRef.current && appActiveRef.current) {
      scheduleWakeCycle();
    }
  }, [clearUnmuteTimer, scheduleWakeCycle]);

  const wakeDetected = useCallback(
    async (inlineCommand?: string) => {
      clearWakeTimer();
      // A sessão de ativação já terminou (foi o resultado dela que chegou até
      // aqui), então não vale a pena insistir num `stop`: um `stopListening`
      // extra re-disparava `onEndOfSpeech` e criava um timer de folga que, mais
      // tarde, abria um comando a mais por cima do verdadeiro (erros 5/10).
      // O `startListening` já abre um reconhecedor novo (destrói o anterior).
      clearSettleTimer();
      awaitingCommandRef.current = true;
      commandRetriesRef.current = 0;
      sessionActiveRef.current = false;
      voiceModeRef.current = 'none';
      setListening(false);
      const phrase = t('as_wake_here');
      setOpen(true);
      setMessages(prev => [...prev, createMessage('assistant', phrase, true)]);
      await speakAndWait(phrase);
      if (!appActiveRef.current) {
        return;
      }
      // O TTS pode segurar o foco de áudio por um instante depois de terminar.
      // O fluxo automático (com o "Estou aqui" antes) falhava com erro 5 ao
      // abrir a escuta do comando, enquanto o 🎤 manual — sem TTS antes —
      // funcionava sempre. Libertamos o motor e damos uma folga antes de ouvir.
      await stopSpeaking();
      await new Promise<void>(resolve => setTimeout(resolve, 700));
      if (!appActiveRef.current) {
        return;
      }
      if (inlineCommand) {
        // comando já veio na frase de ativação: não reabre o microfone
        awaitingCommandRef.current = false;
        await sendRef.current(inlineCommand);
        if (wakeOnRef.current) {
          scheduleWakeCycle();
        }
        return;
      }
      if (awaitingCommandRef.current) {
        beginSession('command');
      }
    },
    [beginSession, clearSettleTimer, clearWakeTimer, scheduleWakeCycle, t],
  );
  const handleTranscription = useCallback(
    (text: string) => {
      if (!text) {
        return;
      }
      const mode = voiceModeRef.current;
      // Resultado de uma sessão que já não está à espera (ex.: chegou depois de
      // pararmos/destruirmos o reconhecedor). Antes isto caía no `send` final e
      // a Kefera executava lixo ou um comando repetido.
      if (mode === 'none') {
        return;
      }
      clearSettleTimer();
      sessionActiveRef.current = false;
      if (mode === 'wake') {
        if (!isWakeWord(text)) {
          // Estávamos à espera do comando mas a sessão já voltou para a
          // ativação: em vez de descartar em silêncio (o utilizador falava e
          // não acontecia nada), tratamos o que foi dito como o comando.
          if (awaitingCommandRef.current) {
            commandRetriesRef.current = 0;
            awaitingCommandRef.current = false;
            clearWakeTimer();
            voiceModeRef.current = 'none';
            sendRef.current(text);
            if (wakeOnRef.current && appActiveRef.current) {
              scheduleWakeCycle();
            }
          }
          return;
        }
        // "Kefera, qual a minha latitude?" desperta E executa o comando
        wakeDetected(stripWakeWord(text) || undefined);
        return;
      }
      if (mode === 'command') {
        commandRetriesRef.current = 0;
        awaitingCommandRef.current = false;
        clearWakeTimer();
        voiceModeRef.current = 'none';
        sendRef.current(text);
        // Retoma a escuta da palavra de ativação sem depender do `onEnd` que
        // ainda vem a seguir (esse é agora ignorado, porque o modo é 'none').
        if (wakeOnRef.current && appActiveRef.current) {
          scheduleWakeCycle();
        }
        return;
      }
      if (mode === 'manual') {
        sendRef.current(text);
        return;
      }
    },
    [clearSettleTimer, clearWakeTimer, scheduleWakeCycle, wakeDetected],
  );

  const endCommandListening = useCallback(() => {
    commandRetriesRef.current += 1;
    if (commandRetriesRef.current > MAX_COMMAND_RETRIES) {
      awaitingCommandRef.current = false;
      commandRetriesRef.current = 0;
      voiceModeRef.current = wakeOnRef.current ? 'wake' : 'none';
      if (wakeOnRef.current && appActiveRef.current) {
        scheduleWakeCycle();
      }
      return;
    }
    clearWakeTimer();
    wakeTimerRef.current = setTimeout(() => {
      beginSession('command');
    }, 900);
  }, [beginSession, clearWakeTimer, scheduleWakeCycle]);

  const fallbackFromCommand = useCallback(() => {
    if (awaitingCommandRef.current) {
      endCommandListening();
      return;
    }
    voiceModeRef.current = wakeOnRef.current ? 'wake' : 'none';
    if (wakeOnRef.current && appActiveRef.current) {
      clearWakeTimer();
      wakeTimerRef.current = setTimeout(() => {
        beginSession('wake');
      }, 2000);
    }
  }, [beginSession, clearWakeTimer, endCommandListening]);

  // No Android, `onSpeechEnd` (a fonte do `onEnd`) dispara quando a pessoa PARA
  // de falar, ANTES de o resultado final chegar. Tratar isso como fim de sessão
  // e já reagendar um novo `start` interrompia o reconhecimento a meio (o
  // seguinte `startListening` cancela/reinicia a sessão que ainda ia entregar
  // `onSpeechResults`) e caía em ERROR_CLIENT(5) / NO_MATCH(7) /
  // SERVER_DISCONNECTED(10) / LANGUAGE_NOT_SUPPORTED(11). Aqui só mexemos no
  // estado de escuta; quem decide o próximo passo é `onSpeechResults`
  // (`handleTranscription`) ou `onSpeechError` (`handleVoiceError`). O timer de
  // folga é a rede de segurança para o caso raro de o reconhecedor nunca
  // responder (aí sim repetimos como antes).
  const handleVoiceEnd = useCallback(() => {
    setListening(false);
    // Evento de uma sessão já abandonada (ex.: o `onEndOfSpeech` da ativação a
    // chegar durante o "Estou aqui", já com o modo em 'none'): ignorar. Antes
    // criava um timer de folga que abria um comando extra sobre o verdadeiro.
    if (voiceModeRef.current === 'none') {
      return;
    }
    clearSettleTimer();
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      sessionActiveRef.current = false;
      if (awaitingCommandRef.current) {
        endCommandListening();
        return;
      }
      voiceModeRef.current = wakeOnRef.current ? 'wake' : 'none';
      if (wakeOnRef.current && appActiveRef.current) {
        scheduleWakeCycle();
      }
    }, 2500);
  }, [clearSettleTimer, endCommandListening, scheduleWakeCycle]);

  const handleVoiceError = useCallback(() => {
    setListening(false);
    // Idem: erro de uma sessão que já não está ativa não deve mexer no fluxo
    // (senão reabria comando/ativação por cima do que está a acontecer).
    if (voiceModeRef.current === 'none') {
      return;
    }
    clearSettleTimer();
    sessionActiveRef.current = false;
    fallbackFromCommand();
  }, [clearSettleTimer, fallbackFromCommand]);

  const toggleWake = useCallback(() => {
    // efeitos fora do updater do setState: se o updater for re-invocado
    // (render interrompido), os timers e sessões seriam criados duas vezes
    const next = !wakeOnRef.current;
    wakeOnRef.current = next;
    setWakeOnState(next);
    AsyncStorage.setItem(WAKE_PREF_KEY, next ? '1' : '0').catch(() => {});
    if (next) {
      if (sessionActiveRef.current) {
        stopSession();
      }
      if (appActiveRef.current && voiceSupported) {
        clearWakeTimer();
        wakeTimerRef.current = setTimeout(() => {
          beginSession('wake');
        }, 300);
      }
    } else {
      clearWakeTimer();
      if (sessionActiveRef.current) {
        stopSession();
      }
      setListening(false);
    }
  }, [beginSession, clearWakeTimer, stopSession, voiceSupported]);

  toggleWakeRef.current = toggleWake;

  const toggleVoice = useCallback(async () => {
    clearWakeTimer();
    if (sessionActiveRef.current) {
      await stopSession();
      if (wakeOnRef.current) {
        beginSession('wake');
      }
      return;
    }
    if (!voiceSupported) {
      pushDebug('⚠️ voz indisponível (voiceSupported=false)');
      Alert.alert(
        t('as_voice_unavailable_title'),
        t('as_voice_unavailable_body'),
      );
      return;
    }
    const granted = await startListening();
    if (granted) {
      sessionActiveRef.current = true;
      voiceModeRef.current = 'manual';
      setListening(true);
    } else {
      setListening(false);
      pushDebug('⚠️ microfone manual não abriu');
      Alert.alert(
        t('as_mic_unavailable_title'),
        t('as_mic_unavailable_body'),
      );
    }
  }, [beginSession, clearWakeTimer, pushDebug, stopSession, voiceSupported, t]);

  const clear = useCallback(() => {
    setMessages([]);
    engineRef.current?.clearConversationHistory();
    stopSpeaking();
  }, []);

  const setContextData = useCallback((partial: Partial<AssistantContextData>) => {
    engineRef.current?.setContext(partial);
  }, []);

  const setActionHandler = useCallback((fn: (action: AssistantAction) => void) => {
    actionHandlerRef.current = fn;
  }, []);

  const handleSetOpen = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      stopSpeaking();
    }
  }, []);

  useEffect(() => {
    engineRef.current?.setLang(lang);
    setVoiceLanguage(lang);
  }, [lang]);

  useEffect(() => {
    let alive = true;
    // O silêncio do `muted` em `voice.ts` é estado de módulo e sobrevive a uma
    // remontagem do provider (fast refresh em desenvolvimento). O silêncio é
    // temporário e só de sessão, então o arranque parte sempre sem ele — senão
    // a tela diria "não silenciada" enquanto a voz continuava calada.
    setMuted(false);
    setMutedUntil(null);

    isVoiceAvailable()
      .then(ok => {
        if (alive) {
          setVoiceSupported(ok);
        }
      })
      .catch(() => {});

    listVoiceServices()
      .then(services => {
        if (alive && services.length > 0) {
          pushDebug(`🔎 motores de voz: ${services.join(', ')}`);
        }
      })
      .catch(() => {});

    migrateKey(LEGACY_WAKE_PREF_KEY, WAKE_PREF_KEY)
      .then(value => {
        if (!alive) {
          return;
        }
        const next = value !== '0';
        wakeOnRef.current = next;
        setWakeOnState(next);
        if (next && appActiveRef.current) {
          // guardado no ref para poder ser cancelado no cleanup, como todos
          // os outros wake timers
          clearWakeTimer();
          wakeTimerRef.current = setTimeout(() => {
            beginSession('wake');
          }, 1500);
        }
      })
      .catch(() => {});

    const detach = attachVoice({
      onResult: text => {
        pushDebug(`🎧 ouvi: ${text}`);
        handleTranscription(text);
      },
      onPartial: text => {
        pushDebug(`🎧 ...${text}`, true);
      },
      onStateChange: () => {},
      onError: code => {
        pushDebug(`⚠️ voz erro: ${code} (${voiceModeRef.current})`);
        const numeric = parseVoiceErrorCode(code);
        if (
          numeric !== null &&
          VOICE_ENGINE_FALLBACK_CODES.has(numeric) &&
          getVoiceEngine() !== 'GOOGLE'
        ) {
          setVoiceEngine('GOOGLE');
          pushDebug('↻ a tentar o motor Google');
        }
        handleVoiceError();
      },
      onEnd: () => {
        handleVoiceEnd();
      },
    });

    const appSub = AppState.addEventListener('change', state => {
      appActiveRef.current = state === 'active';
      if (state === 'background' || state === 'inactive') {
        clearWakeTimer();
        if (sessionActiveRef.current) {
          stopSession();
        }
        setListening(false);
      } else if (wakeOnRef.current) {
        clearWakeTimer();
        wakeTimerRef.current = setTimeout(() => {
          beginSession('wake');
        }, 1200);
      }
    });

    return () => {
      alive = false;
      detach();
      appSub.remove();
      clearWakeTimer();
      clearSettleTimer();
      clearUnmuteTimer();
      stopSession();
    };
  }, [
    beginSession,
    clearSettleTimer,
    clearWakeTimer,
    clearUnmuteTimer,
    handleTranscription,
    handleVoiceEnd,
    handleVoiceError,
    pushDebug,
    stopSession,
  ]);

  const value = useMemo<AssistantApi>(
    () => ({
      ready,
      voiceSupported,
      listening,
      wakeOn,
      toggleWake,
      mutedUntil,
      muteFor,
      unmute,
      open,
      setOpen: handleSetOpen,
      toggleVoice,
      messages,
      send,
      welcome,
      clear,
      setContextData,
      setActionHandler,
    }),
    [
      ready,
      voiceSupported,
      listening,
      wakeOn,
      toggleWake,
      mutedUntil,
      muteFor,
      unmute,
      open,
      handleSetOpen,
      toggleVoice,
      messages,
      send,
      welcome,
      clear,
      setContextData,
      setActionHandler,
    ],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
};

export const useAssistant = (): AssistantApi => {
  const ctx = useContext(AssistantContext);
  if (!ctx) {
    throw new Error('useAssistant deve ser usado dentro de AssistantProvider');
  }
  return ctx;
};

export { buildEmptyContext };