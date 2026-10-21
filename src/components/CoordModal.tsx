import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
  ScrollView,
  Clipboard,
  Alert,
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
import { formatAltitude } from '../utils/units';

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
  const [qrOpen, setQrOpen] = useState(false);

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
        value: altitude != null ? formatAltitude(altitude) : '—',
        mono: false,
      },
    ];
  }, [latitude, longitude, altitude, t]);

  const share = () => {
    Share.share({
      message: `${formatCoord(latitude, true)} · ${formatCoord(longitude, false)}\n${toDMS(latitude, true)}, ${toDMS(longitude, false)}\nUTM ${rows[2]?.value ?? ''}`,
    }).catch(() => {});
  };

  const qrText = `geo:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const shareQr = () => {
    Share.share({ message: qrText }).catch(() => {});
  };
  const copyQr = () => {
    Clipboard.setString(qrText);
    Alert.alert(t('cf_copied_title'), t('cf_copied_msg'));
  };

  const copy = (value: string) => {
    if (!value || value === '—') {
      return;
    }
    Clipboard.setString(value);
    Alert.alert(t('cf_copied_title'), t('cf_copied_msg'));
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
              <Pressable
                key={row.label}
                onPress={() => copy(row.value)}
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
                <Text style={[styles.copyHint, { color: colors.textMuted }]}>
                  {t('cf_copy_hint')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={() => setQrOpen(true)}
              style={[styles.actionButton, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.actionIcon, { color: colors.text }]}>🔲</Text>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                QR
              </Text>
            </Pressable>
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
      <Modal
        visible={qrOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setQrOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setQrOpen(false)}>
          <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('cf_qr_title')}
              </Text>
              <Pressable onPress={() => setQrOpen(false)} style={styles.closeButton}>
                <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
              </Pressable>
            </View>
            <Text style={[styles.qrText, { color: colors.text }]}>{qrText}</Text>
            <Text style={[styles.qrHint, { color: colors.textMuted }]}>
              {t('cf_qr_hint')}
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={copyQr}
                style={[styles.actionButton, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.actionIcon, { color: colors.text }]}>📋</Text>
                <Text style={[styles.actionLabel, { color: colors.text }]}>
                  {t('cf_copy')}
                </Text>
              </Pressable>
              <Pressable
                onPress={shareQr}
                style={[styles.actionButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.actionIcon, { color: colors.background }]}>📤</Text>
                <Text style={[styles.actionLabel, { color: colors.background }]}>
                  {t('cf_share')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  copyHint: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: spacing.xs,
    textTransform: 'uppercase',
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
    fontWeight: '700',
  },
  qrText: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: spacing.lg,
    fontVariant: ['tabular-nums'],
  },
  qrHint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
});

export default CoordModal;