import React, { useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  NativeModules,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { formatCoord, formatTime } from '../utils/compass';

type Props = {
  visible: boolean;
  latitude: number;
  longitude: number;
  altitude: number | null;
  hasFix: boolean;
  onSave: (note: string, photoPath: string | null) => void;
  onClose: () => void;
};

/**
 * Marca um ponto de interesse durante a gravação de uma trilha. A foto usa a
 * câmera do sistema (mesmo módulo nativo da caderneta) e a nota é opcional.
 * Só se pode marcar com GPS fixo: sem posição não há ponto para marcar.
 */
const TrackPoiModal = ({
  visible,
  latitude,
  longitude,
  altitude: _altitude,
  hasFix,
  onSave,
  onClose,
}: Props) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(colors);

  const [note, setNote] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const reset = useCallback(() => {
    setNote('');
    setPhotoPath(null);
    setPhotoLoading(false);
  }, []);

  const takePhoto = async () => {
    if (Platform.OS !== 'android' || !NativeModules.Photo) {
      return;
    }
    setPhotoLoading(true);
    try {
      const path = await NativeModules.Photo.takePhoto();
      setPhotoPath(path);
    } catch {
      // sem câmera ou cancelada: a nota continua válida
    } finally {
      setPhotoLoading(false);
    }
  };

  const save = () => {
    if (!hasFix) return;
    onSave(note.trim(), photoPath);
    reset();
    onClose();
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>📍 {t('poi_title')}</Text>
            <Pressable onPress={close} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          {hasFix ? (
            <Text style={[styles.coord, { color: colors.textMuted }]}>
              {formatCoord(latitude, true)} · {formatCoord(longitude, false)} · {formatTime(Date.now())}
            </Text>
          ) : (
            <Text style={[styles.noFix, { color: colors.danger }]}>
              {t('poi_no_fix')}
            </Text>
          )}

          {photoPath ? (
            <View style={styles.photoWrap}>
              <Image
                source={{ uri: photoPath }}
                style={[styles.photo, { borderColor: colors.border }]}
              />
              <Pressable
                onPress={takePhoto}
                style={[styles.retake, { borderColor: colors.border }]}>
                <Text style={[styles.retakeText, { color: colors.textMuted }]}>
                  📷 {t('poi_retake')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={takePhoto}
              disabled={photoLoading}
              style={[styles.photoButton, { borderColor: colors.primary }]}>
              {photoLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.photoButtonText, { color: colors.primary }]}>
                  📷 {t('poi_photo')}
                </Text>
              )}
            </Pressable>
          )}

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('poi_note_hint')}
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

          <Pressable
            onPress={save}
            disabled={!hasFix}
            style={[
              styles.saveButton,
              { backgroundColor: hasFix ? colors.primary : colors.surfaceAlt },
            ]}>
            <Text
              style={[
                styles.saveButtonText,
                { color: hasFix ? colors.background : colors.textMuted },
              ]}>
              {t('poi_save')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (_colors: {
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  danger: string;
  border: string;
}) =>
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
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
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
    coord: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: spacing.md,
    },
    noFix: {
      fontSize: 11,
      fontWeight: '800',
      marginBottom: spacing.md,
    },
    photoButton: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    photoButtonText: {
      fontSize: 14,
      fontWeight: '800',
    },
    photoWrap: {
      marginBottom: spacing.sm,
      alignItems: 'center',
    },
    photo: {
      width: '100%',
      height: 180,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    retake: {
      alignSelf: 'center',
      borderRadius: radius.full,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      marginTop: spacing.sm,
    },
    retakeText: {
      fontSize: 12,
      fontWeight: '800',
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 14,
      minHeight: 60,
      textAlignVertical: 'top',
      marginBottom: spacing.md,
    },
    saveButton: {
      borderRadius: radius.full,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    saveButtonText: {
      fontSize: 15,
      fontWeight: '800',
    },
  });

export default TrackPoiModal;