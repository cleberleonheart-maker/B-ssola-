import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
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
  orientation,
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
import SunWatchView from '../components/SunWatchView';
import WindView from '../components/WindView';
import TargetNavBar from '../components/TargetNavBar';
import {
  fetchCivilAlerts,
  isSevere,
} from '../services/alertsService';
import { useThemeColors, useTheme } from '../theme/ThemeContext';
import { useAssistant } from '../assistant/AssistantContext';
import { speak } from '../assistant/voice';
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

const SENSOR_INTERVAL = 200;
const SMOOTHING = 0.2;
const ROTATION_DEAD_ZONE = 0.5;
const ACCEL_VERIFY_SAMPLES = 20;
const ACCEL_MIN_MAGNITUDE = 0.6;
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
  const [calibrationVisible, setCalibrationVisible] = useState(false);
  const [alertsVisible, setAlertsVisible] = useState(false);
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const alertsCheckedRef = useRef(false);
  const [calibrated, setCalibrated] = useState(false);
  const calibrationRef = useRef<MagCalibration | null>(null);
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
  const stopWatchRef = useRef<(() => void) | null>(null);
  const prevFixRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const distTotalRef = useRef(0);
  const [locExpanded, setLocExpanded] = useState(false);

  const [declination, setDeclinationState] = useState<Declination>({
    enabled: false,
    degrees: 0,
  });
  const declinationRef = useRef(declination);
  const [appMode, setAppModeState] = useState<AppMode>('full');
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('compass');

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
  const [orientationFault, setOrientationFault] = useState(false);

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
  }, []);

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
      previous + (continuousRef.current - previous) * SMOOTHING;
    smoothedRef.current = next;

    if (Math.abs(next - previous) < ROTATION_DEAD_ZONE) {
      return;
    }

    setHeading(normalized);
    setRotation(next);
  }, []);

  const handleFix = useCallback((fix: LocationFix) => {
    if (prevFixRef.current) {
      const d = haversine(
        prevFixRef.current.latitude,
        prevFixRef.current.longitude,
        fix.latitude,
        fix.longitude,
      );
      if (d > 0 && d < 500) {
        distTotalRef.current += d;
        setOdometer(distTotalRef.current);
      }
    }
    prevFixRef.current = { latitude: fix.latitude, longitude: fix.longitude };
    setLocation(fix);
    setLocLoading(false);
    setLocError(null);
  }, []);

  const handleLocError = useCallback((error: Error) => {
    setLocLoading(false);
    setLocError(error.message || t('ui_loc_error_default'));
  }, [t]);

  const applyWatching = useCallback(
    (mode: LocationMode) => {
      stopWatchRef.current?.();
      setLocLoading(true);
      stopWatchRef.current = watchLocation(
        { mode },
        handleFix,
        handleLocError,
      );
    },
    [handleFix, handleLocError],
  );

  useEffect(() => {
    setUpdateIntervalForType(SensorTypes.accelerometer, SENSOR_INTERVAL);
    setUpdateIntervalForType(SensorTypes.magnetometer, SENSOR_INTERVAL);
    setUpdateIntervalForType(SensorTypes.orientation, SENSOR_INTERVAL);

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

    const orientationSub = orientation.subscribe({
      next: () => {},
      error: () => {
        setOrientationFault(true);
      },
    });

    return () => {
      magSub.unsubscribe();
      accelSub.unsubscribe();
      orientationSub.unsubscribe();
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
    if (
      alertsCheckedRef.current ||
      (location.latitude === 0 && location.longitude === 0)
    ) {
      return;
    }
    alertsCheckedRef.current = true;
    fetchCivilAlerts(location.latitude, location.longitude).then(result => {
      if (isSevere(result)) {
        setAlertsVisible(true);
      }
    });
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

  const openWaypoints = useCallback(() => {
    setSettingsVisible(false);
    setWpVisible(true);
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
    },
    [location],
  );

  const deleteWaypoint = useCallback(async (id: string) => {
    const next = await removeWaypoint(id);
    setWaypoints(next);
    setActiveWpId(current => (current === id ? null : current));
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

  const arSupported = !sensorError && !accelError && !orientationFault;
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

  const cardinal = cardinalOf(heading);
  const fullView = displayMode === 'compass' || displayMode === 'level';
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => assistant.setOpen(true)}
          style={styles.roundButton}
          hitSlop={12}>
          <Text style={styles.roundButtonIcon}>🤖</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('ui_app_title')}</Text>
          <Text style={styles.headerSubtitle}>
            {issueWarnings.length > 0
              ? t('ui_sensor_unavailable')
              : t('ui_header_heading', {
                  card: cardinal.short,
                  type: declination.enabled ? t('ui_geo_north') : t('ui_mag_north'),
                })}
          </Text>
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

      <View style={styles.modeBar}>
        {[
          { key: 'compass' as DisplayMode, label: t('ui_mode_compass') },
          { key: 'level' as DisplayMode, label: t('ui_mode_level') },
          { key: 'ar' as DisplayMode, label: t('ui_mode_ar') },
          { key: 'camera' as DisplayMode, label: t('ui_mode_camera') },
          { key: 'metal' as DisplayMode, label: t('ui_mode_metal') },
          { key: 'emf' as DisplayMode, label: t('ui_mode_emf') },
          { key: 'theodolite' as DisplayMode, label: t('ui_mode_theodolite') },
          { key: 'sun' as DisplayMode, label: t('ui_mode_sun') },
          { key: 'wind' as DisplayMode, label: t('ui_mode_wind') },
        ].map(option => {
          const selected = displayMode === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => selectDisplayMode(option.key)}
              style={styles.modeButton}>
              <View
                style={[
                  styles.modePill,
                  selected && styles.modePillSelected,
                ]}>
                <Text
                  style={[
                    styles.modeButtonText,
                    selected ? styles.modeTextSelected : styles.modeTextMuted,
                  ]}>
                  {option.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

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
          <EmfReaderView active />
        </View>
      ) : displayMode === 'theodolite' ? (
        <View style={styles.arArea}>
          <TheodoliteView
            heading={heading}
            declination={declination}
            accel={accel}
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
            blocked={arBlocked}
          />
        </View>
      )}

      {showInstrumentPanels && celestial && fullView && (
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

      {fullView &&
        issueWarnings.length > 0 && (
          <View style={styles.warningBox}>
            {issueWarnings.map((err, index) => (
              <Text key={index} style={styles.warningText}>
                {err}
              </Text>
            ))}
          </View>
        )}

      {fullView &&
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

      {appMode === 'full' && fullView && (
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
      />

      <WaypointModal
        visible={wpVisible}
        onClose={() => setWpVisible(false)}
        waypoints={waypoints}
        latitude={location.latitude}
        longitude={location.longitude}
        hasFix={hasFix}
        activeId={activeWpId}
        onActivate={setActiveWpId}
        onAdd={addWaypoint}
        onDelete={deleteWaypoint}
      />

      <AlertsModal
        visible={alertsVisible}
        latitude={location.latitude}
        longitude={location.longitude}
        onClose={() => setAlertsVisible(false)}
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
    modeBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface + 'B3',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.primary + '33',
      padding: 3,
      marginVertical: spacing.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 2,
    },
    modeButton: {
      borderRadius: radius.full,
      overflow: 'hidden',
      marginHorizontal: 2,
      marginVertical: 2,
    },
    modePill: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
    },
    modePillSelected: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 10,
      elevation: 5,
    },
    modeButtonText: {
      fontSize: 13,
      fontWeight: '800',
    },
    modeTextSelected: {
      color: colors.surface,
    },
    modeTextMuted: {
      color: colors.textMuted,
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