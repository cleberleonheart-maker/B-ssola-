import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { styles } from './styles';

type Props = {
  title: string;
  sub: string;
  value: string;
  error: string | null;
  onChange: (digits: string) => void;
  onClose: () => void;
};

const PinDialog = ({ title, sub, value, error, onChange, onClose }: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();

  return (
    <View style={styles.pinOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.pinCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.pinTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.pinSub, { color: colors.textMuted }]}>{sub}</Text>
        <TextInput
          autoFocus
          keyboardType="number-pad"
          value={value}
          onChangeText={onChange}
          maxLength={4}
          secureTextEntry
          style={[styles.pinInput, { borderColor: colors.border, color: colors.text }]}
          placeholder="••••"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.pinDots}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.pinDot,
                { backgroundColor: i < value.length ? colors.primary : colors.border },
              ]}
            />
          ))}
        </View>
        {error ? (
          <Text style={[styles.pinErrorText, { color: colors.danger }]}>{error}</Text>
        ) : (
          <View style={styles.pinErrorSpacer} />
        )}
        <Pressable onPress={onClose} style={styles.pinCancel}>
          <Text style={[styles.pinCancelText, { color: colors.textMuted }]}>
            {t('backup_cancel')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default PinDialog;
