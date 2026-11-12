import React from 'react';
import { View, Text, Pressable } from 'react-native';

import KeferaAvatar from '../../components/KeferaAvatar';
import type { Translator } from '../../i18n/strings';
import type { ScreenStyles } from './styles';

export type CompassHeaderProps = {
  /** O rumo, para a linha de baixo. */
  cardinal: { short: string; full: string };
  /** O norte é o geográfico ou o magnético? */
  geoNorth: boolean;
  /** Há algum sensor a falhar? */
  sensorUnavailable: boolean;
  /** O ecrã inicial está à vista? */
  launcherVisible: boolean;
  /** Abre a Kefera. */
  onOpenAssistant: () => void;
  /** Volta ao ecrã inicial. */
  onGoHome: () => void;
  /** Abre o SOS. */
  onOpenSos: () => void;
  /** Abre os alertas. */
  onOpenAlerts: () => void;
  /** Abre as definições. */
  onOpenSettings: () => void;
  t: Translator;
  styles: Pick<
    ScreenStyles,
    | 'header'
    | 'roundButton'
    | 'headerText'
    | 'headerTitle'
    | 'headerSubtitle'
    | 'homeLink'
    | 'roundButtonIcon'
  >;
};

/**
 * A barra de cima: a Kefera, o título e os três botões.
 *
 * O botão do meio muda conforme o ecrã: no inicial mostra o rumo, nos modos
 * mostra a ligação para voltar. Por isso o componente recebe o estado em vez
 * de o ler — a decisão fica no ecrã principal.
 */
const CompassHeader = ({
  cardinal,
  geoNorth,
  sensorUnavailable,
  launcherVisible,
  onOpenAssistant,
  onGoHome,
  onOpenSos,
  onOpenAlerts,
  onOpenSettings,
  t,
  styles,
}: CompassHeaderProps) => (
  <View style={styles.header}>
    <Pressable onPress={onOpenAssistant} style={styles.roundButton} hitSlop={12}>
      <KeferaAvatar size={30} />
    </Pressable>
    <View style={styles.headerText}>
      <Text style={styles.headerTitle}>{t('ui_app_title')}</Text>
      {launcherVisible ? (
        <Text style={styles.headerSubtitle}>
          {sensorUnavailable
            ? t('ui_sensor_unavailable')
            : t('ui_header_heading', {
                card: cardinal.short,
                type: geoNorth ? t('ui_geo_north') : t('ui_mag_north'),
              })}
        </Text>
      ) : (
        <Pressable onPress={onGoHome} hitSlop={8}>
          <Text style={[styles.headerSubtitle, styles.homeLink]}>
            {'‹ '}{t('ui_back_home')}
          </Text>
        </Pressable>
      )}
    </View>
    <Pressable onPress={onOpenSos} style={styles.roundButton} hitSlop={12}>
      <Text style={styles.roundButtonIcon}>🆘</Text>
    </Pressable>
    <Pressable onPress={onOpenAlerts} style={styles.roundButton} hitSlop={12}>
      <Text style={styles.roundButtonIcon}>🚨</Text>
    </Pressable>
    <Pressable onPress={onOpenSettings} style={styles.roundButton} hitSlop={12}>
      <Text style={styles.roundButtonIcon}>⚙</Text>
    </Pressable>
  </View>
);

export default CompassHeader;
