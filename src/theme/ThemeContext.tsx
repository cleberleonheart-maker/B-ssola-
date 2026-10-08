import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, THEME_OPTIONS, type ColorScheme, type ThemeName } from './themes';

const STORAGE_KEY = '@bussola/theme';

type ThemeContextType = {
  theme: ThemeName;
  colors: ColorScheme;
  setTheme: (theme: ThemeName) => void;
  themeOptions: typeof THEME_OPTIONS;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeName>('space');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => {
        // a lista de temas é a fonte da verdade: um tema novo não precisa de
        // ser reescrito aqui (o fallback continua no estado inicial 'space')
        const match = saved === null ? undefined : THEME_OPTIONS.find(o => o.key === saved);
        if (match) {
          setThemeState(match.key);
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      colors: themes[theme],
      setTheme,
      themeOptions: THEME_OPTIONS,
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }
  return ctx;
};

export const useThemeColors = () => useTheme().colors;