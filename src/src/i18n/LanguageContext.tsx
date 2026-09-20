import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGS, Lang, createTranslator, Translator } from './strings';
import { migrateKey } from '../utils/storage';

const LANG_KEY = '@bussola/kefera/lang';
const LEGACY_LANG_KEY = '@bussola/virgin/lang';

interface LanguageContextData {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translator;
}

const LanguageContext = createContext<LanguageContextData | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Lang>('pt');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await migrateKey(LEGACY_LANG_KEY, LANG_KEY);
        if (mounted && stored && LANGS.some(l => l.key === stored)) {
          setLangState(stored as Lang);
        }
      } catch {
        // ignore storage errors
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(LANG_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<LanguageContextData>(
    () => ({ lang, setLang, t: createTranslator(lang) }),
    [lang, setLang],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextData => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
};