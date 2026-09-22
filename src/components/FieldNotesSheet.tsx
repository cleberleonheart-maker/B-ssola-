import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  NativeModules,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { formatCoord, formatTime } from '../utils/compass';
import { openLink, googleMapsUrl } from '../utils/coords';
import {
  loadNotes,
  saveNote,
  deleteNote,
  markSynced,
  createNoteId,
  type FieldNote,
} from '../services/notesService';
import { ensureCloudUser, pushNotes } from '../services/cloud';

type Props = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  hasFix: boolean;
};

const FieldNotesSheet = ({ latitude, longitude, altitude, hasFix }: Props) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [notes, setNotes] = useState<FieldNote[]>([]);
  const [text, setText] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);

  useEffect(() => {
    loadNotes().then(setNotes);
  }, []);

  const canAdd = text.trim().length > 0 && hasFix;

  const add = async () => {
    if (!canAdd) return;
    const note: FieldNote = {
      id: createNoteId(),
      text: text.trim(),
      lat: latitude,
      lon: longitude,
      alt: altitude,
      at: Date.now(),
      photoPath,
      cloudSynced: false,
    };
    const next = await saveNote(note);
    setNotes(next);
    setText('');
    setPhotoPath(null);
  };

  const takePhoto = async () => {
    if (Platform.OS !== 'android' || !NativeModules.Photo) {
      setCloudMsg(t('fn_photo_fail'));
      return;
    }
    setPhotoLoading(true);
    try {
      const path = await NativeModules.Photo.takePhoto();
      setPhotoPath(path);
    } catch {
      setCloudMsg(t('fn_photo_fail'));
    } finally {
      setPhotoLoading(false);
    }
  };

  const remove = async (id: string) => {
    const next = await deleteNote(id);
    setNotes(next);
  };

  const syncCloud = useCallback(async (note: FieldNote) => {
    try {
      const userId = await ensureCloudUser();
      if (!userId) {
        setCloudMsg(t('fn_cloud_disabled'));
        return;
      }
      const ok = await pushNotes(userId, [
        {
          id: note.id,
          data: {
            text: note.text,
            lat: note.lat,
            lon: note.lon,
            alt: note.alt,
            at: note.at,
            photoPath: note.photoPath,
          },
        },
      ]);
      if (ok) {
        const next = await markSynced(note.id);
        setNotes(next);
        setCloudMsg(t('fn_cloud_ok'));
      } else {
        setCloudMsg(t('fn_cloud_fail'));
      }
    } catch {
      setCloudMsg(t('fn_cloud_fail'));
    }
  }, [t]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <Text style={styles.emoji}>📓</Text>
        <Text style={[styles.title, { color: colors.text }]}>{t('fn_title')}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('fn_hint')}</Text>
      </View>

      {photoPath ? (
        <View style={styles.cameraBox}>
          <Image source={{ uri: photoPath }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.cameraActions}>
            <Pressable
              onPress={() => setPhotoPath(null)}
              style={[styles.cancelBtn, { borderColor: colors.border }]}>
              <Text style={[styles.cancelTxt, { color: colors.textMuted }]}>
                {t('fn_remove_photo')}
              </Text>
            </Pressable>
            <Pressable
              onPress={takePhoto}
              disabled={photoLoading}
              style={[styles.cancelBtn, { borderColor: colors.border, marginLeft: spacing.sm }]}>
              <Text style={[styles.cancelTxt, { color: colors.textMuted }]}>
                {photoLoading ? '…' : t('fn_retake_photo')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={[styles.card, { borderColor: colors.primary + '44' }]}>
        <View style={styles.addRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('fn_placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
          <View style={styles.addActions}>
            {hasFix && (
              <Pressable
                onPress={takePhoto}
                disabled={photoLoading}
                style={[styles.iconBtn, { backgroundColor: colors.surfaceAlt }]}>
                {photoLoading ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                  <Text style={styles.iconBtnTxt}>📷</Text>
                )}
              </Pressable>
            )}
            <Pressable
              onPress={add}
              disabled={!canAdd}
              style={[
                styles.iconBtn,
                { backgroundColor: canAdd ? colors.primary : colors.surfaceAlt },
              ]}>
              <Text
                style={[
                  styles.iconBtnTxt,
                  { color: canAdd ? colors.background : colors.textMuted },
                ]}>
                ✓
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {cloudMsg && (
        <Text style={[styles.cloudMsg, { color: colors.primary }]}>{cloudMsg}</Text>
      )}

      {notes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('fn_empty')}</Text>
        </View>
      ) : (
        notes.map(note => (
          <View key={note.id} style={[styles.row, { borderColor: colors.border }]}>
            {note.photoPath ? (
              <Image source={{ uri: note.photoPath }} style={styles.thumb} resizeMode="cover" />
            ) : null}
            <View style={styles.rowBody}>
              <Text style={[styles.rowText, { color: colors.text }]} numberOfLines={3}>
                {note.text}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                {formatCoord(note.lat, true)}, {formatCoord(note.lon, false)} · {formatTime(note.at)}
              </Text>
              <View style={styles.rowActions}>
                <Pressable
                  onPress={() => openLink(googleMapsUrl(note.lat, note.lon))}
                  style={[styles.miniBtn, { borderColor: colors.primary }]}>
                  <Text style={[styles.miniBtnTxt, { color: colors.primary }]}>🗺</Text>
                </Pressable>
                <Pressable
                  onPress={() => syncCloud(note)}
                  style={[styles.miniBtn, { borderColor: colors.border }]}>
                  <Text
                    style={[
                      styles.miniBtnTxt,
                      { color: note.cloudSynced ? colors.success : colors.textMuted },
                    ]}>
                    {note.cloudSynced ? '☁✓' : '☁'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => remove(note.id)}
                  style={[styles.miniBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.miniBtnTxt, { color: colors.danger }]}>🗑</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const createStyles = (colors: {
  surface: string;
  border: string;
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg,
    },
    intro: {
      alignItems: 'center',
      marginVertical: spacing.md,
    },
    emoji: {
      fontSize: 34,
      marginBottom: spacing.xs,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
    },
    hint: {
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    cameraBox: {
      height: 200,
      borderRadius: radius.md,
      overflow: 'hidden',
      marginBottom: spacing.sm,
      justifyContent: 'flex-end',
    },
    cameraActions: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
      backgroundColor: 'rgba(0,0,0,0.35)',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    cancelBtn: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    cancelTxt: {
      fontSize: 12,
      fontWeight: '700',
    },
    card: {
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: colors.surface + 'B3',
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    input: {
      flex: 1,
      minHeight: 72,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 14,
      marginRight: spacing.sm,
      textAlignVertical: 'top',
    },
    addActions: {
      alignItems: 'center',
    },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    iconBtnTxt: {
      fontSize: 18,
      fontWeight: '800',
    },
    emptyWrap: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    empty: {
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface + 'B3',
    },
    thumb: {
      width: 64,
      height: 64,
      borderRadius: radius.sm,
      marginRight: spacing.sm,
    },
    rowBody: {
      flex: 1,
    },
    rowText: {
      fontSize: 14,
      fontWeight: '600',
    },
    rowMeta: {
      fontSize: 11,
      marginTop: 3,
    },
    rowActions: {
      flexDirection: 'row',
      marginTop: spacing.xs,
    },
    miniBtn: {
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      marginRight: spacing.sm,
    },
    miniBtnTxt: {
      fontSize: 12,
      fontWeight: '800',
    },
    cloudMsg: {
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
      marginVertical: spacing.sm,
    },
  });

export default FieldNotesSheet;