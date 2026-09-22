import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
  ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import {
  toDMS,
  toUTM,
  formatUTM,
  googleMapsUrl,
  wazeUrl,
  openLink,
} from '../utils/coords';
import { formatCoord } from '../utils/compass';

type Props = {
  visible: boolean;
  onClose: () => void;
  latitude: number;
  longitude: number;
  altitude: number | null;
};

const CoordModal = ({ visible, onClose, latitude, longitude, altitude }: Props) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const rows = useMemo(() => {
    const deg = `${(latitude >= 0 ? '' : '-') + Math.abs(latitude).toFixed(6)}, ${(longitude >= 0 ? '' : '-') + Math.abs(longitude).toFixed(6)}`;
    const dms = `${toDMS(latitude, true)}, ${toDMS(longitude, false)}`;
    const utm = toUTM(latitude, longitude);
    const utmText = utm ? formatUTM(utm) : '—';
    return [
      { label: t('cf_decimal'), value: deg, mono: true },
      { label: t('cf_dms'), value: dms, mono: true },
      { label: 'UTM (WGS84)', value: utmText, mono: true },
      {
        label: t('ui_altitude'),
        value: altitude != null ? `${Math.round(altitude)} m` : '—',
        mono: false,
      },
    ];
  }, [latitude, longitude, altitude, t]);

  const share = () => {
    Share.share({
      message: `${formatCoord(latitude, true)} · ${formatCoord(longitude, false)}\n${toDMS(latitude, true)}, ${toDMS(longitude, false)}\nUTM ${rows[2]?.value ?? ''}`,
    }).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('cf_title')}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {rows.map(row => (
              <View
                key={row.label}
                style={[styles.row, { borderColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>
                  {row.label}
                </Text>
                <Text
                  style={[
                    styles.rowValue,
                    row.mono && styles.rowMono,
                    { color: colors.text },
                  ]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={share}
              style={[styles.actionButton, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.actionIcon, { color: colors.text }]}>📤</Text>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                {t('cf_share')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openLink(googleMapsUrl(latitude, longitude))}
              style={[styles.actionButton, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.actionIcon, { color: colors.text }]}>🗺</Text>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                Google Maps
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openLink(wazeUrl(latitude, longitude))}
              style={[styles.actionButton, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.actionIcon, { color: colors.text }]}>🚗</Text>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                Waze
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    fontSize: 18,
  },
  row: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  rowMono: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  actionIcon: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
});

export default CoordModal;