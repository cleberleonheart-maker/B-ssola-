import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { Animated, AppState, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  themes,
  THEME_OPTIONS,
  type ColorScheme,
  type ThemeName,
} from './themes';
import {
  resolveAutoTheme,
  isThemeAutoMode,
  type ThemeAutoMode,
} from './themeAuto';
import { getLastLocation } from '../services/lastLocation';

const STORAGE_KEY = '@bussola/theme';
const AUTO_MODE_KEY = '@bussola/themeAutoMode';
const FADE_MS = 250;

/** A preferência guardada: um tema concreto ou o automático. */
export type ThemePreference = ThemeName | 'auto';

type ThemeContextType = {
  /** O tema efetivo (o que o automático resolveu, ou o escolhido à mão). */
  theme: ThemeName;
  /** O que o utilizador escolheu, que pode ser `auto`. */
  preference: ThemePreference;
  autoMode: ThemeAutoMode;
  colors: ColorScheme;
  setTheme: (preference: ThemePreference) => void;
  setAutoMode: (mode: ThemeAutoMode) => void;
  themeOptions: typeof THEME_OPTIONS;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPreference] = useState<ThemePreference>('space');
  const [autoMode, setAutoModeState] = useState<ThemeAutoMode>('scheduleLight');
  const [active, setActive] = useState<ThemeName>('space');
  // Um "relógio" que só existe para forçar o recálculo do automático: muda de
  // minuto a minuto e quando a app volta ao primeiro plano.
  const [clock, setClock] = useState(() => Date.now());
  const [fadeColor, setFadeColor] = useState<string>(themes.space.background);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(AUTO_MODE_KEY)])
      .then(([savedTheme, savedMode]) => {
        let pref: ThemePreference = 'space';
        if (savedTheme === 'auto') {
          pref = 'auto';
        } else {
          // A lista de temas é a fonte da verdade: um tema novo não precisa de
          // ser reescrito aqui.
          const match = savedTheme === null ? undefined : THEME_OPTIONS.find(o => o.key === savedTheme);
          if (match) pref = match.key;
        }
        const mode = isThemeAutoMode(savedMode) ? savedMode : 'scheduleLight';
        // Atualizações com bail-out: sem nada gravado, os valores são os de
        // partida e nada muda — e um `setState` que não muda nada não agenda
        // render nenhum (nem o aviso de `act` nos testes).
        setPreference(prev => (prev === pref ? prev : pref));
        setAutoModeState(prev => (prev === mode ? prev : mode));
        const resolved =
          pref === 'auto' ? resolveAutoTheme(mode, new Date(), getLastLocation()) : pref;
        setActive(prev => (prev === resolved ? prev : resolved));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (preference !== 'auto') return;
    const id = setInterval(() => setClock(Date.now()), 60000);
    const sub = AppState.addEventListener('change', state => {
      // Os timers param em segundo plano: voltar ao primeiro plano é o momento
      // em que o "é dia?" pode estar desatualizado há horas.
      if (state === 'active') setClock(Date.now());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [preference]);

  const desired = useMemo<ThemeName>(
    () =>
      preference === 'auto'
        ? resolveAutoTheme(autoMode, new Date(clock), getLastLocation())
        : preference,
    [preference, autoMode, clock],
  );

  useEffect(() => {
    if (desired === active) return;
    // O tema novo entra já; por cima fica a cor de fundo do antigo, que esmaece
    // — é a "transição suave" da ideia, e não um corte seco nas cores.
    setFadeColor(themes[active].background);
    fade.setValue(1);
    setActive(desired);
    Animated.timing(fade, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [desired, active, fade]);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const setAutoMode = useCallback((mode: ThemeAutoMode) => {
    setAutoModeState(mode);
    // Trocar a estratégia é um pedido para reavaliar já, não no próximo minuto.
    setClock(Date.now());
    AsyncStorage.setItem(AUTO_MODE_KEY, mode).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme: active,
      preference,
      autoMode,
      colors: themes[active],
      setTheme,
      setAutoMode,
      themeOptions: THEME_OPTIONS,
    }),
    [active, preference, autoMode, setTheme, setAutoMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: fadeColor, opacity: fade }]}
        />
      </View>
    </ThemeContext.Provider>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }
  return ctx;
};

export const useThemeColors = () => useTheme().colors;
