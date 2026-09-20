import { useEffect, useRef } from 'react';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_KEY = '@bussola/sensorsSound';

type BeepNative = {
  tone?: (frequency: number, durationMs: number) => void;
  stop?: () => void;
};

const Beep = (NativeModules as { Beep?: BeepNative }).Beep ?? null;

export const soundAvailable = !!Beep;

let muted = false;

export const setSoundMuted = (next: boolean) => {
  muted = next;
  if (next) {
    stopBeep();
  }
};

export const getSoundMuted = () => muted;

export const loadSoundPref = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(SOUND_KEY);
    const next = raw !== 'off';
    muted = !next;
    return next;
  } catch {
    return true;
  }
};

export const saveSoundPref = async (enabled: boolean) => {
  muted = !enabled;
  try {
    await AsyncStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
  } catch {
    // ignore storage errors
  }
  if (!enabled) {
    stopBeep();
  }
};

const clampFreq = (frequency: number) =>
  Math.max(80, Math.min(5000, Math.round(frequency)));

export const beep = (frequency: number, durationMs = 40) => {
  if (muted || !Beep?.tone) {
    return;
  }
  try {
    Beep.tone(clampFreq(frequency), Math.max(10, Math.min(durationMs, 4000)));
  } catch {
    // ignore native failures
  }
};

export const stopBeep = () => {
  if (!Beep?.stop) {
    return;
  }
  try {
    Beep.stop();
  } catch {
    // ignore native failures
  }
};

type BeepRateOptions = {
  intervalMs: number;
  frequency: number;
  enabled: boolean;
  durationMs?: number;
};

export const useRepetitiveBeep = ({
  intervalMs,
  frequency,
  enabled,
  durationMs = 30,
}: BeepRateOptions) => {
  const paramsRef = useRef({ intervalMs, frequency });
  paramsRef.current = { intervalMs, frequency };

  useEffect(() => {
    if (!enabled || muted) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = () => {
      const { intervalMs: ms, frequency: f } = paramsRef.current;
      const safeMs = Math.max(20, ms);
      const dur = Math.min(durationMs, Math.max(10, safeMs - 5));
      beep(f, dur);
      timer = setTimeout(loop, safeMs);
    };
    timer = setTimeout(loop, Math.max(20, paramsRef.current.intervalMs));
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      stopBeep();
    };
  }, [enabled, durationMs]);
};