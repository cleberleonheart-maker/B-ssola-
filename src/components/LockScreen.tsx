import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme, useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

type Props = {
  onUnlock: (pin: string) => boolean;
};

const LockScreen = ({ onUnlock }: Props) => {
  const { theme } = useTheme();
  const colors = useThemeColors();
  const { t } = useLanguage();
  const [entered, setEntered] = useState('');
  const [error, setError] = useState(false);

  const press = useCallback(
    (key: string) => {
      if (key === '⌫') {
        setEntered(prev => prev.slice(0, -1));
        setError(false);
        return;
      }
      if (key === '') return;
      if (entered.length >= 4) return;
      const next = entered + key;
      setEntered(next);
      setError(false);
      if (next.length === 4) {
        const ok = onUnlock(next);
        if (!ok) {
          setError(true);
          setTimeout(() => setEntered(''), 400);
        }
      }
    },
    [entered, onUnlock],
  );

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <Text style={styles.icon}>🧭</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('lock_screen_title')}
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {t('lock_screen_sub')}
        </Text>

        <View style={styles.dots}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i < entered.length ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>

        {error && (
          <Text style={[styles.errorText, { color: colors.danger }]}>
            {t('lock_pin_wrong')}
          </Text>
        )}

        <View style={styles.keypad}>
          {KEYS.map((key, i) => (
            <Pressable
              key={`${key}-${i}`}
              onPress={() => press(key)}
              disabled={key === ''}
              style={({ pressed }) => [
                styles.key,
                {
                  backgroundColor: pressed
                    ? colors.surfaceAlt
                    : theme === 'dark'
                      ? colors.surface
                      : '#0000000c',
                },
                key === '' && styles.keyEmpty,
              ]}>
              {key !== '' && (
                <Text style={[styles.keyText, { color: colors.text }]}>
                  {key}
                </Text>
              )}
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              setEntered('');
              setError(false);
            }}
            style={({ pressed }) => [
              styles.clearButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}>
            <Text style={[styles.clearText, { color: colors.textMuted }]}>
              {t('lock_clear')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const keyGrid: StyleProp<ViewStyle> = {
  flexDirection: 'row',
  flexWrap: 'wrap',
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  sub: {
    fontSize: 14,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginHorizontal: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.md,
    height: 18,
  },
  keypad: {
    ...keyGrid,
    width: 264,
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  key: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    margin: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '700',
  },
  clearButton: {
    marginTop: spacing.xl,
    alignSelf: 'center',
    padding: spacing.sm,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

export default LockScreen;