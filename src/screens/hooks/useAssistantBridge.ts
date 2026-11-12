import { useEffect, useRef } from 'react';

import type { AssistantApi } from '../../assistant/AssistantContext';
import { speak } from '../../assistant/voice';
import type {
  AssistantContextData,
  KnownWaypoint,
  TrackSummary,
} from '../../assistant/types';
import { formatDistance } from '../../utils/geo';
import type { LocationFix } from '../../services/locationService';
import type { Declination } from '../../utils/declination';
import type { DisplayMode, AppMode } from '../../services/preferencesService';
import type { Translator } from '../../i18n/strings';

const GUIDE_INTERVAL_MS = 9000;

export type UseAssistantBridgeOptions = {
  assistant: AssistantApi;
  heading: number;
  cardinal: string;
  location: LocationFix;
  hasFix: boolean;
  baroPressure: number | null;
  baroAvailable: boolean;
  declination: Declination;
  odometer: number;
  odoHistory: { today: number; week: number } | null;
  trackSummary: TrackSummary | null;
  appMode: AppMode;
  displayMode: DisplayMode;
  theme: string;
  waypoints: KnownWaypoint[];
  /** O alvo activo: é o que a Kefera anuncia no compasso falado. */
  target: { name: string; distance: number } | null;
  /** O compasso falado está ligado? */
  voiceGuide: boolean;
  /** Muda de modo a pedido da assistente. */
  selectDisplayMode: (mode: DisplayMode) => void;
  /** Marca um ponto a pedido da assistente. */
  addWaypoint: (name: string) => void;
  t: Translator;
};

/**
 * A ponte entre a app e a Kefera.
 *
 * Duas coisas: o que a assistente sabe (o contexto — a posição, o rumo, os
 * pontos, as distâncias) e o que ela pode mandar (mudar de modo, marcar um
 * ponto). O compasso falado também mora aqui: é a mesma voz, a dizer o mesmo
 * ritmo.
 */
export const useAssistantBridge = ({
  assistant,
  heading,
  cardinal,
  location,
  hasFix,
  baroPressure,
  baroAvailable,
  declination,
  odometer,
  odoHistory,
  trackSummary,
  appMode,
  displayMode,
  theme,
  waypoints,
  target,
  voiceGuide,
  selectDisplayMode,
  addWaypoint,
  t,
}: UseAssistantBridgeOptions): void => {
  const guideRef = useRef<{
    hasFix: boolean;
    heading: number;
    cardinal: string;
    target: { name: string; distance: number } | null;
  }>({ hasFix: false, heading: 0, cardinal: '', target: null });
  const lastSpokeRef = useRef(0);

  useEffect(() => {
    guideRef.current = {
      hasFix,
      heading,
      cardinal,
      target,
    };
  }, [hasFix, heading, cardinal, target]);

  useEffect(() => {
    assistant.setContextData({
      heading,
      cardinal,
      latitude: hasFix ? location.latitude : null,
      longitude: hasFix ? location.longitude : null,
      accuracy: location.accuracy,
      altitude: location.altitude,
      speed: location.speed,
      pressure: baroPressure,
      baroAvailable,
      declinationEnabled: declination.enabled,
      declination: declination.degrees,
      odometer,
      todayDistance: odoHistory ? odoHistory.today : null,
      weekDistance: odoHistory ? odoHistory.week : null,
      trackSummary,
      appMode,
      displayMode,
      theme,
      waypoints,
    } as Partial<AssistantContextData>);
  }, [
    assistant,
    heading,
    cardinal,
    location,
    baroPressure,
    baroAvailable,
    declination,
    odometer,
    odoHistory,
    trackSummary,
    appMode,
    displayMode,
    theme,
    waypoints,
    hasFix,
  ]);

  useEffect(() => {
    assistant.setActionHandler(action => {
      if (action.type === 'setMode') {
        selectDisplayMode(action.mode as DisplayMode);
      } else if (action.type === 'addWaypoint') {
        if (!hasFix) {
          return;
        }
        addWaypoint(action.name);
      }
    });
  }, [assistant, selectDisplayMode, addWaypoint, hasFix]);

  /**
   * O compasso falado (ideia #11): o rumo e a distância ao alvo, de nove em
   * nove segundos — e só quando a Kefera não está a ouvir, para as duas vozes
   * não se atropelarem.
   */
  useEffect(() => {
    if (!voiceGuide) {
      return;
    }
    const id = setInterval(() => {
      if (assistant.open || assistant.listening) {
        return;
      }
      const guide = guideRef.current;
      if (!guide.hasFix || Date.now() - lastSpokeRef.current < GUIDE_INTERVAL_MS) {
        return;
      }
      lastSpokeRef.current = Date.now();
      let phrase = t('voice_guide_heading', {
        cardinal: guide.cardinal,
        deg: Math.round(guide.heading),
      });
      if (guide.target) {
        phrase += `. ${t('voice_guide_target', {
          name: guide.target.name,
          distance: formatDistance(guide.target.distance),
        })}`;
      }
      speak(phrase);
    }, 1000);
    return () => clearInterval(id);
  }, [voiceGuide, assistant.open, assistant.listening, t]);
};
