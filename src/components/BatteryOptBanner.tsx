import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimizations, openBatteryOptimizationSettings } from '../services/batteryOpt';

const HIDE_KEY = '@bussola/batopt_hide';

const BatteryOptBanner = () => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const hide = await AsyncStorage.getItem(HIDE_KEY);
        if (hide === '1') return;
        const ignoring = await isIgnoringBatteryOptimizations();
        if (mounted && ignoring === false) {
          setShow(true);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!show) return null;

  const handleAllow = async () => {
    await requestIgnoreBatteryOptimizations();
    // check again shortly
    setTimeout(async () => {
      const ignoring = await isIgnoringBatteryOptimizations();
      if (ignoring === true) {
        setShow(false);
        await AsyncStorage.setItem(HIDE_KEY, '1');
      }
    }, 1000);
  };

  const handleHide = async () => {
    setShow(false);
    await AsyncStorage.setItem(HIDE_KEY, '1');
  };

  const handleSettings = async () => {
    await openBatteryOptimizationSettings();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.warning + '22', borderColor: colors.warning }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('batopt_title')}</Text>
      <Text style={[styles.desc, { color: colors.textMuted }]}>{t('batopt_desc')}</Text>
      <View style={styles.row}>
        <Pressable onPress={handleAllow} style={[styles.btn, { backgroundColor: colors.primary }]}>
          <Text style={styles.btnText}>{t('batopt_allow')}</Text>
        </Pressable>
        <Pressable onPress={handleSettings} style={[styles.btnAlt, { borderColor: colors.border }]}>
          <Text style={[styles.btnAltText, { color: colors.text }]}>{t('batopt_settings')}</Text>
        </Pressable>
        <Pressable onPress={handleHide}>
          <Text style={[styles.hide, { color: colors.textMuted }]}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  desc: {
    fontSize: 12,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  btnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  btnAlt: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  btnAltText: {
    fontSize: 12,
    fontWeight: '800',
  },
  hide: {
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: spacing.xs,
  },
});

export default BatteryOptBanner;
