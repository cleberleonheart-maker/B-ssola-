import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Alert,
  Share,
  Vibration,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  magnetometer,
  accelerometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import CompassDial from '../components/CompassDial';
import CalibrationModal from '../components/CalibrationModal';
import SettingsModal from '../components/SettingsModal';
import BarometerPanel from '../components/BarometerPanel';
import BubbleLevel from '../components/BubbleLevel';
import WaypointModal from '../components/WaypointModal';
import AROverlay from '../components/AROverlay';
import CameraARView from '../components/CameraARView';
import ErrorBoundary from '../components/ErrorBoundary';
import AlertsModal from '../components/AlertsModal';
import MetalDetectorView from '../components/MetalDetectorView';
import EmfReaderView from '../components/EmfReaderView';
import EmergencyModal from '../components/EmergencyModal';
import TheodoliteView from '../components/TheodoliteView';
import HeightView from '../components/HeightView';
import CarSpotView from '../components/CarSpotView';
import SunWatchView from '../components/SunWatchView';
import TriangulationView from '../components/TriangulationView';
import WindView from '../components/WindView';
import TargetNavBar from '../components/TargetNavBar';
import TrackView from '../components/TrackView';
import FieldNotesSheet from '../components/FieldNotesSheet';
import CoordModal from '../components/CoordModal';
import {
  fetchCivilAlerts,
  isSevere,
} from '../services/alertsService';
import { showAlertNotification } from '../services/notifications';
import { useThemeColors, useTheme } from '../theme/ThemeContext';
import { useAssistant } from '../assistant/AssistantContext';
import { speak } from '../assistant/voice';
import KefferaAvatar from '../components/KefferaAvatar';
import { useLanguage } from '../i18n/LanguageContext';
import type { KnownWaypoint } from '../assistant/types';
import { spacing, radius } from '../theme/colors';
import {
  watchLocation,
  getLocationOnce,
  type LocationFix,
  type LocationMode,
} from '../services/locationService';
import { reverseGeocode } from '../services/geocodingService';
import {
  loadCalibration,
  applyCalibration,
  type MagCalibration,
} from '../services/calibrationService';
import {
  watchBarometer,
  barometricAltitude,
} from '../services/barometerService';
import {
  loadWaypoints,
  saveWaypoint,
  removeWaypoint,
  createWaypointId,
  type Waypoint,
} from '../services/waypointsService';
import {
  loadDeclination,
  saveDeclination,
  loadAppMode,
  saveAppMode,
  loadDisplayMode,
  saveDisplayMode,
  loadVoiceGuide,
  saveVoiceGuide,
  loadVirtualWp,
  saveVirtualWp,
  type AppMode,
  type DisplayMode,
} from '../services/preferencesService';
import {
  applyDeclination,
  suggestDeclination,
  type Declination,
} from '../utils/declination';
import {
  getHeading,
  normalizeHeading,
  cardinalOf,
  formatCoord,
  formatTime,
} from '../utils/compass';
import {
  haversine,
  initialBearing,
  formatDistance,
} from '../utils/geo';
import {
  solarPosition,
  lunarPosition,
  moonPhase,
  type CelestialPoint,
} from '../utils/astro';
import { useRepetitiveBeep, soundAvailable } from '../services/sound';
import {
  updateWidget,
  widgetSupported,
} from '../services/widgetService';
import {
  addGeofence,
  removeGeofence,
  requestNotificationPermission,
  geofenceSupported,
} from '../services/geofenceService';

const SENSOR_INTERVAL = 200;
const SMOOTHING_FAST = 0.45;
const SMOOTHING_SLOW = 0.08;
const ROTATION_DEAD_ZONE = 0.5;
const ACCEL_VERIFY_SAMPLES = 20;
const ACCEL_MIN_MAGNITUDE = 0.6;
const IDLE_STEPS = 4;
const ARRIVE_METERS = 15;
const GUIDE_INTERVAL_MS = 9000;

const CompassScreen = () => {
  const colors = useThemeColors();
  const { theme } = useTheme();
  const assistant = useAssistant();
  const { t, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const welcomedRef = useRef(false);
  useEffect(() => {
    if (welcomedRef.current) {
      return;
    }
    welcomedRef.current = true;
    assistant.welcome();
  }, [assistant]);
  const { width, height } = useWindowDimensions();
  const [dialAreaH, setDialAreaH] = useState(0);

  const handleDialAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setDialAreaH(prev => (prev === h ? prev : h));
  }, []);

  const arSize = useMemo(() => {
    const maxByWidth = width - spacing.lg * 2;
    const maxByHeight = height - 320;
    return Math.max(
      220,
      Math.min(380, Math.floor(Math.min(maxByWidth, maxByHeight))),
    );
  }, [width, height]);

  const [heading, setHeading] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [accel, setAccel] = useState({ x: 0, y: 0, z: 9.81 });
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [accelError, setAccelError] = useState<string | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [locationMode, setLocationMode] = useState<LocationMode>('satellite');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [coordVisible, setCoordVisible] = useState(false);
  const [calibrationVisible, setCalibrationVisible] = useState(false);
  const [alertsVisible, setAlertsVisible] = useState(false);
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const alertsCheckedRef = useRef(false);
  const notifiedAlertsRef = useRef(new Set<string>());
  const [calibrated, setCalibrated] = useState(false);
  const calibrationRef = useRef<MagCalibration | null>(null);
  const calPromptedRef = useRef(false);
  const [location, setLocation] = useState<LocationFix>({
    latitude: 0,
    longitude: 0,
    accuracy: null,
    altitude: null,
    speed: null,
    provider: null,
    updatedAt: null,
  });
  const [place, setPlace] = useState<{ name: string; cep: string | null } | null>(null);
  const geoLastRef = useRef<{ lat: number; lon: number; at: number } | null>(null);

  const prevHeadingRef = useRef<number | null>(null);
  const continuousRef = useRef(0);
  const smoothedRef = useRef(0);
  const smoothingRef = useRef(SMOOTHING_FAST);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const prevFixRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const distTotalRef = useRef(0);
  const currentModeRef = useRef<LocationMode>('satellite');
  const idleCountRef = useRef(0);
  const relaxedRef = useRef(false);
  const [locExpanded, setLocExpanded] = useState(false);

  const [declination, setDeclinationState] = useState<Declination>({
    enabled: false,
    degrees: 0,
  });
  const declinationRef = useRef(declination);
  const [appMode, setAppModeState] = useState<AppMode>('full');
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('compass');
  const [launcherVisible, setLauncherVisible] = useState(true);

  const dialSize = useMemo(() => {
    const maxByWidth = width - spacing.lg * 2 - spacing.md;
    const reservedHeading = 100;
    const fallbackBudget = appMode === 'full' ? 500 : 460;
    const maxByHeight =
      dialAreaH > 0 ? dialAreaH - reservedHeading : height - fallbackBudget;
    const fit = Math.floor(Math.min(maxByWidth, maxByHeight));
    return Math.max(168, Math.min(252, fit));
  }, [width, height, dialAreaH, appMode]);

  const [baroPressure, setBaroPressure] = useState<number | null>(null);
  const [baroAvailable, setBaroAvailable] = useState(true);
  const [baroBaseline, setBaroBaseline] = useState<number | null>(null);

  const [odometer, setOdometer] = useState(0);

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [wpVisible, setWpVisible] = useState(false);
  const [activeWpId, setActiveWpId] = useState<string | null>(null);
  const [virtualWpId, setVirtualWpId] = useState<string | null>(null);
  const [voiceGuide, setVoiceGuide] = useState(false);
  const [arrived, setArrived] = useState(false);
  const arrivedWpRef = useRef<string | null>(null);
  const lastSpokeRef = useRef(0);
  const guideRef = useRef<{
    hasFix: boolean;
    heading: number;
    cardinal: string;
    target: { name: string; distance: number } | null;
  }>({ hasFix: false, heading: 0, cardinal: '', target: null });

  const [celestial, setCelestial] = useState<{
    sun: CelestialPoint;
    moon: CelestialPoint;
    moonIcon: string;
  } | null>(null);

  useEffect(() => {
    loadCalibration().then(cal => {
      calibrationRef.current = cal;
      setCalibrated(cal !== null);
    });
    loadDeclination().then(decl => {
      declinationRef.current = decl;
      setDeclinationState(decl);
    });
    loadAppMode().then(setAppModeState);
    loadDisplayMode().then(setDisplayModeState);
    loadWaypoints().then(setWaypoints);
    loadVoiceGuide().then(setVoiceGuide);
    loadVirtualWp().then(id => {
      setVirtualWpId(id);
    });
  }, []);

  useEffect(() => {
    if (calibrated || calPromptedRef.current || calibrationVisible) {
      return;
    }
    if (displayMode !== 'compass' || launcherVisible) {
      return;
    }
    calPromptedRef.current = true;
    const id = setTimeout(() => setCalibrationVisible(true), 1500);
    return () => clearTimeout(id);
  }, [calibrated, calibrationVisible, displayMode, launcherVisible]);

  const toggleVoiceGuide = useCallback(() => {
    setVoiceGuide(prev => {
      const next = !prev;
      saveVoiceGuide(next).catch(() => {});
      return next;
    });
  }, []);

  const setDeclination = useCallback((decl: Declination) => {
    declinationRef.current = decl;
    setDeclinationState(decl);
    saveDeclination(decl).catch(() => {});
  }, []);

  const selectAppMode = useCallback((mode: AppMode) => {
    setAppModeState(mode);
    saveAppMode(mode).catch(() => {});
  }, []);

  const selectDisplayMode = useCallback((mode: DisplayMode) => {
    setDisplayModeState(mode);
    saveDisplayMode(mode).catch(() => {});
  }, []);

  const openMode = useCallback(
    (mode: DisplayMode) => {
      selectDisplayMode(mode);
      setLauncherVisible(false);
    },
    [selectDisplayMode],
  );

  const goHome = useCallback(() => {
    setLauncherVisible(true);
  }, []);

  const handleHeading = useCallback((degrees: number) => {
    const raw = normalizeHeading(degrees);
    const normalized = applyDeclination(raw, declinationRef.current);

    if (prevHeadingRef.current === null) {
      prevHeadingRef.current = normalized;
      continuousRef.current = normalized;
      smoothedRef.current = normalized;
      setHeading(normalized);
      setRotation(normalized);
      return;
    }

    let delta = normalized - prevHeadingRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    continuousRef.current += delta;
    prevHeadingRef.current = normalized;

    const previous = smoothedRef.current;
    const next =
      previous +
      (continuousRef.current - previous) * smoothingRef.current;
    smoothedRef.current = next;

    if (Math.abs(next - previous) < ROTATION_DEAD_ZONE) {
      return;
    }

    setHeading(normalized);
    setRotation(next);
  }, []);

  const handleFix = useCallback((fix: LocationFix) => {
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
    }
    prevFixRef.current = { latitude: fix.latitude, longitude: fix.longitude };

    const moving = d > 2 || (fix.speed ?? 0) > 2;
    smoothingRef.current = moving ? SMOOTHING_FAST : SMOOTHING_SLOW;
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
  }, []);

  const handleLocError = useCallback((error: Error) => {
    setLocLoading(false);
    setLocError(error.message || t('ui_loc_error_default'));
  }, [t]);

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
    setUpdateIntervalForType(SensorTypes.accelerometer, SENSOR_INTERVAL);
    setUpdateIntervalForType(SensorTypes.magnetometer, SENSOR_INTERVAL);

    let lastAccel = { x: 0, y: 0, z: 1 };
    let lastMag = { x: 0, y: 0, z: 0 };
    let accelSamples = 0;
    let accelMagMax = 0;

    const magSub = magnetometer.subscribe({
      next: ({ x, y, z }: { x: number; y: number; z: number }) => {
        lastMag = applyCalibration({ x, y, z }, calibrationRef.current);
        const headingDeg = getHeading(lastAccel, lastMag);
        if (headingDeg !== null && headingDeg !== undefined) {
          handleHeading(headingDeg);
        }
      },
      error: (error: Error) => {
        setSensorError(t('ui_mag_unavailable'));
        console.warn('magnetometer error', error);
      },
    });

    const accelSub = accelerometer.subscribe({
      next: ({ x, y, z }: { x: number; y: number; z: number }) => {
        lastAccel = { x, y, z };
        setAccel({ x, y, z });

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          setAccelError(t('ui_accel_invalid'));
          return;
        }

        accelMagMax = Math.max(
          accelMagMax,
          Math.sqrt(x ** 2 + y ** 2 + z ** 2),
        );
        accelSamples += 1;

        if (accelSamples >= ACCEL_VERIFY_SAMPLES) {
          if (accelMagMax < ACCEL_MIN_MAGNITUDE) {
            setAccelError(t('ui_accel_verify'));
          } else {
            setAccelError(null);
          }
          accelSamples = 0;
          accelMagMax = 0;
        }
      },
      error: (error: Error) => {
        setAccelError(t('ui_accel_unavailable'));
        console.warn('accelerometer error', error);
      },
    });

    return () => {
      magSub.unsubscribe();
      accelSub.unsubscribe();
    };
  }, [handleHeading, t]);

  useEffect(() => {
    const stop = watchBarometer(
      reading => setBaroPressure(reading.pressure),
      () => setBaroAvailable(false),
    );
    return stop;
  }, []);

  useEffect(() => {
    applyWatching(locationMode);
    return () => stopWatchRef.current?.();
  }, [locationMode, applyWatching]);

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

  useEffect(() => {
    const lat = location.latitude;
    const lon = location.longitude;
    if (lat === 0 && lon === 0) return;
    let active = true;
    const check = () => {
      fetchCivilAlerts(lat, lon).then(result => {
        if (!active) return;
        if (isSevere(result)) {
          setAlertsVisible(true);
        }
        result.weather
          .filter(
            alert => alert.severity === 'orange' || alert.severity === 'red',
          )
          .forEach(alert => {
            const key = `${alert.severity}|${alert.event}|${alert.expires ?? 'x'}`;
            if (!notifiedAlertsRef.current.has(key)) {
              notifiedAlertsRef.current.add(key);
              showAlertNotification(alert);
            }
          });
      });
    };
    if (!alertsCheckedRef.current) {
      alertsCheckedRef.current = true;
      check();
    }
    const id = setInterval(check, 30 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [location.latitude, location.longitude]);

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
    reverseGeocode(lat, lon, lang).then(res => {
      if (!cancelled && res) setPlace(res);
    });
    return () => {
      cancelled = true;
    };
  }, [location.latitude, location.longitude, lang]);

  const refreshLocation = useCallback(() => {
    if (locLoading) return;
    setLocLoading(true);
    getLocationOnce({ mode: locationMode }, handleFix, handleLocError);
  }, [locLoading, locationMode, handleFix, handleLocError]);

  const selectMode = useCallback((mode: LocationMode) => {
    setLocationMode(mode);
  }, []);

  const openCalibration = useCallback(() => {
    setSettingsVisible(false);
    setCalibrationVisible(true);
  }, []);

  const handleCalibrationSave = useCallback((cal: MagCalibration | null) => {
    calibrationRef.current = cal;
    setCalibrated(cal !== null);
  }, []);

  const requestGeoNotifications = useCallback(async () => {
    await requestNotificationPermission();
  }, []);

  const openWaypoints = useCallback(() => {
    setSettingsVisible(false);
    setWpVisible(true);
    requestGeoNotifications();
  }, [requestGeoNotifications]);

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
    },
    [],
  );

  const deleteWaypoint = useCallback(async (id: string) => {
    const next = await removeWaypoint(id);
    setWaypoints(next);
    setActiveWpId(current => (current === id ? null : current));
    setVirtualWpId(current => {
      if (current === id) {
        saveVirtualWp(null).catch(() => {});
        return null;
      }
      return current;
    });
  }, []);

  const selectVirtualWp = useCallback((id: string | null) => {
    setVirtualWpId(id);
    saveVirtualWp(id).catch(() => {});
  }, []);

  const activeTarget = useMemo(() => {
    if (!activeWpId) return null;
    const wp = waypoints.find(w => w.id === activeWpId);
    if (!wp || (location.latitude === 0 && location.longitude === 0)) return null;
    const distance = haversine(location.latitude, location.longitude, wp.latitude, wp.longitude);
    const bearing = initialBearing(location.latitude, location.longitude, wp.latitude, wp.longitude);
    return { name: wp.name, bearing, distance };
  }, [activeWpId, waypoints, location.latitude, location.longitude]);

  const shareLocation = useCallback(async () => {
    if (location.latitude === 0 && location.longitude === 0) {
      Alert.alert(t('ui_no_loc_title'), t('ui_no_loc_body'));
      return;
    }
    try {
      await Share.share({
        message: `📍 ${t('ui_share_here')} — ${t('ui_app_title')}\n${formatCoord(location.latitude, true)}\n${formatCoord(location.longitude, false)}\n${t('ui_share_accuracy')}: ±${Math.round(location.accuracy ?? 0)} m`,
      });
    } catch {
      Alert.alert(t('ui_error'), t('ui_share_error'));
    }
  }, [location, t]);

  const declinationSuggest = useMemo(
    () => suggestDeclination(location.latitude, location.longitude),
    [location.latitude, location.longitude],
  );

  const arSupported = !sensorError && !accelError;
  const arBlocked = arSupported ? null : t('ui_ar_blocked');
  const arLabel = arSupported ? t('ui_ar_ready') : t('ui_ar_blocked');

  const baroAlt =
    baroPressure != null ? barometricAltitude(baroPressure, baroBaseline) : null;

  const sunMarker = celestial
    ? {
        ...celestial.sun,
        azimuth: normalizeHeading(
          celestial.sun.azimuth - (declination.enabled ? 0 : declination.degrees),
        ),
      }
    : null;
  const moonMarker = celestial
    ? {
        ...celestial.moon,
        azimuth: normalizeHeading(
          celestial.moon.azimuth - (declination.enabled ? 0 : declination.degrees),
        ),
      }
    : null;

  const targetMarker = activeTarget
    ? {
        ...activeTarget,
        bearing: normalizeHeading(
          activeTarget.bearing - (declination.enabled ? 0 : declination.degrees),
        ),
      }
    : null;

  const virtualMarker = useMemo(() => {
    if (!virtualWpId) return null;
    const wp = waypoints.find(w => w.id === virtualWpId);
    if (!wp) return null;
    const hasPos = location.latitude !== 0 || location.longitude !== 0;
    if (!hasPos) {
      return { name: wp.name, bearing: 0, distance: 0 };
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
    };
  }, [
    virtualWpId,
    waypoints,
    location.latitude,
    location.longitude,
    declination.enabled,
    declination.degrees,
  ]);

  const cardinal = cardinalOf(heading);
  const fullView = displayMode === 'compass' || displayMode === 'level';
  const showPanels = launcherVisible || fullView;
  const providerLabel =
    locationMode === 'satellite'
      ? t('ui_provider_satellite')
      : locationMode === 'tower'
      ? t('ui_provider_tower')
      : t('ui_provider_wifi');
  const providerAccent =
    locationMode === 'satellite'
      ? colors.primary
      : locationMode === 'tower'
      ? colors.accent
      : colors.success;

  const hasFix =
    location.latitude !== 0 || location.longitude !== 0 || location.provider !== null;

  const gMag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2) || 1;
  const tiltX = accel.x / gMag;
  const tiltY = -accel.y / gMag;
  const levelValue = Math.max(0, 1 - Math.sqrt(tiltX * tiltX + tiltY * tiltY));
  const leveled = levelValue >= 0.995;
  const levelBeepEnabled = fullView && displayMode === 'level' && soundAvailable;
  useRepetitiveBeep({
    intervalMs: leveled ? 800 : Math.max(40, 1100 - levelValue * 1050),
    frequency: leveled ? 1250 : 540,
    durationMs: leveled ? 70 : 30,
    enabled: levelBeepEnabled,
  });

  const issueWarnings = [sensorError, accelError].filter(
    (err): err is string => !!err,
  );
  const showInstrumentPanels =
    appMode === 'full' || appMode === 'adventure';

  const targetRelative = targetMarker
    ? normalizeHeading(targetMarker.bearing - heading)
    : 0;
  const cardinalFull = cardinal.full;

  useEffect(() => {
    guideRef.current = {
      hasFix,
      heading,
      cardinal: cardinalFull,
      target: activeTarget
        ? { name: activeTarget.name, distance: activeTarget.distance }
        : null,
    };
  }, [hasFix, heading, cardinalFull, activeTarget]);

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
        Vibration.vibrate(500);
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

  useEffect(() => {
    const hasLocationFix = location.latitude !== 0 || location.longitude !== 0;
    assistant.setContextData({
      heading,
      cardinal: cardinal.full,
      latitude: hasLocationFix ? location.latitude : null,
      longitude: hasLocationFix ? location.longitude : null,
      accuracy: location.accuracy,
      altitude: location.altitude,
      speed: location.speed,
      pressure: baroPressure,
      baroAvailable,
      declinationEnabled: declination.enabled,
      declination: declination.degrees,
      odometer,
      appMode,
      displayMode,
      theme,
      waypoints: assistantWaypoints,
    });
  }, [
    assistant,
    heading,
    cardinal,
    location,
    baroPressure,
    baroAvailable,
    declination,
    odometer,
    appMode,
    displayMode,
    theme,
    assistantWaypoints,
  ]);

  useEffect(() => {
    assistant.setActionHandler(action => {
      if (action.type === 'setMode') {
        selectDisplayMode(action.mode as DisplayMode);
      }
    });
  }, [assistant, selectDisplayMode]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (launcherVisible) {
        setLauncherVisible(false);
        return true;
      }
      if (displayMode !== 'compass') {
        selectDisplayMode('compass');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [launcherVisible, displayMode, selectDisplayMode]);

  useEffect(() => {
    if (!widgetSupported) return;
    updateWidget({
      heading,
      cardinal: cardinalFull,
      pressure: baroPressure ?? 0,
      altitude: baroAlt ?? location.altitude ?? 0,
      hasAlt: baroAlt != null || location.altitude != null,
    });
  }, [heading, cardinalFull, baroPressure, baroAlt, location.altitude]);

  useEffect(() => {
    if (!geofenceSupported || waypoints.length === 0) return;
    if (location.latitude === 0 && location.longitude === 0) return;
    const d = haversine(
      location.latitude,
      location.longitude,
      waypoints[0].latitude,
      waypoints[0].longitude,
    );
    if (!Number.isFinite(d)) return;
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
  }, [waypoints, location.latitude, location.longitude, t]);

  const modeCards: {
    key: DisplayMode;
    icon: string;
    label: string;
    sub: string;
  }[] = [
    { key: 'compass', icon: '🧭', label: t('ui_mode_compass').replace(/^\S+\s*/, ''), sub: t('ui_card_compass') },
    { key: 'level', icon: '◉', label: t('ui_mode_level').replace(/^\S+\s*/, ''), sub: t('ui_card_level') },
    { key: 'metal', icon: '🧲', label: t('ui_mode_metal').replace(/^\S+\s*/, ''), sub: t('ui_card_metal') },
    { key: 'emf', icon: '📡', label: t('ui_mode_emf').replace(/^\S+\s*/, ''), sub: t('ui_card_emf') },
    { key: 'ar', icon: '✨', label: t('ui_mode_ar').replace(/^\S+\s*/, ''), sub: t('ui_card_ar') },
    { key: 'camera', icon: '📷', label: t('ui_mode_camera').replace(/^\S+\s*/, ''), sub: t('ui_card_camera') },
    { key: 'theodolite', icon: '📐', label: t('ui_mode_theodolite').replace(/^\S+\s*/, ''), sub: t('ui_card_theodolite') },
    { key: 'sun', icon: '☀️', label: t('ui_mode_sun').replace(/^\S+\s*/, ''), sub: t('ui_card_sun') },
    { key: 'wind', icon: '🍃', label: t('ui_mode_wind').replace(/^\S+\s*/, ''), sub: t('ui_card_wind') },
    { key: 'track', icon: '🗺️', label: t('ui_mode_track').replace(/^\S+\s*/, ''), sub: t('ui_card_track') },
    { key: 'notes', icon: '📓', label: t('ui_mode_notes').replace(/^\S+\s*/, ''), sub: t('ui_card_notes') },
    { key: 'height', icon: '⌖', label: t('ui_mode_height').replace(/^\S+\s*/, ''), sub: t('ui_card_height') },
    { key: 'car', icon: '🚗', label: t('ui_mode_car').replace(/^\S+\s*/, ''), sub: t('ui_card_car') },
    { key: 'tri', icon: '📐', label: t('ui_mode_tri').replace(/^\S+\s*/, ''), sub: t('ui_card_tri') },
  ];

  const statusPanels = (
    <>
      {showInstrumentPanels && celestial && (
        <View style={styles.celestialBar}>
          <View style={styles.celestialPill}>
            <Text style={styles.celestialText}>
              {t('ui_sun_item', {
                deg: Math.round(celestial.sun.azimuth),
                state: t(celestial.sun.elevation >= 0 ? 'ui_sun_high' : 'ui_sun_low'),
              })}
            </Text>
          </View>
          <View style={styles.celestialPill}>
            <Text style={styles.celestialText}>
              {t('ui_moon_item', {
                icon: celestial.moonIcon,
                deg: Math.round(celestial.moon.azimuth),
                state: t(celestial.moon.elevation >= 0 ? 'ui_sun_high' : 'ui_sun_low'),
              })}
            </Text>
          </View>
        </View>
      )}

      {showPanels &&
        issueWarnings.length > 0 && (
          <View style={styles.warningBox}>
            {issueWarnings.map((err, index) => (
              <Text key={index} style={styles.warningText}>
                {err}
              </Text>
            ))}
          </View>
        )}

      {showPanels &&
        appMode === 'full' &&
        (showInstrumentPanels ? (
          <BarometerPanel
            pressure={baroPressure}
            altitude={baroAlt}
            baseline={baroBaseline}
            available={baroAvailable}
            onSetBaseline={() => {
              if (baroPressure != null) setBaroBaseline(baroPressure);
            }}
            onResetBaseline={() => setBaroBaseline(null)}
          />
        ) : null)}

      {appMode === 'full' && showPanels && (
        <View style={styles.locationCard}>
          <Pressable
            style={styles.locationHeader}
            onPress={() => setLocExpanded(prev => !prev)}>
            <View style={styles.locationHeaderLeft}>
              <Text style={styles.locationTitle}>{t('ui_loc_card')}</Text>
              <View
                style={[
                  styles.providerBadge,
                  { borderColor: providerAccent + '55' },
                ]}>
                <View style={[styles.providerDot, { backgroundColor: providerAccent }]} />
                <Text style={[styles.providerText, { color: providerAccent }]}>
                  {providerLabel}
                </Text>
              </View>
            </View>
            <View style={styles.locationActions}>
              <Pressable
                onPress={() => setCoordVisible(true)}
                disabled={!hasFix}
                hitSlop={8}
                style={styles.refreshButton}>
                <Text style={styles.refreshText}>🧭</Text>
              </Pressable>
              <Pressable
                onPress={refreshLocation}
                disabled={locLoading}
                hitSlop={8}
                style={styles.refreshButton}>
                {locLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.refreshText}>↻</Text>
                )}
              </Pressable>
              <Text style={[styles.chevron, { color: providerAccent }]}>
                {locExpanded ? '⌃' : '⌄'}
              </Text>
            </View>
          </Pressable>

          {locError ? (
            <Text style={styles.locationError}>{locError}</Text>
          ) : !hasFix ? (
            <View style={styles.locBar}>
              <ActivityIndicator size="small" color={providerAccent} />
              <Text style={styles.locWaiting}>{t('ui_loc_waiting')}</Text>
            </View>
          ) : locExpanded ? (
            <>
              {place && place.name ? (
                <View style={styles.placeRow}>
                  <Text style={styles.placeName} numberOfLines={2}>
                    {place.name}
                  </Text>
                  {place.cep ? (
                    <View style={styles.cepChip}>
                      <Text style={styles.cepChipText}>CEP {place.cep}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.coordGrid}>
                <View style={styles.coordCell}>
                  <Text style={styles.coordLabel}>{t('ui_lat')}</Text>
                  <Text style={styles.coordValue}>
                    {formatCoord(location.latitude, true)}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordCellDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_lon')}</Text>
                  <Text style={styles.coordValue}>
                    {formatCoord(location.longitude, false)}
                  </Text>
                </View>
                <View style={styles.coordCell}>
                  <Text style={styles.coordLabel}>{t('ui_altitude')}</Text>
                  <Text style={styles.coordValue}>
                    {location.altitude != null
                      ? `${Math.round(location.altitude)} m`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_accuracy')}</Text>
                  <Text style={styles.coordValue}>
                    {location.accuracy != null
                      ? `± ${Math.round(location.accuracy)} m`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordCellDivider, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_speed')}</Text>
                  <Text style={styles.coordValue}>
                    {location.speed != null && location.speed > 0
                      ? `${((location.speed ?? 0) * 3.6).toFixed(1)} km/h`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_odometer')}</Text>
                  <Pressable onPress={() => {
                    distTotalRef.current = 0;
                    setOdometer(0);
                  }}>
                    <Text style={[styles.coordValue, { color: colors.primary }]}>
                      {odometer > 0 ? formatDistance(odometer) : '0 m'}
                    </Text>
                  </Pressable>
                </View>
                <View style={[styles.coordCell, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_updated')}</Text>
                  <Text style={styles.coordValue}>
                    {location.updatedAt != null
                      ? formatTime(location.updatedAt)
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordCellDivider, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_destination')}</Text>
                  <Text style={styles.coordValue}>
                    {activeTarget
                      ? `${Math.round(activeTarget.bearing)}° · ${formatDistance(activeTarget.distance)}`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.coordCell, styles.coordRowDivider]}>
                  <Text style={styles.coordLabel}>{t('ui_declination')}</Text>
                  <Text style={styles.coordValue}>
                    {declination.enabled ? `${declination.degrees}°` : t('ui_off')}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.locSummary}>
              <Text style={styles.locSummaryMain} numberOfLines={1}>
                {place?.name ??
                  `${formatCoord(location.latitude, true)} · ${formatCoord(location.longitude, false)}`}
              </Text>
              <Text style={styles.locSummarySub} numberOfLines={1}>
                {(place?.cep ? `CEP ${place.cep}` : '') +
                  (location.accuracy != null
                    ? `${place?.cep ? '  ·  ' : ''}±${Math.round(location.accuracy)} m`
                    : '')}
              </Text>
            </View>
          )}
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => assistant.setOpen(true)}
          style={styles.roundButton}
          hitSlop={12}>
          <KefferaAvatar size={30} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('ui_app_title')}</Text>
          {launcherVisible ? (
            <Text style={styles.headerSubtitle}>
              {issueWarnings.length > 0
                ? t('ui_sensor_unavailable')
                : t('ui_header_heading', {
                    card: cardinal.short,
                    type: declination.enabled ? t('ui_geo_north') : t('ui_mag_north'),
                  })}
            </Text>
          ) : (
            <Pressable onPress={goHome} hitSlop={8}>
              <Text style={[styles.headerSubtitle, styles.homeLink]}>
                {'‹ '}{t('ui_back_home')}
              </Text>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setEmergencyVisible(true)}
          style={styles.roundButton}
          hitSlop={12}>
          <Text style={styles.roundButtonIcon}>🆘</Text>
        </Pressable>
        <Pressable
          onPress={() => setAlertsVisible(true)}
          style={styles.roundButton}
          hitSlop={12}>
          <Text style={styles.roundButtonIcon}>🚨</Text>
        </Pressable>
        <Pressable
          onPress={() => setSettingsVisible(true)}
          style={styles.roundButton}
          hitSlop={12}>
          <Text style={styles.roundButtonIcon}>⚙</Text>
        </Pressable>
      </View>

      {launcherVisible && (
        <ScrollView
          style={styles.homeScroll}
          contentContainerStyle={styles.homeContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.homeHeader}>
            <Text style={styles.homeTitle}>{t('ui_home_launcher')}</Text>
            <View style={styles.statusPill}>
              <View
                style={[styles.statusPillDot, { backgroundColor: colors.success }]}
              />
              <Text style={styles.statusPillText}>
                {t('ui_home_status')} · {Math.round(heading)}° {cardinal.short}
              </Text>
            </View>
          </View>

          <View style={styles.cardGrid}>
            {modeCards.map(card => (
              <Pressable
                key={card.key}
                onPress={() => openMode(card.key)}
                style={({ pressed }) => [
                  styles.modeCard,
                  pressed && styles.modeCardPressed,
                ]}>
                <View style={[styles.cardAccent, { backgroundColor: colors.primary }]} />
                <View style={[styles.cardIcon, { borderColor: colors.primary + '66' }]}>
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
      )}

      {!launcherVisible && (
        <>
      {displayMode === 'compass' ? (
        <View style={styles.dialArea} onLayout={handleDialAreaLayout}>
          <CompassDial
            rotation={rotation}
            size={dialSize}
            sun={sunMarker}
            moon={moonMarker}
            moonIcon={celestial?.moonIcon}
            target={targetMarker ? { bearing: targetMarker.bearing, name: targetMarker.name } : null}
          />

          <View style={styles.headingBlock}>
            <Text style={styles.headingBig}>
              {Math.round(heading).toString().padStart(3, '0')}°
            </Text>
            <Text style={styles.headingCardinal}>{cardinal.full}</Text>
            <Text style={styles.backBearing}>
              {t('ui_back_bearing')}{' '}
              {((Math.round(heading) + 180) % 360).toString().padStart(3, '0')}°{' '}
              {cardinalOf(heading + 180).short}
            </Text>
          </View>

          {activeTarget && targetMarker ? (
            <TargetNavBar
              name={activeTarget.name}
              distance={activeTarget.distance}
              relative={targetRelative}
              arrived={arrived}
            />
          ) : null}
        </View>
      ) : displayMode === 'level' ? (
        <View style={styles.dialArea} onLayout={handleDialAreaLayout}>
          <BubbleLevel x={accel.x} y={accel.y} z={accel.z} size={dialSize} />
          <View style={styles.headingBlock}>
            <Text style={[styles.headingCardinal, styles.levelHint]}>
              {t('ui_level_hint')}
            </Text>
          </View>
        </View>
      ) : displayMode === 'camera' ? (
        <View style={styles.arArea}>
          <ErrorBoundary>
            <CameraARView
              heading={heading}
              sun={sunMarker}
              moon={moonMarker}
              moonIcon={celestial?.moonIcon ?? '🌙'}
              target={targetMarker}
              virtual={virtualMarker}
              active
            />
          </ErrorBoundary>
        </View>
      ) : displayMode === 'metal' ? (
        <View style={styles.arArea}>
          <MetalDetectorView active />
        </View>
      ) : displayMode === 'emf' ? (
        <View style={styles.arArea}>
          <EmfReaderView active hasFix={hasFix} onAdd={addWaypoint} />
        </View>
      ) : displayMode === 'theodolite' ? (
        <View style={styles.arArea}>
          <TheodoliteView
            heading={heading}
            declination={declination}
            accel={accel}
          />
        </View>
      ) : displayMode === 'height' ? (
        <View style={styles.arArea}>
          <HeightView
            accel={accel}
            targetDistance={targetMarker ? targetMarker.distance : null}
          />
        </View>
      ) : displayMode === 'car' ? (
        <View style={styles.arArea}>
          <CarSpotView
            latitude={location.latitude}
            longitude={location.longitude}
            accuracy={location.accuracy}
            heading={heading}
            hasFix={hasFix}
          />
        </View>
      ) : displayMode === 'tri' ? (
        <View style={styles.arArea}>
          <TriangulationView
            heading={heading}
            latitude={location.latitude}
            longitude={location.longitude}
            hasFix={hasFix}
            declinationEnabled={declination.enabled}
            declinationDegrees={declination.degrees}
            onAdd={addRemoteWaypoint}
          />
        </View>
      ) : displayMode === 'sun' ? (
        <View style={styles.arArea}>
          <SunWatchView
            lat={location.latitude}
            lon={location.longitude}
          />
        </View>
      ) : displayMode === 'wind' ? (
        <View style={styles.arArea}>
          <WindView active />
        </View>
      ) : displayMode === 'track' ? (
        <View style={styles.trackArea}>
          <TrackView active location={location} heading={heading} />
        </View>
      ) : displayMode === 'notes' ? (
        <View style={styles.trackArea}>
          <FieldNotesSheet
            latitude={location.latitude}
            longitude={location.longitude}
            altitude={location.altitude}
            hasFix={hasFix}
          />
        </View>
      ) : (
        <View style={styles.arArea}>
          <AROverlay
            heading={heading}
            rotation={rotation}
            size={arSize}
            sun={sunMarker}
            moon={moonMarker}
            moonIcon={celestial?.moonIcon ?? '🌙'}
            target={targetMarker}
            virtual={virtualMarker}
            blocked={arBlocked}
          />
        </View>
      )}

      {statusPanels}
      </>
      )}

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        locationMode={locationMode}
        onSelectMode={selectMode}
        calibrated={calibrated}
        onOpenCalibration={openCalibration}
        appMode={appMode}
        onSelectAppMode={selectAppMode}
        declination={declination}
        onSetDeclination={setDeclination}
        declinationSuggest={declinationSuggest}
        onOpenWaypoints={openWaypoints}
        onShareLocation={shareLocation}
        arStatus={{ supported: arSupported, label: arLabel }}
        voiceGuide={voiceGuide}
        onToggleVoiceGuide={toggleVoiceGuide}
      />

      <CalibrationModal
        visible={calibrationVisible}
        onClose={() => setCalibrationVisible(false)}
        onSave={handleCalibrationSave}
        heading={heading}
        latitude={location.latitude}
        longitude={location.longitude}
        declinationEnabled={declination.enabled}
        declinationDegrees={declination.degrees}
      />

      <WaypointModal
        visible={wpVisible}
        onClose={() => setWpVisible(false)}
        waypoints={waypoints}
        latitude={location.latitude}
        longitude={location.longitude}
        hasFix={hasFix}
        activeId={activeWpId}
        pinnedId={virtualWpId}
        onActivate={setActiveWpId}
        onPin={selectVirtualWp}
        onAdd={addWaypoint}
        onDelete={deleteWaypoint}
      />

      <AlertsModal
        visible={alertsVisible}
        latitude={location.latitude}
        longitude={location.longitude}
        onClose={() => setAlertsVisible(false)}
      />

      <CoordModal
        visible={coordVisible}
        onClose={() => setCoordVisible(false)}
        latitude={location.latitude}
        longitude={location.longitude}
        altitude={location.altitude}
      />

      <EmergencyModal
        visible={emergencyVisible}
        onClose={() => setEmergencyVisible(false)}
        location={location}
        heading={heading}
        place={place}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  accent: string;
  north: string;
  border: string;
  success: string;
  danger: string;
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    headerText: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 3,
      textShadowColor: colors.primary + '88',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 16,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    roundButton: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: colors.surface + 'B3',
      borderWidth: 1,
      borderColor: colors.primary + '44',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 3,
    },
    roundButtonIcon: {
      fontSize: 18,
    },
    homeLink: {
      color: colors.primary,
      fontWeight: '800',
      letterSpacing: 1,
    },
    homeScroll: {
      flex: 1,
      marginTop: spacing.md,
    },
    homeContent: {
      paddingBottom: spacing.lg,
    },
    homeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    homeTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.textMuted,
      letterSpacing: 5,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface + 'CC',
      borderWidth: 1,
      borderColor: colors.primary + '44',
      borderRadius: radius.full,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    statusPillDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      marginRight: spacing.xs,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 1,
    },
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: spacing.md,
      marginBottom: spacing.lg,
    },
    modeCard: {
      width: '48.4%',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.primary + '33',
      padding: spacing.md,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 4,
    },
    modeCardPressed: {
      borderColor: colors.primary,
      shadowOpacity: 0.5,
      elevation: 8,
    },
    cardAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
    },
    cardIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      borderWidth: 1.5,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    cardIconText: {
      fontSize: 24,
    },
    cardLabel: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: 1,
      marginBottom: 2,
    },
    cardSub: {
      fontSize: 11,
      lineHeight: 15,
      color: colors.textMuted,
      fontWeight: '600',
    },
    dialArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trackArea: {
      flex: 1,
    },
    headingBlock: {
      marginTop: spacing.md,
      alignItems: 'center',
    },
    headingBig: {
      fontSize: 48,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: 3,
      textShadowColor: colors.primary + '88',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 18,
    },
    headingCardinal: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
      marginTop: spacing.xs,
      textShadowColor: colors.primary + '66',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    backBearing: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text + 'aa',
      marginTop: spacing.xs,
      letterSpacing: 1,
    },
    levelHint: {
      fontSize: 14,
      color: colors.textMuted,
    },
    warningBox: {
      backgroundColor: colors.surface,
      borderColor: colors.north,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    warningText: {
      color: colors.north,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      marginVertical: 1,
    },
    celestialBar: {
      flexDirection: 'row',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    celestialPill: {
      flex: 1,
      backgroundColor: colors.surface + 'B3',
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.primary + '33',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    celestialText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    targetBanner: {
      backgroundColor: colors.surface,
      borderColor: colors.success,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    targetText: {
      color: colors.success,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '700',
    },
    locationCard: {
      backgroundColor: colors.surface + 'B3',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.primary + '33',
      padding: spacing.md,
      marginBottom: spacing.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 14,
      elevation: 3,
    },
    locationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    locationHeaderLeft: {
      flex: 1,
      marginRight: spacing.sm,
    },
    chevron: {
      fontSize: 18,
      fontWeight: '700',
      marginLeft: spacing.sm,
    },
    locSummary: {
      marginTop: spacing.xs,
    },
    locSummaryMain: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    locSummarySub: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 2,
    },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceAlt + 'B3',
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.primary + '2E',
    },
    placeName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      marginRight: spacing.sm,
    },
    cepChip: {
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    cepChipText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.background,
    },
    locationTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 1,
    },
    locationActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    providerBadge: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginRight: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    providerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: spacing.xs,
    },
    providerText: {
      fontSize: 11,
      fontWeight: '700',
    },
    refreshButton: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    refreshText: {
      fontSize: 18,
      color: colors.primary,
    },
    coordGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    coordCell: {
      width: '33.33%',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    coordCellDivider: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
    },
    coordRowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    coordLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    coordValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 2,
    },
    locationError: {
      color: colors.danger,
      fontSize: 13,
    },
    locBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    locWaiting: {
      marginLeft: spacing.sm,
      fontSize: 13,
      color: colors.textMuted,
    },
  });

export default CompassScreen;