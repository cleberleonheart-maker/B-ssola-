import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { spacing, radius } from '../theme/colors';
import { formatDistance } from '../utils/geo';
import { formatAzimuth } from '../utils/compass';

type Props = {
  name: string;
  distance: number;
  relative: number;
  arrived: boolean;
  mils?: boolean;
};

const TargetNavBar = ({ name, distance, relative, arrived, mils = false }: Props) => {
  const colors = useThemeColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors, arrived), [colors, arrived]);

  return (
    <View style={styles.bar}>
      <View style={styles.arrowBox}>
        <Text
          style={[
            styles.arrow,
            { transform: [{ rotate: `${arrived ? 0 : relative}deg` }] },
          ]}>
          {arrived ? '✓' : '↑'}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {arrived
            ? t('ui_nav_arrived', { name })
            : `${formatDistance(distance)} · ${formatAzimuth(relative, mils)}`}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (
  colors: {
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    primary: string;
    success: string;
  },
  arrived: boolean,
) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: colors.surface,
      borderColor: arrived ? colors.success : colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    arrowBox: {
      width: 42,
      height: 42,
      borderRadius: radius.full,
      backgroundColor: arrived ? colors.success : colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    arrow: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.surface,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    sub: {
      fontSize: 13,
      fontWeight: '700',
      color: arrived ? colors.success : colors.textMuted,
      marginTop: 2,
    },
  });

export default TargetNavBar;
