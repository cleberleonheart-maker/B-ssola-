import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import {
  checkLocationPermission,
  requestLocationPermission,
  openLocationSettings,
} from '../services/locationService';

const LocationGate = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [granted, setGranted] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    checkLocationPermission().then(status => {
      if (status === 'granted') {
        setGranted(true);
        setLoading(false);
      } else {
        setDenied(true);
        setLoading(false);
      }
    });
  }, []);

  const ask = useCallback(async () => {
    setLoading(true);
    setDenied(false);
    const status = await requestLocationPermission();
    if (status === 'granted') {
      setGranted(true);
    } else {
      setDenied(true);
    }
    setLoading(false);
  }, []);

  const openSettings = useCallback(() => {
    openLocationSettings();
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (granted) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Text style={styles.icon}>📍</Text>
      <Text style={[styles.title, { color: colors.text }]}>{t('locgate_need_title')}</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>
        {t('locgate_need_body')}
      </Text>
      <Pressable
        onPress={ask}
        style={[styles.button, { backgroundColor: colors.primary }]}>
        <Text style={styles.buttonText}>{t('locgate_allow')}</Text>
      </Pressable>
      {denied && (
        <View style={styles.deniedBox}>
          <Text style={[styles.deniedText, { color: colors.danger }]}>
            {t('locgate_denied')}
          </Text>
          <Pressable onPress={openSettings} style={styles.linkButton}>
            <Text style={[styles.linkText, { color: colors.primary }]}>
              {t('locgate_open')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 54,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  deniedBox: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  deniedText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  linkButton: {
    padding: spacing.sm,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default LocationGate;