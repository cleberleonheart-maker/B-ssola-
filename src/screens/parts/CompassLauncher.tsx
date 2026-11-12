import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';

import BatteryOptBanner from '../../components/BatteryOptBanner';
import { buildModeCards } from './modeCards';
import { formatAzimuth } from '../../utils/compass';
import type { DisplayMode } from '../../services/preferencesService';
import type { Translator } from '../../i18n/strings';
import type { ScreenStyles } from './styles';

export type CompassLauncherProps = {
  /** A cor de destaque (depende do tema). */
  primary: string;
  success: string;
  /** O rumo, para a pastilha de estado. */
  heading: number;
  useMils: boolean;
  cardinal: { short: string; full: string };
  /** Abre um modo. */
  onOpenMode: (mode: DisplayMode) => void;
  /** Os painéis de estado (barómetro, localização, odómetro). */
  statusPanels: React.ReactNode;
  t: Translator;
  styles: Pick<
    ScreenStyles,
    | 'homeScroll'
    | 'homeContent'
    | 'homeHeader'
    | 'homeTitle'
    | 'statusPill'
    | 'statusPillDot'
    | 'statusPillText'
    | 'cardGrid'
    | 'modeCard'
    | 'modeCardPressed'
    | 'cardAccent'
    | 'cardIcon'
    | 'cardIconText'
    | 'cardLabel'
    | 'cardSub'
  >;
};

/**
 * O ecrã inicial: a grelha dos modos e os painéis de estado.
 *
 * O aviso da bateria aparece aqui porque é aqui que a pessoa está a decidir
 * o que vai fazer — e é o aviso da otimização de bateria que decide se o
 * telemóvel aguenta a caminhada.
 */
const CompassLauncher = ({
  primary,
  success,
  heading,
  useMils,
  cardinal,
  onOpenMode,
  statusPanels,
  t,
  styles,
}: CompassLauncherProps) => {
  const modeCards = useMemo(() => buildModeCards(t), [t]);

  return (
    <ScrollView
      style={styles.homeScroll}
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}>
      <BatteryOptBanner />
      <View style={styles.homeHeader}>
        <Text style={styles.homeTitle}>{t('ui_home_launcher')}</Text>
        <View style={styles.statusPill}>
          <View style={[styles.statusPillDot, { backgroundColor: success }]} />
          <Text style={styles.statusPillText}>
            {t('ui_home_status')} · {formatAzimuth(heading, useMils)} {cardinal.short}
          </Text>
        </View>
      </View>

      <View style={styles.cardGrid}>
        {modeCards.map(card => (
          <Pressable
            key={card.key}
            onPress={() => onOpenMode(card.key)}
            style={({ pressed }) => [
              styles.modeCard,
              pressed && styles.modeCardPressed,
            ]}>
            <View style={[styles.cardAccent, { backgroundColor: primary }]} />
            <View style={[styles.cardIcon, { borderColor: primary + '66' }]}>
              <Text style={styles.cardIconText}>{card.icon}</Text>
            </View>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardSub} numberOfLines={2}>
              {card.sub}
            </Text>
          </Pressable>
        ))}
      </View>

      {statusPanels}
    </ScrollView>
  );
};

export default CompassLauncher;
