import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Vibration } from 'react-native';

import { syncAllCollections, syncWaypoints } from '../../services/cloudSync';
import {
  createWaypointId,
  loadWaypoints,
  removeWaypoint,
  saveWaypoint,
  type Waypoint,
} from '../../services/waypointsService';
import {
  addGeofence,
  removeGeofence,
} from '../../services/geofenceService';
import { speak } from '../../assistant/voice';
import { elevationAngle, haversine, initialBearing } from '../../utils/geo';
import { normalizeHeading } from '../../utils/compass';
import type { Declination } from '../../utils/declination';
import type { LocationFix } from '../../services/locationService';
import type { KnownWaypoint } from '../../assistant/types';
import type { Translator } from '../../i18n/strings';

const ARRIVE_METERS = 15;

export type ActiveTarget = {
  name: string;
  bearing: number;
  distance: number;
  elevation: number | null;
};

export type UseWaypointsOptions = {
  location: LocationFix;
  hasFix: boolean;
  declination: Declination;
  /** O marco virtual: o ponto que o AR aponta sempre. */
  virtualWpId: string | null;
  /** O compasso falado: ao chegar, a Kefera diz o nome do sítio. */
  voiceGuide: boolean;
  /** Chamado quando o ponto apagado era o marco virtual. */
  clearVirtualWp?: (id: string) => void;
  t: Translator;
};

export type WaypointsState = {
  waypoints: Waypoint[];
  activeWpId: string | null;
  setActiveWpId: (id: string | null) => void;
  activeTarget: ActiveTarget | null;
  /** O mesmo alvo, com a declinação já descontada (para o AR). */
  targetMarker: ActiveTarget | null;
  /** O marco virtual, com a declinação já descontada. */
  virtualMarker: ActiveTarget | null;
  /** Os pontos com distância e rumo, para a assistente. */
  assistantWaypoints: KnownWaypoint[];
  /** Chegou ao destino? */
  arrived: boolean;
  addWaypoint: (name: string) => Promise<void>;
  addRemoteWaypoint: (wp: {
    name: string;
    latitude: number;
    longitude: number;
  }) => Promise<void>;
  deleteWaypoint: (id: string) => Promise<void>;
  /** Relê do armazenamento — usado depois de restaurar um backup. */
  reload: () => Promise<void>;
};

/**
 * Os pontos guardados: a lista, o alvo activo, o marco virtual e as
 * geofences.
 *
 * O alvo activo é o ponto para onde a seta aponta; o marco virtual é o ponto
 * que fica cravado no AR. São coisas diferentes: o primeiro muda, o segundo
 * fica.
 */
export const useWaypoints = ({
  location,
  hasFix,
  declination,
  virtualWpId,
  voiceGuide,
  clearVirtualWp,
  t,
}: UseWaypointsOptions): WaypointsState => {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [activeWpId, setActiveWpId] = useState<string | null>(null);
  const [arrived, setArrived] = useState(false);
  const arrivedWpRef = useRef<string | null>(null);

  useEffect(() => {
    loadWaypoints().then(setWaypoints).catch(() => {});
    // Sincronização com a nuvem (ideia #18): puxa o que existe noutro aparelho,
    // junta com o local e sobe o que mudou. Corre em segundo plano e não
    // bloqueia o arranque; sem rede, o `setWaypoints` leva a lista local.
    syncAllCollections()
      .then(result => setWaypoints(result.waypoints))
      .catch(() => {});
  }, []);

  const reload = useCallback(async () => {
    const next = await loadWaypoints().catch(() => null);
    if (next) setWaypoints(next);
  }, []);

  const addWaypoint = useCallback(
    async (name: string) => {
      if (location.latitude === 0 && location.longitude === 0) return;
      const wp: Waypoint = {
        id: createWaypointId(),
        name,
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        createdAt: Date.now(),
      };
      const next = await saveWaypoint(wp);
      setWaypoints(next);
      // Sobe o ponto novo e junta o que a nuvem tenha entretanto (ideia #18).
      syncWaypoints().then(setWaypoints).catch(() => {});
    },
    [location],
  );

  const addRemoteWaypoint = useCallback(
    async (wp: { name: string; latitude: number; longitude: number }) => {
      const entry: Waypoint = {
        id: createWaypointId(),
        name: wp.name,
        latitude: wp.latitude,
        longitude: wp.longitude,
        altitude: null,
        createdAt: Date.now(),
      };
      const next = await saveWaypoint(entry);
      setWaypoints(next);
      syncWaypoints().then(setWaypoints).catch(() => {});
    },
    [],
  );

  const deleteWaypoint = useCallback(async (id: string) => {
    const next = await removeWaypoint(id);
    setWaypoints(next);
    // `removeWaypoint` deixou a lápide; o sync apaga a linha na nuvem (ideia #18).
    syncWaypoints().then(setWaypoints).catch(() => {});
    setActiveWpId(current => (current === id ? null : current));
    clearVirtualWp?.(id);
  }, [clearVirtualWp]);

  const activeTarget = useMemo(() => {
    if (!activeWpId) return null;
    const wp = waypoints.find(w => w.id === activeWpId);
    if (!wp || (location.latitude === 0 && location.longitude === 0)) return null;
    const distance = haversine(location.latitude, location.longitude, wp.latitude, wp.longitude);
    const bearing = initialBearing(location.latitude, location.longitude, wp.latitude, wp.longitude);
    // elevação do alvo acima de quem observa: só existe se os dois tiverem
    // altitude guardada (waypoints sem altitude ficam sem marcador vertical)
    const elevation =
      wp.altitude !== null && location.altitude !== null
        ? elevationAngle(wp.altitude - location.altitude, distance)
        : null;
    return { name: wp.name, bearing, distance, elevation };
  }, [activeWpId, waypoints, location.latitude, location.longitude, location.altitude]);

  const targetMarker = useMemo(() => {
    if (!activeTarget) return null;
    return {
      ...activeTarget,
      bearing: normalizeHeading(
        activeTarget.bearing - (declination.enabled ? 0 : declination.degrees),
      ),
    };
  }, [activeTarget, declination.enabled, declination.degrees]);

  const virtualMarker = useMemo(() => {
    if (!virtualWpId) return null;
    const wp = waypoints.find(w => w.id === virtualWpId);
    if (!wp) return null;
    if (!hasFix) {
      return { name: wp.name, bearing: 0, distance: 0, elevation: null };
    }
    const distance = haversine(
      location.latitude,
      location.longitude,
      wp.latitude,
      wp.longitude,
    );
    const bearing = initialBearing(
      location.latitude,
      location.longitude,
      wp.latitude,
      wp.longitude,
    );
    return {
      name: wp.name,
      bearing: normalizeHeading(
        bearing - (declination.enabled ? 0 : declination.degrees),
      ),
      distance,
      elevation:
        wp.altitude !== null && location.altitude !== null
          ? elevationAngle(wp.altitude - location.altitude, distance)
          : null,
    };
  }, [
    virtualWpId,
    waypoints,
    location,
    hasFix,
    declination.enabled,
    declination.degrees,
  ]);

  const assistantWaypoints = useMemo<KnownWaypoint[]>(() => {
    if (
      (location.latitude === 0 && location.longitude === 0) ||
      waypoints.length === 0
    ) {
      return waypoints.map(wp => ({
        ...wp,
        distance: null,
        bearing: null,
      }));
    }
    return waypoints.map(wp => ({
      ...wp,
      distance: haversine(
        location.latitude,
        location.longitude,
        wp.latitude,
        wp.longitude,
      ),
      bearing: initialBearing(
        location.latitude,
        location.longitude,
        wp.latitude,
        wp.longitude,
      ),
    }));
  }, [waypoints, location.latitude, location.longitude]);

  // Chegada ao destino: vibra, avisa e fala — uma vez por ponto.
  useEffect(() => {
    if (!activeTarget || !activeWpId) {
      arrivedWpRef.current = null;
      setArrived(false);
      return;
    }
    if (activeTarget.distance <= ARRIVE_METERS) {
      if (arrivedWpRef.current !== activeWpId) {
        arrivedWpRef.current = activeWpId;
        setArrived(true);
        try {
          Vibration.vibrate([0, 300, 200, 300]);
        } catch {
          Vibration.vibrate(500);
        }
        if (voiceGuide) {
          speak(t('voice_guide_arrived', { name: activeTarget.name }));
        }
      }
    } else if (
      activeTarget.distance > ARRIVE_METERS + 10 &&
      arrivedWpRef.current === activeWpId
    ) {
      arrivedWpRef.current = null;
      setArrived(false);
    }
  }, [activeTarget, activeWpId, voiceGuide, t]);

  // As geofences: o aviso de chegada do Android, para o telemóvel no bolso.
  useEffect(() => {
    if (waypoints.length === 0 || !hasFix) return;
    // Recria só quando os waypoints (ou a disponibilidade de fix) mudam. Antes
    // o efeito dependia de lat/lon e disparava a cada fix, removendo e
    // re-registrando todas as geofences — com o remove (fire-and-forget) e o
    // add concorrendo, dava para uma geofence cair no chão em silêncio.
    for (const wp of waypoints) {
      addGeofence({
        id: wp.id,
        name: wp.name,
        title: t('gf_notify_title'),
        latitude: wp.latitude,
        longitude: wp.longitude,
        radius: 150,
      }).catch(() => {});
    }
    return () => {
      for (const wp of waypoints) {
        removeGeofence(wp.id).catch(() => {});
      }
    };
  }, [waypoints, hasFix, t]);

  return {
    waypoints,
    activeWpId,
    setActiveWpId,
    activeTarget,
    targetMarker,
    virtualMarker,
    assistantWaypoints,
    arrived,
    addWaypoint,
    addRemoteWaypoint,
    deleteWaypoint,
    reload,
  };
};
