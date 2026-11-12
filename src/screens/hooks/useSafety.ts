import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { startFallDetection, stopFallDetection } from '../../services/fallDetection';
import { startBeaconLoop } from '../../services/beaconLoop';
import { loadBeaconLastSent, saveBeaconLastSent } from '../../services/preferencesService';
import { showBeaconNotification } from '../../services/notifications';
import type { Translator } from '../../i18n/strings';

export type UseSafetyOptions = {
  /** A detecção de queda está ligada? */
  fallDetection: boolean;
  /** O beacon está ligado? */
  beaconEnabled: boolean;
  /** Para quem é o aviso — sem contacto não há beacon. */
  emergencyContact: string;
  /** De quantos em quantos minutos o beacon avisa. */
  beaconIntervalMinutes: number;
  /** Abre o ecrã de emergência. */
  onOpenSos: () => void;
  t: Translator;
};

/**
 * As duas vigilance que correm sozinhas: a queda e o beacon.
 *
 * Nenhuma das duas decide por si: a queda abre uma pergunta (quem pode tocar
 * é quem decide se quer o SOS) e o beacon avisa por notificação — o telemóvel
 * está muitas vezes no bolso com o ecrã apagado — e, se a app estiver à
 * frente, também por diálogo.
 */
export const useSafety = ({
  fallDetection,
  beaconEnabled,
  emergencyContact,
  beaconIntervalMinutes,
  onOpenSos,
  t,
}: UseSafetyOptions): void => {
  const fallPromptRef = useRef(false);
  const beaconPromptRef = useRef(false);

  // Ligar e desligar a detecção de queda re-arma a pergunta: quem turned
  // aquilo e o voltou a ligar espera poder ser avisado outra vez.
  useEffect(() => {
    fallPromptRef.current = false;
  }, [fallDetection]);

  /**
   * Detecção de queda (ideia #7).
   *
   * O acelerómetro leva um embate e o aparelho fica parado: a app pergunta se
   * foi queda e oferece o SOS. A pergunta — e não o envio — é a decisão de
   * quem tem o telemóvel na mão; quem caiu não tem.
   */
  useEffect(() => {
    if (!fallDetection) {
      stopFallDetection();
      return;
    }
    startFallDetection(() => {
      if (fallPromptRef.current) return;
      fallPromptRef.current = true;
      Alert.alert(t('fall_detect_alert_title'), t('fall_detect_alert_body'), [
        {
          text: t('fall_detect_later'),
          style: 'cancel',
          onPress: () => {
            fallPromptRef.current = false;
          },
        },
        {
          text: t('fall_detect_send_sos'),
          onPress: () => {
            fallPromptRef.current = false;
            onOpenSos();
          },
        },
      ]);
    });
    return () => {
      stopFallDetection();
    };
  }, [fallDetection, onOpenSos, t]);

  /**
   * Ciclo do beacon (ideia #6).
   *
   * Quando chega a hora, o aviso sai por notificação (o telemóvel está
   * muitas vezes no bolso) e, se a app estiver à frente, também por diálogo,
   * com o botão que abre o SOS.
   */
  useEffect(() => {
    if (!beaconEnabled || !emergencyContact) return;
    const stop = startBeaconLoop({
      intervalMinutes: beaconIntervalMinutes,
      getLastSentAt: loadBeaconLastSent,
      markNotified: saveBeaconLastSent,
      onDue: () => {
        showBeaconNotification(t).catch(() => {});
        if (beaconPromptRef.current) return;
        beaconPromptRef.current = true;
        Alert.alert(t('beacon_due_title'), t('beacon_due_body'), [
          {
            text: t('fall_detect_later'),
            style: 'cancel',
            onPress: () => {
              beaconPromptRef.current = false;
            },
          },
          {
            text: t('sos_beacon_send'),
            onPress: () => {
              beaconPromptRef.current = false;
              onOpenSos();
            },
          },
        ]);
      },
    });
    return stop;
  }, [
    beaconEnabled,
    emergencyContact,
    beaconIntervalMinutes,
    onOpenSos,
    t,
  ]);
};
