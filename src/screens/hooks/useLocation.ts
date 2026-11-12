import { useCallback, useEffect, useRef, useState } from 'react';

import { getLocationOnce, watchLocation, type LocationFix, type LocationMode } from '../../services/locationService';
import { reverseGeocode } from '../../services/geocodingService';
import { addDistance } from '../../services/odometerService';
import { updateFixQuality } from '../../services/sensorLogService';
import { setLastLocation } from '../../services/lastLocation';
import { haversine } from '../../utils/geo';
import { lunarPosition, moonPhase, solarPosition, type CelestialPoint } from '../../utils/astro';
import type { Translator } from '../../i18n/strings';

const IDLE_STEPS = 4;

export type Place = { name: string; cep: string | null };

export type UseLocationOptions = {
  /** O sensor diz se a pessoa está em movimento (muda a suavização do rumo). */
  setMoving: (moving: boolean) => void;
  t: Translator;
  /** O idioma, para o endereço vir na língua de quem lê. */
  lang: string;
};

export type LocationState = {
  location: LocationFix;
  locError: string | null;
  locLoading: boolean;
  locationMode: LocationMode;
  /** O odómetro: metros desde que a app foi aberta. */
  odometer: number;
  /** O endereço do sítio, quando o serviço o consegue dizer. */
  place: Place | null;
  /** O painel da localização está expandido? */
  locExpanded: boolean;
  setLocExpanded: (expanded: boolean) => void;
  /** O Sol, a Lua e a fase da Lua, para o AR e para o relógio de sol. */
  celestial: {
    sun: CelestialPoint;
    moon: CelestialPoint;
    moonIcon: string;
  } | null;
  /** A última posição, sempre atual — para o polling que não pode reiniciar. */
  latestFixRef: { current: { latitude: number; longitude: number } };
  selectMode: (mode: LocationMode) => void;
  refreshLocation: () => void;
  /** Zera o odómetro vivo (o total diário persistido é zerado à parte). */
  resetOdometer: () => void;
};

/**
 * A localização: o watch do GPS, o odómetro, o endereço e o céu.
 *
 * O watch relaxa quando a pessoa fica parada (quatro leituras sem movimento):
 * o GPS passa a ler de 20 em 20 segundos e a filtrar abaixo de 50 m, e volta
 * ao fino assim que há movimento. Sem isso, a bateria do telemóvel acaba
 * antes do fim da caminhada — e é o modo trilha que mais sofre com isso.
 */
export const useLocation = ({
  setMoving,
  t,
  lang,
}: UseLocationOptions): LocationState => {
  const [location, setLocation] = useState<LocationFix>({
    latitude: 0,
    longitude: 0,
    accuracy: null,
    altitude: null,
    speed: null,
    provider: null,
    updatedAt: null,
    heading: null,
  });
  const [locError, setLocError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [locationMode, setLocationMode] = useState<LocationMode>('satellite');
  const [odometer, setOdometer] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);
  const [locExpanded, setLocExpanded] = useState(false);
  const [celestial, setCelestial] = useState<{
    sun: CelestialPoint;
    moon: CelestialPoint;
    moonIcon: string;
  } | null>(null);

  const geoLastRef = useRef<{ lat: number; lon: number; at: number } | null>(null);
  const latestFixRef = useRef<{ latitude: number; longitude: number }>({
    latitude: 0,
    longitude: 0,
  });
  const stopWatchRef = useRef<(() => void) | null>(null);
  const prevFixRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const distTotalRef = useRef(0);
  const currentModeRef = useRef<LocationMode>('satellite');
  const idleCountRef = useRef(0);
  const relaxedRef = useRef(false);

  // A última posição conhecida, sempre atual: usada por efeitos de polling que
  // não podem se recriar a cada fix do GPS (alertas de clima, etc.).
  useEffect(() => {
    latestFixRef.current = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  });

  const handleFix = useCallback(
    (fix: LocationFix) => {
      const prev = prevFixRef.current;
      const d = prev
        ? haversine(
            prev.latitude,
            prev.longitude,
            fix.latitude,
            fix.longitude,
          )
        : 0;
      if (d > 0 && d < 500) {
        distTotalRef.current += d;
        setOdometer(distTotalRef.current);
        addDistance(d).catch(() => {});
      }
      prevFixRef.current = { latitude: fix.latitude, longitude: fix.longitude };

      const moving = d > 2 || (fix.speed ?? 0) > 2;
      setMoving(moving);
      idleCountRef.current = moving ? 0 : idleCountRef.current + 1;

      if (!relaxedRef.current && idleCountRef.current >= IDLE_STEPS) {
        relaxedRef.current = true;
        applyWatchingRef.current(currentModeRef.current, true, false);
      } else if (
        relaxedRef.current &&
        moving &&
        idleCountRef.current === 0
      ) {
        applyWatchingRef.current(currentModeRef.current, false, false);
      }

      setLocation(fix);
      setLocLoading(false);
      setLocError(null);
      // Só a qualidade do GPS entra no log (ideia #63), nunca a posição.
      updateFixQuality(fix.accuracy, fix.speed);
      // A posição partilhada serve o tema "pelo sol real" (ideia #15).
      setLastLocation(fix.latitude, fix.longitude);
    },
    [setMoving],
  );

  const handleLocError = useCallback(
    (error: Error) => {
      setLocLoading(false);
      setLocError(error.message || t('ui_loc_error_default'));
    },
    [t],
  );

  const applyWatching = useCallback(
    (mode: LocationMode, relaxed = false, announce = true) => {
      stopWatchRef.current?.();
      currentModeRef.current = mode;
      relaxedRef.current = relaxed;
      idleCountRef.current = 0;
      if (announce) setLocLoading(true);
      stopWatchRef.current = watchLocation(
        { mode, relaxed },
        handleFix,
        handleLocError,
      );
    },
    [handleFix, handleLocError],
  );

  const applyWatchingRef = useRef(applyWatching);
  applyWatchingRef.current = applyWatching;

  useEffect(() => {
    applyWatching(locationMode);
    return () => stopWatchRef.current?.();
  }, [locationMode, applyWatching]);

  const refreshLocation = useCallback(() => {
    if (locLoading) return;
    setLocLoading(true);
    getLocationOnce({ mode: locationMode }, handleFix, handleLocError);
  }, [locLoading, locationMode, handleFix, handleLocError]);

  const selectMode = useCallback((mode: LocationMode) => {
    setLocationMode(mode);
  }, []);

  const resetOdometer = useCallback(() => {
    distTotalRef.current = 0;
    setOdometer(0);
  }, []);

  // O endereço: só se pergunta quando o sítio mudou o suficiente, e nunca mais
  // do que uma vez por deslocação (o serviço é de terceiros e é lento).
  useEffect(() => {
    const lat = location.latitude;
    const lon = location.longitude;
    if (lat === 0 && lon === 0) return;
    const last = geoLastRef.current;
    const now = Date.now();
    let needs = true;
    if (last) {
      const d = haversine(last.lat, last.lon, lat, lon);
      needs = d > 150 || now - last.at > 30000;
    }
    if (!needs) return;
    geoLastRef.current = { lat, lon, at: now };
    let cancelled = false;
    reverseGeocode(lat, lon, lang)
      .then(res => {
        if (!cancelled && res) setPlace(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location.latitude, location.longitude, lang]);

  // O céu muda devagar: um minuto chega, e recalcular a cada fix era
  // desperdício de CPU à toa.
  useEffect(() => {
    const lat = location.latitude;
    const lon = location.longitude;
    if (lat === 0 && lon === 0) return;
    const update = () => {
      const now = new Date();
      setCelestial({
        sun: solarPosition(now, lat, lon),
        moon: lunarPosition(now, lat, lon),
        moonIcon: moonPhase(now).icon,
      });
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [location.latitude, location.longitude]);

  return {
    location,
    locError,
    locLoading,
    locationMode,
    odometer,
    place,
    locExpanded,
    setLocExpanded,
    celestial,
    latestFixRef,
    selectMode,
    refreshLocation,
    resetOdometer,
  };
};
