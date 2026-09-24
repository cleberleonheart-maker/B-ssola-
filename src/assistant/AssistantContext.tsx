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
  normalizeWakeText,
  speak,
  speakAndWait,
  startListening,
  stopListening,
  stopSpeaking,
  destroyVoice,
  setVoiceLanguage,
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

type AssistantApi = {
  ready: boolean;
  voiceSupported: boolean;
  listening: boolean;
  wakeOn: boolean;
  toggleWake: () => void;
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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendRef = useRef<(text: string) => Promise<void>>(async () => {});
  const initPromiseRef = useRef<Promise<void> | null>(null);

  const wakeOnRef = useRef(false);
  const appActiveRef = useRef(true);
  const sessionActiveRef = useRef(false);
  const awaitingCommandRef = useRef(false);
  const commandRetriesRef = useRef(0);
  const voiceModeRef = useRef<VoiceMode>('none');
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        const next =
          wakeCmd === 'off' ? false : !wakeOnRef.current;
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

  const stopSession = useCallback(async () => {
    sessionActiveRef.current = false;
    voiceModeRef.current = 'none';
    awaitingCommandRef.current = false;
    commandRetriesRef.current = 0;
    await destroyVoice();
    setListening(false);
  }, []);

  const beginSession = useCallback(
    async (mode: Exclude<VoiceMode, 'none' | 'manual'>) => {
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
      sessionActiveRef.current = true;
      voiceModeRef.current = mode;
      setListening(true);
      const started = await startListening();
      if (!started) {
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
    [clearWakeTimer, voiceSupported],
  );

  const wakeDetected = useCallback(async () => {
    clearWakeTimer();
    awaitingCommandRef.current = true;
    commandRetriesRef.current = 0;
    try {
      await stopListening();
    } catch {
      // ignore
    }
    sessionActiveRef.current = false;
    voiceModeRef.current = 'none';
    setListening(false);
    const phrase = t('as_wake_here');
    setOpen(true);
    setMessages(prev => [...prev, createMessage('assistant', phrase, true)]);
    await speakAndWait(phrase);
    if (awaitingCommandRef.current && appActiveRef.current) {
      beginSession('command');
    }
  }, [beginSession, clearWakeTimer, t]);

  const handleTranscription = useCallback(
    (text: string) => {
      const mode = voiceModeRef.current;
      if (!text) {
        return;
      }
      if (mode === 'wake') {
        const norm = normalizeWakeText(text);
        if (isWakeWord(norm)) {
          wakeDetected();
        }
        return;
      }
      if (mode === 'command') {
        commandRetriesRef.current = 0;
        awaitingCommandRef.current = false;
        clearWakeTimer();
        voiceModeRef.current = 'none';
        sendRef.current(text);
        return;
      }
      sendRef.current(text);
    },
    [clearWakeTimer, wakeDetected],
  );

  const scheduleWakeCycle = useCallback(() => {
    clearWakeTimer();
    wakeTimerRef.current = setTimeout(() => {
      beginSession('wake');
    }, 450);
  }, [beginSession, clearWakeTimer]);

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

const handleVoiceEnd = useCallback(() => {
  sessionActiveRef.current = false;
  setListening(false);
  if (awaitingCommandRef.current) {
    endCommandListening();
    return;
  }
  voiceModeRef.current = wakeOnRef.current ? 'wake' : 'none';
  if (wakeOnRef.current && appActiveRef.current) {
    scheduleWakeCycle();
  }
}, [endCommandListening, scheduleWakeCycle]);

const handleVoiceError = useCallback(() => {
  sessionActiveRef.current = false;
  setListening(false);
  fallbackFromCommand();
}, [fallbackFromCommand]);

  const toggleWake = useCallback(() => {
    setWakeOnState(prev => {
      const next = !prev;
      wakeOnRef.current = next;
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
      return next;
    });
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
      Alert.alert(
        t('as_mic_unavailable_title'),
        t('as_mic_unavailable_body'),
      );
    }
  }, [beginSession, clearWakeTimer, stopSession, voiceSupported, t]);

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
    isVoiceAvailable()
      .then(ok => {
        if (alive) {
          setVoiceSupported(ok);
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
          setTimeout(() => {
            beginSession('wake');
          }, 1500);
        }
      })
      .catch(() => {});

    const detach = attachVoice({
      onResult: handleTranscription,
      onStateChange: () => {},
      onError: () => {
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
      stopSession();
    };
  }, [
    beginSession,
    clearWakeTimer,
    handleTranscription,
    handleVoiceEnd,
    handleVoiceError,
    stopSession,
  ]);

  const value = useMemo<AssistantApi>(
    () => ({
      ready,
      voiceSupported,
      listening,
      wakeOn,
      toggleWake,
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