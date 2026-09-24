import { Platform, PermissionsAndroid } from 'react-native';
import Voice, {
  type SpeechResultsEvent,
  type SpeechErrorEvent,
} from '@react-native-community/voice';
import Tts from 'react-native-tts';
import type { Lang } from '../i18n/strings';

const VOICE_LANG_MAP: Record<Lang, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

let voiceLang: Lang = 'pt';

let ttsReady = false;

const noop = (): void => {};

export const setVoiceLanguage = (lang: Lang): void => {
  voiceLang = lang;
  if (ttsReady) {
    Tts.setDefaultLanguage(VOICE_LANG_MAP[lang]).catch(() => {});
  }
};

const ensureTts = async (): Promise<void> => {
  if (ttsReady) {
    return;
  }
  try {
    await Tts.getInitStatus();
    await Tts.setDefaultLanguage(VOICE_LANG_MAP[voiceLang]);
    await Tts.setDefaultRate(0.5);
    ttsReady = true;
  } catch {
    try {
      await Tts.requestInstallData();
    } catch {
      // sem motor de TTS disponível
    }
  }
};

export const speak = async (text: string): Promise<void> => {
  if (!text) {
    return;
  }
  try {
    await ensureTts();
    await Tts.stop();
    Tts.speak(text);
  } catch {
    // fala é opcional; silêncio não quebra o app
  }
};

export const speakAndWait = async (
  text: string,
  timeoutMs = 8000,
): Promise<void> => {
  if (!text) {
    return;
  }
  try {
    await ensureTts();
    await Tts.stop();
  } catch {
    // segue sem áudio
  }
  await new Promise<void>(resolve => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      if (timer) {
        clearTimeout(timer);
      }
      Tts.removeEventListener('tts-finish', finish);
      Tts.removeEventListener('tts-error', finish);
      Tts.removeEventListener('tts-cancel', finish);
      resolve();
    };
    timer = setTimeout(finish, timeoutMs);
    Tts.addEventListener('tts-finish', finish);
    Tts.addEventListener('tts-error', finish);
    Tts.addEventListener('tts-cancel', finish);
    try {
      Tts.speak(text);
    } catch {
      finish();
    }
  });
};

export const stopSpeaking = async (): Promise<void> => {
  try {
    await Tts.stop();
  } catch {
    // ignore
  }
};

export const requestMicPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Permissão de microfone',
        message:
          'A Kefera precisa do microfone para ouvir os seus comandos de voz.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Negar',
        buttonNeutral: 'Depois',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

export const isVoiceAvailable = async (): Promise<boolean> => {
  try {
    const available = (await Voice.isAvailable()) as number | boolean;
    return available === 1 || available === true;
  } catch {
    return false;
  }
};

export type VoiceHandlers = {
  onResult: (text: string) => void;
  onStateChange?: (listening: boolean) => void;
  onError?: (code: string) => void;
  onEnd?: () => void;
};

export const attachVoice = (handlers: VoiceHandlers): (() => void) => {
  Voice.onSpeechStart = () => handlers.onStateChange?.(true);
  Voice.onSpeechEnd = () => {
    handlers.onStateChange?.(false);
    handlers.onEnd?.();
  };
  Voice.onSpeechError = (e: SpeechErrorEvent) => {
    handlers.onStateChange?.(false);
    const raw =
      typeof e?.error === 'string'
        ? e.error
        : (e?.error?.code as string) ?? 'erro_de_voz';
    handlers.onError?.(raw);
  };
  Voice.onSpeechResults = (e: SpeechResultsEvent) => {
    const value = e?.value;
    if (value && value.length > 0 && value[0]) {
      handlers.onResult(value[0]);
    }
  };

  return () => {
    Voice.onSpeechStart = noop;
    Voice.onSpeechEnd = noop;
    Voice.onSpeechError = noop;
    Voice.onSpeechResults = noop;
  };
};

export const startListening = async (): Promise<boolean> => {
  const granted = await requestMicPermission();
  if (!granted) {
    return false;
  }
  try {
    await Voice.start(VOICE_LANG_MAP[voiceLang]);
    return true;
  } catch {
    return false;
  }
};

export const stopListening = async (): Promise<void> => {
  try {
    await Voice.stop();
  } catch {
    // ignore
  }
};

export const destroyVoice = async (): Promise<void> => {
  try {
    await Voice.destroy();
  } catch {
    // ignore
  }
};

export const isWakeWord = (normalizedText: string): boolean =>
  normalizedText.includes('kefera') ||
  normalizedText.includes('quefera') ||
  normalizedText.includes('kefera') ||
  normalizedText.includes('keferas') ||
  normalizedText.includes('kefega');

export const normalizeWakeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();