import { useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';

import {
  watchBarometer,
  barometricAltitude,
} from '../../services/barometerService';
import {
  loadPressureHistory,
  recordPressure,
  fastPressureDrop,
} from '../../services/pressureHistoryService';
import { showPressureDropNotification } from '../../services/notifications';
import type { Translator } from '../../i18n/strings';

export type BarometerState = {
  baroPressure: number | null;
  baroAvailable: boolean;
  /** A pressão de referência: a altitude que o barómetro dá é relativa. */
  baroBaseline: number | null;
  setBaroBaseline: (pressure: number | null) => void;
  /** A altitude que o barómetro dá, com a referência. */
  baroAlt: number | null;
};

/**
 * O barómetro: a pressão e a altitude que sai dela.
 *
 * A altitude do barómetro é relativa — só vale com uma referência (a que a
 * pessoa dá quando está no sítio que conhece). E a queda de pressão é o alarme
 * que soa antes da tempestade: por isso a regra é avaliada aqui, e não no
 * painel, que muitas vezes não está montado quando o aviso devia soar.
 */
export const useBarometer = (t: Translator): BarometerState => {
  const [baroPressure, setBaroPressure] = useState<number | null>(null);
  const [baroAvailable, setBaroAvailable] = useState(true);
  const [baroBaseline, setBaroBaseline] = useState<number | null>(null);
  // O alarme da queda de pressão (ideia #104) dispara uma vez por episódio: só
  // volta a avisar depois de a série deixar de ultrapassar o limite, senão cada
  // leitura dos 10 s seguintes repetia a mesma notificação.
  const pressureAlertRef = useRef(false);

  useEffect(() => {
    loadPressureHistory().catch(() => {});
    const stop = watchBarometer(
      reading => {
        setBaroPressure(reading.pressure);
        // Alimenta o histórico partilhado (o painel do barómetro lê-o) e avalia
        // a regra de campo no mesmo passo: a queda tem de soar mesmo quando o
        // painel não está montado, que é o caso de uso da ideia #104.
        const series = recordPressure(reading.pressure);
        const drop = fastPressureDrop(series);
        if (drop) {
          if (!pressureAlertRef.current) {
            pressureAlertRef.current = true;
            try {
              Vibration.vibrate(400);
            } catch {}
            showPressureDropNotification(drop.dropHpa, t).catch(() => {});
          }
        } else {
          pressureAlertRef.current = false;
        }
      },
      () => setBaroAvailable(false),
    );
    return stop;
  }, [t]);

  const baroAlt =
    baroPressure != null ? barometricAltitude(baroPressure, baroBaseline) : null;

  return {
    baroPressure,
    baroAvailable,
    baroBaseline,
    setBaroBaseline,
    baroAlt,
  };
};
