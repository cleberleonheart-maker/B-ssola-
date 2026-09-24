import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { formatDistance } from '../utils/geo';
import { normalizeHeading, formatTime } from '../utils/compass';

type Sight = {
  lat: number;
  lon: number;
  bearing: number;
  heading: number;
  t: number;
};

type Props = {
  heading: number;
  latitude: number;
  longitude: number;
  hasFix: boolean;
  declinationEnabled: boolean;
  declinationDegrees: number;
  onAdd: (wp: { name: string; latitude: number; longitude: number }) => void;
};

const trueBearingOf = (
  displayHeading: number,
  declEnabled: boolean,
  declDegrees: number,
) =>
  normalizeHeading(displayHeading + (declEnabled ? 0 : declDegrees));

const intersect = (
  a: Sight,
  b: Sight,
): { lat: number; lon: number; d1: number; d2: number } | null => {
  const lat0 = (a.lat + b.lat) / 2;
  const lon0 = (a.lon + b.lon) / 2;
  const m = Math.cos((lat0 * Math.PI) / 180);
  const p1 = { e: (a.lon - lon0) * 111000 * m, n: (a.lat - lat0) * 111000 };
  const p2 = { e: (b.lon - lon0) * 111000 * m, n: (b.lat - lat0) * 111000 };
  const rad1 = (a.bearing * Math.PI) / 180;
  const rad2 = (b.bearing * Math.PI) / 180;
  const u1 = { e: Math.sin(rad1), n: Math.cos(rad1) };
  const u2 = { e: Math.sin(rad2), n: Math.cos(rad2) };
  const cross = u1.e * u2.n - u1.n * u2.e;
  if (Math.abs(cross) < 1e-6) return null;
  const vec = { e: p2.e - p1.e, n: p2.n - p1.n };
  const t1 = (vec.e * u2.n - vec.n * u2.e) / cross;
  const t2 = (vec.e * u1.n - vec.n * u1.e) / cross;
  if (t1 < 0 || t2 < 0) return null;
  const T = { e: p1.e + t1 * u1.e, n: p1.n + t1 * u1.n };
  return {
    lat: lat0 + T.n / 111000,
    lon: lon0 + T.e / (111000 * m),
    d1: Math.hypot(T.e - p1.e, T.n - p1.n),
    d2: Math.hypot(T.e - p2.e, T.n - p2.n),
  };
};

export const TriangulationView = ({
  heading,
  latitude,
  longitude,
  hasFix,
  declinationEnabled,
  declinationDegrees,
  onAdd,
}: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [sights, setSights] = useState<Sight[]>([]);
  const [result, setResult] = useState<{
    lat: number;
    lon: number;
    d1: number;
    d2: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [name, setName] = useState('');

  const recordSight = useCallback(() => {
    if (!hasFix) return;
    if (sights.length >= 2) return;
    const sight: Sight = {
      lat: latitude,
      lon: longitude,
      bearing: trueBearingOf(heading, declinationEnabled, declinationDegrees),
      heading,
      t: Date.now(),
    };
    const next = [...sights, sight];
    setSights(next);
    setError(null);
    setResult(null);
    setAdded(false);
    if (next.length === 2) {
      const res = intersect(next[0], next[1]);
      if (!res) {
        setError(t('tri_parallel'));
      } else {
        setResult(res);
      }
    }
  }, [hasFix, latitude, longitude, heading, declinationEnabled, declinationDegrees, sights, t]);

  const reset = useCallback(() => {
    setSights([]);
    setResult(null);
    setError(null);
    setAdded(false);
  }, []);

  const add = useCallback(() => {
    if (!result) return;
    const label =
      name.trim().length > 0 ? name.trim() : t('tri_default_name');
    onAdd({ name: label, latitude: result.lat, longitude: result.lon });
    setAdded(true);
  }, [result, name, onAdd, t]);

  if (!hasFix) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>{t('tri_title')}</Text>
        <Text style={styles.emoji}>📐</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('tri_no_gps')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('tri_title')}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('tri_hint')}
      </Text>

      <Pressable
        disabled={sights.length >= 2}
        onPress={recordSight}
        style={[
          styles.sightButton,
          {
            backgroundColor:
              sights.length >= 2 ? colors.surfaceAlt : colors.primary,
          },
        ]}>
        <Text
          style={[
            styles.sightButtonText,
            { color: sights.length >= 2 ? colors.textMuted : colors.background },
          ]}>
          {sights.length === 0 ? t('tri_sight1') : t('tri_sight2')} ·{' '}
          {Math.round(heading).toString().padStart(3, '0')}°
        </Text>
      </Pressable>

      {sights.map((s, idx) => (
        <View
          key={idx}
          style={[styles.sightRow, { borderColor: colors.border }]}>
          <Text style={[styles.sightText, { color: colors.text }]}>
            {t('tri_recorded', {
              n: idx + 1,
              deg: Math.round(s.heading),
              time: formatTime(s.t),
            })}
          </Text>
        </View>
      ))}

      {error && (
        <Text style={[styles.error, { color: colors.warning }]}>{error}</Text>
      )}

      {result && (
        <View style={[styles.resultBox, { borderColor: colors.success + '55' }]}>
          <Text style={[styles.resultText, { color: colors.text }]}>
            {t('tri_result', {
              lat: result.lat.toFixed(6),
              lon: result.lon.toFixed(6),
              d1: formatDistance(result.d1),
              d2: formatDistance(result.d2),
            })}
          </Text>
          {!added ? (
            <>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('tri_default_name')}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.nameInput,
                  { borderColor: colors.border, color: colors.text },
                ]}
              />
              <Pressable
                onPress={add}
                style={[styles.addButton, { backgroundColor: colors.success }]}>
                <Text style={[styles.addButtonText, { color: colors.background }]}>
                  {t('tri_add')}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.added, { color: colors.success }]}>
              {t('tri_added')}
            </Text>
          )}
        </View>
      )}

      <Pressable
        onPress={reset}
        style={[styles.resetButton, { borderColor: colors.border }]}>
        <Text style={[styles.resetText, { color: colors.textMuted }]}>
          {t('tri_reset')}
        </Text>
      </Pressable>
    </View>
  );
};

const createStyles = (_colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.lg,
      alignSelf: 'stretch',
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    hint: {
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    emoji: {
      fontSize: 44,
      textAlign: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    sightButton: {
      alignSelf: 'center',
      borderRadius: radius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
    },
    sightButtonText: {
      fontSize: 15,
      fontWeight: '800',
    },
    sightRow: {
      alignSelf: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    sightText: {
      fontSize: 13,
      fontWeight: '700',
    },
    error: {
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: spacing.md,
    },
    resultBox: {
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    resultText: {
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 19,
    },
    nameInput: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
      fontSize: 14,
    },
    addButton: {
      alignSelf: 'center',
      borderRadius: radius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '800',
    },
    added: {
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    resetButton: {
      alignSelf: 'center',
      borderRadius: radius.full,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      marginTop: spacing.sm,
    },
    resetText: {
      fontSize: 12,
      fontWeight: '800',
    },
  });

export default TriangulationView;