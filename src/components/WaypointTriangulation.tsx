import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { normalizeHeading } from '../utils/compass';
import { intersectRays } from '../utils/triangulate';
import { formatDistance } from '../utils/geo';

type Ray = { lat: number; lon: number; bearing: number };

type Props = {
  heading: number;
  latitude: number;
  longitude: number;
  hasFix: boolean;
  declinationEnabled: boolean;
  declinationDegrees: number;
  waypoints: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  onAddWaypoint: (wp: { name: string; latitude: number; longitude: number }) => void;
};

const trueBearingOf = (displayHeading: number, declEnabled: boolean, declDegrees: number) =>
  normalizeHeading(displayHeading + (declEnabled ? 0 : declDegrees));

const dist = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sa = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
};

export const WaypointTriangulation = ({
  heading,
  latitude,
  longitude,
  hasFix,
  declinationEnabled,
  declinationDegrees,
  waypoints,
  onAddWaypoint,
}: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [rays, setRays] = useState<Ray[]>([]);
  const [target, setTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [name, setName] = useState('');
  const [added, setAdded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const record = useCallback(() => {
    if (!hasFix || waypoints.length === 0) return;
    if (rays.length >= 2) return;
    const bearing = trueBearingOf(heading, declinationEnabled, declinationDegrees);
    setRays(prev => [...prev, { lat: latitude, lon: longitude, bearing }]);
    setErr(null);
    setTarget(null);
    setAdded(false);
  }, [hasFix, waypoints.length, rays.length, heading, declinationEnabled, declinationDegrees, latitude, longitude]);

  const calc = useCallback(() => {
    if (rays.length < 2) return;
    const res = intersectRays({ point: { lat: rays[0].lat, lon: rays[0].lon }, bearing: rays[0].bearing }, { point: { lat: rays[1].lat, lon: rays[1].lon }, bearing: rays[1].bearing });
    if (!res) {
      setErr(t('tri_parallel'));
      setTarget(null);
      return;
    }
    setTarget(res);
    setErr(null);
  }, [rays, t]);

  const add = useCallback(() => {
    if (!target) return;
    const label = name.trim() || t('tri_default_name');
    onAddWaypoint({ name: label, latitude: target.lat, longitude: target.lon });
    setAdded(true);
  }, [target, name, onAddWaypoint, t]);

  const reset = useCallback(() => {
    setRays([]);
    setTarget(null);
    setErr(null);
    setAdded(false);
    setName('');
  }, []);

  if (!hasFix) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>{t('tri_wp_title')}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('tri_no_gps')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('tri_wp_title')}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('tri_wp_hint')}</Text>
      <Pressable disabled={rays.length >= 2} onPress={record} style={[styles.btn, { backgroundColor: rays.length >= 2 ? colors.surfaceAlt : colors.primary }]}>
        <Text style={[styles.btnText, { color: rays.length >= 2 ? colors.textMuted : colors.background }]}>{rays.length === 0 ? t('tri_sight1') : t('tri_sight2')}</Text>
      </Pressable>
      {rays.length === 2 && !target && (
        <Pressable onPress={calc} style={[styles.btn, { backgroundColor: colors.surfaceAlt, marginTop: spacing.sm }]}>
          <Text style={[styles.btnText, { color: colors.text }]}>{t('tri_calc')}</Text>
        </Pressable>
      )}
      {err && <Text style={[styles.err, { color: colors.warning }]}>{err}</Text>}
      {target && (
        <View style={[styles.box, { borderColor: colors.success + '55' }]}>
          <Text style={[styles.txt, { color: colors.text }]}>{target.lat.toFixed(6)}, {target.lon.toFixed(6)}</Text>
          {!added ? (
            <>
              <TextInput value={name} onChangeText={setName} placeholder={t('tri_default_name')} placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
              <Pressable onPress={add} style={[styles.btn, { backgroundColor: colors.primary, marginTop: spacing.sm }]}>
                <Text style={[styles.btnText, { color: colors.background }]}>{t('tri_add')}</Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.ok, { color: colors.success }]}>{t('tri_added')}</Text>
          )}
        </View>
      )}
      {(rays.length > 0 || target) && (
        <Pressable onPress={reset} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.textMuted, textAlign: 'center' }}>{t('tri_reset')}</Text>
        </Pressable>
      )}
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { padding: spacing.lg },
    title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
    hint: { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
    btn: { padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
    btnText: { fontWeight: '800' },
    box: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
    txt: { textAlign: 'center' },
    input: { marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm },
    err: { textAlign: 'center', marginTop: spacing.md },
    ok: { textAlign: 'center', marginTop: spacing.sm, fontWeight: '700' },
  });

export default WaypointTriangulation;
