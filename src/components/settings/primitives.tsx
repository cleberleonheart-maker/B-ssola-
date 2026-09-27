import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useThemeColors } from '../../theme/ThemeContext';
import { styles, rowDivider } from './styles';

type Colors = ReturnType<typeof useThemeColors>;

export const SectionLabel = ({ label }: { label: string }) => {
  const colors = useThemeColors();
  return (
    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
      {label}
    </Text>
  );
};

export const GroupCard = ({ children }: { children: React.ReactNode }) => {
  const colors = useThemeColors();
  return (
    <View style={[styles.groupCard, { backgroundColor: colors.surface }]}>
      {children}
    </View>
  );
};

export const IconChip = ({ icon }: { icon: string }) => {
  const colors = useThemeColors();
  return (
    <View style={[styles.iconChip, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={styles.iconChipText}>{icon}</Text>
    </View>
  );
};

export const RowBody = ({
  label,
  sub,
  subColor,
  lines,
}: {
  label: string;
  sub: string;
  subColor?: string;
  lines?: number;
}) => {
  const colors = useThemeColors();
  return (
    <View style={styles.groupText}>
      <Text style={[styles.groupLabel, { color: colors.text }]}>{label}</Text>
      <Text
        style={[styles.groupSub, { color: subColor ?? colors.textMuted }]}
        numberOfLines={lines}>
        {sub}
      </Text>
    </View>
  );
};

export const Chevron = ({ text = '›' }: { text?: string }) => {
  const colors = useThemeColors();
  return <Text style={[styles.chevron, { color: colors.textMuted }]}>{text}</Text>;
};

export const Radio = ({ selected }: { selected: boolean }) => {
  const colors = useThemeColors();
  return (
    <View
      style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
      {selected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
    </View>
  );
};

export const StatusDot = ({ good }: { good: boolean }) => {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.statusDot,
        { backgroundColor: good ? colors.success : colors.textMuted },
      ]}
    />
  );
};

export const Switch = ({
  on,
  onPress,
  disabled,
}: {
  on: boolean;
  onPress: () => void;
  disabled?: boolean;
}) => {
  const colors = useThemeColors();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.switchTrack,
        on ? styles.switchTrackOn : styles.switchTrackOff,
        { backgroundColor: on ? colors.primary : colors.surfaceAlt },
      ]}>
      <View
        style={[
          styles.switchKnob,
          { backgroundColor: on ? colors.background : colors.textMuted },
        ]}
      />
    </Pressable>
  );
};

/** Linha de grupo: divider opcional, `onPress` transforma em Pressable. */
export const GroupRow = ({
  divider,
  onPress,
  disabled,
  borderColor,
  col,
  children,
}: {
  divider?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  borderColor?: string;
  col?: boolean;
  children: React.ReactNode;
}) => {
  const colors = useThemeColors();
  const base = [
    styles.groupRow,
    col ? styles.rowCol : null,
    divider ? rowDivider(colors) : null,
    borderColor ? { borderColor } : null,
  ];
  if (!onPress) {
    return <View style={base}>{children}</View>;
  }
  return (
    <Pressable style={base} onPress={onPress} disabled={disabled}>
      {children}
    </Pressable>
  );
};

/** Celula do grid (tema, idioma). */
export const GridOption = ({
  selected,
  onPress,
  swatch,
  label,
}: {
  selected: boolean;
  onPress: () => void;
  swatch?: boolean;
  label: string;
}) => {
  const colors: Colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.gridOption,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.surfaceAlt : colors.surface,
        },
      ]}>
      {swatch ? (
        <View
          style={[
            styles.themeSwatch,
            { backgroundColor: selected ? colors.primary : colors.surfaceAlt },
          ]}>
          <View
            style={[
              styles.themeSwatchDot,
              { backgroundColor: selected ? colors.surface : colors.textMuted },
            ]}
          />
        </View>
      ) : null}
      <Text
        style={[styles.gridLabel, { color: selected ? colors.text : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
};

/** Item de lista com radio (modo do app, modo de local). */
export const RadioRow = ({
  icon,
  label,
  sub,
  selected,
  onPress,
  divider,
}: {
  icon: string;
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
  divider?: boolean;
}) => {
  const colors = useThemeColors();
  return (
    <GroupRow divider={divider} onPress={onPress}>
      <IconChip icon={icon} />
      <RowBody
        label={label}
        sub={sub}
        subColor={selected ? colors.text : colors.textMuted}
        lines={2}
      />
      <Radio selected={selected} />
    </GroupRow>
  );
};

/** Item de lista com switch. */
export const SwitchRow = ({
  icon,
  label,
  sub,
  on,
  onPress,
  divider,
  disabled,
}: {
  icon: string;
  label: string;
  sub: string;
  on: boolean;
  onPress: () => void;
  divider?: boolean;
  disabled?: boolean;
}) => (
  <GroupRow divider={divider}>
    <IconChip icon={icon} />
    <RowBody label={label} sub={sub} lines={2} />
    <Switch on={on} onPress={onPress} disabled={disabled} />
  </GroupRow>
);

/** Item de lista com chevron (navega para outra tela). */
export const ChevronRow = ({
  icon,
  label,
  sub,
  onPress,
  divider,
  lines,
  chevronText,
  disabled,
}: {
  icon: string;
  label: string;
  sub: string;
  onPress: () => void;
  divider?: boolean;
  lines?: number;
  chevronText?: string;
  disabled?: boolean;
}) => (
  <GroupRow divider={divider} onPress={onPress} disabled={disabled}>
    <IconChip icon={icon} />
    <RowBody label={label} sub={sub} lines={lines} />
    <Chevron text={chevronText} />
  </GroupRow>
);
