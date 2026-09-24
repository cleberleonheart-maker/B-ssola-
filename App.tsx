import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CompassScreen from './src/screens/CompassScreen';
import { ThemeProvider, useThemeColors, useTheme } from './src/theme/ThemeContext';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { AssistantProvider } from './src/assistant/AssistantContext';
import AssistantModal from './src/components/AssistantModal';
import WhatsNewModal from './src/components/WhatsNewModal';
import UpdateAvailableModal from './src/components/UpdateAvailableModal';
import LocationGate from './src/components/LocationGate';
import LockScreen from './src/components/LockScreen';
import { loadLockPin } from './src/services/preferencesService';
import { APP_VERSION_CODE } from './src/version.generated';
import {
  checkForUpdate,
  rememberUpdateOffer,
  type AvailableUpdate,
} from './src/services/versionService';

const VERSION_SEEN_KEY = '@bussola/versionSeen';

function Root() {
  const colors = useThemeColors();
  const { theme } = useTheme();
  const [showUpdate, setShowUpdate] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(
    null,
  );
  const [lock, setLock] = useState<{ pin: string | null; unlocked: boolean }>({
    pin: null,
    unlocked: true,
  });

  useEffect(() => {
    loadLockPin().then(pin =>
      setLock({ pin, unlocked: pin == null }),
    );
  }, []);

  const handleUnlock = useCallback(
    (entered: string): boolean => {
      if (lock.pin !== null && entered === lock.pin) {
        setLock(prev => ({ ...prev, unlocked: true }));
        return true;
      }
      return false;
    },
    [lock.pin],
  );

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(VERSION_SEEN_KEY);
        if (raw === null || parseInt(raw, 10) !== APP_VERSION_CODE) {
          setShowUpdate(true);
        }
      } catch {
        // ignore storage errors
      }
      try {
        await AsyncStorage.setItem(VERSION_SEEN_KEY, String(APP_VERSION_CODE));
      } catch {
        // ignore storage errors
      }
    })();
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
          onClose={() => setShowUpdate(false)}
        />
        <UpdateAvailableModal
          visible={availableUpdate !== null}
          versionName={availableUpdate?.versionName ?? ''}
          updateUrl={availableUpdate?.updateUrl ?? ''}
          message={availableUpdate?.message ?? null}
          required={availableUpdate?.required ?? false}
          onClose={closeUpdate}
        />
        {lock.pin !== null && !lock.unlocked && (
          <LockScreen onUnlock={handleUnlock} />
        )}
      </View>
    </LocationGate>
  );
}

function App() {
  return (
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;