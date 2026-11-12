import { useEffect, useRef, useState } from 'react';

import {
  fetchCivilAlerts,
  fetchCurrentTemperature,
  isSevere,
} from '../../services/alertsService';
import { showAlertNotification } from '../../services/notifications';
import type { Translator } from '../../i18n/strings';

export type WeatherAlertsState = {
  /** A temperatura atual, para o widget (vem da rede). */
  widgetTemp: string | null;
};

/**
 * Os alertas de mau tempo e a temperatura.
 *
 * A verificação imediata é no primeiro fix real (0,0 = sem fix ainda) e o
 * polling de 30 min é desacoplado do GPS: lê a última posição de um ref em
 * vez de fechar sobre um fix capturado, então o intervalo não se reinicia a
 * cada atualização de localização.
 */
export const useWeatherAlerts = (
  latitude: number,
  longitude: number,
  latestFixRef: { current: { latitude: number; longitude: number } },
  onSevere: () => void,
  t: Translator,
): WeatherAlertsState => {
  const [widgetTemp, setWidgetTemp] = useState<string | null>(null);
  const alertsCheckedRef = useRef(false);
  const notifiedAlertsRef = useRef(new Set<string>());

  // Verificação imediata: no primeiro fix real (0,0 = sem fix ainda). Antes
  // este efeito também criava o intervalo de 30 min, mas como dependia de
  // latitude/longitude ele se recriava a cada fix e o timer nunca atingia os
  // 30 min enquanto o usuário se movia.
  useEffect(() => {
    if (latitude === 0 && longitude === 0) return;
    if (alertsCheckedRef.current) return;
    alertsCheckedRef.current = true;
    let cancelled = false;
    fetchCivilAlerts(latitude, longitude)
      .then(result => {
        if (cancelled) return;
        if (isSevere(result)) {
          onSevere();
        }
        result.weather
          .filter(
            alert => alert.severity === 'orange' || alert.severity === 'red',
          )
          .forEach(alert => {
            const key = `${alert.severity}|${alert.event}|${alert.expires ?? 'x'}`;
            if (!notifiedAlertsRef.current.has(key)) {
              notifiedAlertsRef.current.add(key);
              showAlertNotification(alert, t).catch(() => {});
            }
          });
      })
      .catch(() => {});
    fetchCurrentTemperature(latitude, longitude)
      .then(temp => {
        if (!cancelled && temp != null) {
          setWidgetTemp(`${Math.round(temp)}°C`);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, onSevere, t]);

  // Polling de 30 min desacoplado do GPS: lê a última posição do ref em vez
  // de fechar sobre um fix capturado, então o intervalo não se reinicia a cada
  // atualização de localização.
  useEffect(() => {
    let active = true;
    const check = () => {
      const fix = latestFixRef.current;
      if (fix.latitude === 0 && fix.longitude === 0) return;
      fetchCivilAlerts(fix.latitude, fix.longitude)
        .then(result => {
          if (!active) return;
          if (isSevere(result)) {
            onSevere();
          }
          result.weather
            .filter(
              alert => alert.severity === 'orange' || alert.severity === 'red',
            )
            .forEach(alert => {
              const key = `${alert.severity}|${alert.event}|${alert.expires ?? 'x'}`;
              if (!notifiedAlertsRef.current.has(key)) {
                notifiedAlertsRef.current.add(key);
                showAlertNotification(alert, t).catch(() => {});
              }
            });
        })
        .catch(() => {});
      fetchCurrentTemperature(fix.latitude, fix.longitude)
        .then(temp => {
          if (active && temp != null) {
            setWidgetTemp(`${Math.round(temp)}°C`);
          }
        })
        .catch(() => {});
    };
    const id = setInterval(check, 30 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [latestFixRef, onSevere, t]);

  return { widgetTemp };
};
