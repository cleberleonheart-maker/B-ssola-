import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { haversine, initialBearing, formatDistance } from '../utils/geo';
import type { Waypoint } from '../services/waypointsService';

type Props = {
  visible: boolean;
  onClose: () => void;
  waypoints: Waypoint[];
  latitude: number;
  longitude: number;
  hasFix: boolean;
  activeId: string | null;
  pinnedId: string | null;
  onActivate: (id: string | null) => void;
  onPin: (id: string | null) => void;
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
};

const WaypointModal = ({
  visible,
  onClose,
  waypoints,
  latitude,
  longitude,
  hasFix,
  activeId,
  pinnedId,
  onActivate,
  onPin,
  onAdd,
  onDelete,
}: Props) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles();
  const [name, setName] = useState('');

  const rows = useMemo(
    () =>
      waypoints.map(wp => {
        if (!hasFix) return { wp, distance: null, bearing: null };
        const distance = haversine(latitude, longitude, wp.latitude, wp.longitude);
        const bearing = initialBearing(latitude, longitude, wp.latitude, wp.longitude);
        return { wp, distance, bearing };
      }),
    [waypoints, latitude, longitude, hasFix],
  );

  const canSave = name.trim().length > 0 && hasFix;

  const add = () => {
    if (!canSave) return;
    onAdd(name.trim());
    setName('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('ui_wp_title')}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.addRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('ui_wp_name_placeholder')}
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={add}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />
            <Pressable
              onPress={add}
              disabled={!canSave}
              style={[
                styles.addButton,
                { backgroundColor: canSave ? colors.primary : colors.surfaceAlt },
              ]}>
              <Text style={[styles.addButtonText, { color: canSave ? colors.background : colors.textMuted }]}>
                {t('ui_wp_save')}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {rows.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                {t('wp_none_saved')}
              </Text>
            ) : (
              rows.map(({ wp, distance, bearing }) => {
                const active = wp.id === activeId;
                const pinned = wp.id === pinnedId;
                return (
                  <View
                    key={wp.id}
                    style={[
                      styles.row,
                      {
                        borderColor: active
                          ? colors.success
                          : pinned
                          ? colors.primary
                          : colors.border,
                        backgroundColor:
                          active || pinned ? colors.surfaceAlt : colors.surface,
                      },
                    ]}>
                    <Pressable
                      style={styles.rowMain}
                      onPress={() => onActivate(active ? null : wp.id)}>
                      <Text style={[styles.rowName, { color: colors.text }]}>
                        {wp.name}
                      </Text>
                      <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                        {distance != null
                          ? t('wp_distance_label', { distance: formatDistance(distance), deg: Math.round(bearing ?? 0) })
                          : '—'}
                        {wp.altitude != null ? ` · ${Math.round(wp.altitude)} m` : ''}
                      </Text>
                      {active && (
                        <Text style={[styles.activeTag, { color: colors.success }]}>
                          {t('wp_active_tag')}
                        </Text>
                      )}
                      {pinned && (
                        <Text style={[styles.pinnedTag, { color: colors.primary }]}>
                          {t('wp_pinned_tag')}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => onPin(pinned ? null : wp.id)}
                      accessibilityLabel={pinned ? t('wp_unpin_virtual') : t('wp_pin_virtual')}
                      style={[
                        styles.pinButton,
                        { borderColor: pinned ? colors.primary : colors.border },
                      ]}>
                      <Text
                        style={[
                          styles.pinText,
                          { color: pinned ? colors.primary : colors.textMuted },
                        ]}>
                        📌
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => onDelete(wp.id)} style={styles.deleteButton}>
                      <Text style={[styles.deleteText, { color: colors.danger }]}>🗑</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = () =>
  StyleSheet.create({
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
      maxHeight: '80%',
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
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 15,
      marginRight: spacing.sm,
    },
    addButton: {
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '800',
    },
    list: {
      marginTop: spacing.md,
    },
    empty: {
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    rowMain: {
      flex: 1,
    },
    rowName: {
      fontSize: 15,
      fontWeight: '800',
    },
    rowMeta: {
      fontSize: 12,
      marginTop: 3,
    },
    activeTag: {
      fontSize: 11,
      fontWeight: '800',
      marginTop: 4,
    },
    pinnedTag: {
      fontSize: 11,
      fontWeight: '800',
      marginTop: 2,
    },
    pinButton: {
      borderWidth: 1,
      borderRadius: radius.full,
      padding: spacing.sm,
      marginRight: spacing.sm,
    },
    pinText: {
      fontSize: 14,
    },
    deleteButton: {
      padding: spacing.sm,
    },
    deleteText: {
      fontSize: 16,
    },
  });

export default WaypointModal;