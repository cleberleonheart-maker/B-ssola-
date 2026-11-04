import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CompassScreen from './src/screens/CompassScreen';
import { ThemeProvider, useThemeColors, useTheme } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { AssistantProvider } from './src/assistant/AssistantContext';
import AssistantModal from './src/components/AssistantModal';
import WhatsNewModal from './src/components/WhatsNewModal';
import { CrashBoundary } from './src/components/CrashBoundary';
import UpdateAvailableModal from './src/components/UpdateAvailableModal';
import LocationGate from './src/components/LocationGate';
import LockScreen from './src/components/LockScreen';
import { loadLockBiometric, loadLockPin } from './src/services/preferencesService';
import { shouldRelock } from './src/utils/appLock';
import {
  loadChangelogSeen,
  markChangelogSeen,
} from './src/services/changelogSeen';
import { APP_VERSION_CODE } from './src/version.generated';
import {
  checkForUpdate,
  rememberUpdateOffer,
  type AvailableUpdate,
} from './src/services/versionService';

function Root() {
  const colors = useThemeColors();
  const { theme } = useTheme();
  const [showUpdate, setShowUpdate] = useState(false);
  const [changelogFrom, setChangelogFrom] = useState<number | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(
    null,
  );
  const [lock, setLock] = useState<{
    pin: string | null;
    unlocked: boolean;
    biometric: boolean;
  }>({
    pin: null,
    unlocked: true,
    biometric: true,
  });
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([loadLockPin(), loadLockBiometric()]).then(([pin, biometric]) =>
      setLock({ pin, unlocked: pin == null, biometric }),
    );
  }, []);

  // Voltar a trancar ao voltar do fundo: o bloqueio que só existe na
  // abertura não protege nada quando o telemóvel é emprestado com o app
  // aberto. A janela de tolerância está em `shouldRelock`.
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next !== 'active' || backgroundedAt.current == null) return;
      const at = backgroundedAt.current;
      backgroundedAt.current = null;
      setLock(prev => {
        if (!shouldRelock({ hasPin: prev.pin != null, backgroundedAt: at, now: Date.now() })) {
          return prev;
        }
        return { ...prev, unlocked: false };
      });
      // A biometria pode ter sido desligada nas Configurações enquanto o app
      // estava em segundo plano: relê-la evita destrancar com o dedo quando o
      // utilizador já não quer isso.
      void loadLockBiometric().then(biometric =>
        setLock(prev => (prev.biometric === biometric ? prev : { ...prev, biometric })),
      );
    });
    return () => sub.remove();
  }, []);

  const handleUnlock = useCallback(
    (entered: string): boolean => {
      // A string vazia é o atalho da biometria: só passa se ela estiver ligada.
      const viaBiometric = entered === '' && lock.biometric;
      if (lock.pin !== null && (entered === lock.pin || viaBiometric)) {
        setLock(prev => ({ ...prev, unlocked: true }));
        return true;
      }
      return false;
    },
    [lock.biometric, lock.pin],
  );

  useEffect(() => {
    loadChangelogSeen().then(from => {
      if (from !== APP_VERSION_CODE) {
        setChangelogFrom(from);
        setShowUpdate(true);
      }
    });
  }, []);

  // Marcar no fechar, e não no abrir: se o processo morre com o modal na tela,
  // o intervalo de versões continua guardado e aparece de novo.
  const closeWhatsNew = useCallback(() => {
    setShowUpdate(false);
    setChangelogFrom(null);
    markChangelogSeen(APP_VERSION_CODE);
  }, []);

  useEffect(() => {
    checkForUpdate().then(update => {
      if (update) {
        rememberUpdateOffer(update.versionCode);
        setAvailableUpdate(update);
      }
    });
  }, []);

  const closeUpdate = useCallback(() => {
    if (availableUpdate) {
      rememberUpdateOffer(availableUpdate.versionCode);
    }
    setAvailableUpdate(null);
  }, [availableUpdate]);

  return (
    <LocationGate>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar
          barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        />
        {lock.unlocked ? <CompassScreen /> : null}
        <WhatsNewModal
          visible={showUpdate}
          lastSeen={changelogFrom}
          onClose={closeWhatsNew}
        />
        <UpdateAvailableModal
          visible={availableUpdate !== null}
          versionName={availableUpdate?.versionName ?? ''}
          updateUrl={availableUpdate?.updateUrl ?? ''}
          message={availableUpdate?.message ?? null}
          required={availableUpdate?.required ?? false}
          apkSha256={availableUpdate?.apkSha256 ?? null}
          hashConflict={availableUpdate?.hashConflict ?? false}
          onClose={closeUpdate}
        />
        {lock.pin !== null && !lock.unlocked && (
          <LockScreen onUnlock={handleUnlock} biometricEnabled={lock.biometric} />
        )}
      </View>
    </LocationGate>
  );
}

function App() {
  return (
    <CrashBoundary>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            <AssistantProvider>
              <Root />
              <AssistantModal />
            </AssistantProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </CrashBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;