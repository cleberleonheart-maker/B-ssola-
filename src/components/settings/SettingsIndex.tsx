import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import { styles } from './styles';

export type SettingsIndexItem = {
  id: string;
  label: string;
  icon: string;
};

type Props = {
  sections: SettingsIndexItem[];
  active: string;
  onSelect: (id: string) => void;
};

/**
 * O índice de Configurações.
 *
 * O ecrã tem nove secções e é comprido: sem índice, chegar à secção "Conta"
 * é rolar e rolar. As fichas são o atalho — tocar numa leva à secção, e a
 * ficha que está a ser lida fica marcada.
 */
const SettingsIndex = ({ sections, active, onSelect }: Props) => {
  const { t } = useLanguage();
  const colors = useThemeColors();

  return (
    <View style={styles.indexBox}>
      <Text style={[styles.indexLabel, { color: colors.textMuted }]}>
        {t('set_index_label')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.indexRow}>
        {sections.map(section => {
          const on = section.id === active;
          return (
            <Pressable
              key={section.id}
              onPress={() => onSelect(section.id)}
              style={[
                styles.indexChip,
                {
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? colors.surfaceAlt : colors.surface,
                },
              ]}>
              <Text style={styles.indexChipIcon}>{section.icon}</Text>
              <Text
                style={[
                  styles.indexChipText,
                  { color: on ? colors.text : colors.textMuted },
                ]}>
                {section.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default SettingsIndex;
