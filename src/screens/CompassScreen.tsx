import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  BackHandler,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Alert,
  AppState,
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
import CalibrationModal from '../components/CalibrationModal';
import SettingsModal from '../components/SettingsModal';
import WaypointModal from '../components/WaypointModal';
import AlertsModal from '../components/AlertsModal';
import EmergencyModal from '../components/EmergencyModal';
import CoordModal from '../components/CoordModal';
import {
  fetchCivilAlerts,
  isSevere,
} from '../services/alertsService';
import { showAlertNotification } from '../services/notifications';
import { useThemeColors, useTheme } from '../theme/ThemeContext';
import { useAssistant } from '../assistant/AssistantContext';
import { speak } from '../assistant/voice';
import KeferaAvatar from '../components/KeferaAvatar';
import { useLanguage } from '../i18n/LanguageContext';
import type { KnownWaypoint, TrackSummary } from '../assistant/types';
import { spacing } from '../theme/colors';
import {
  watchLocation,
  getLocationOnce,
  type LocationFix,
  type LocationMode,
} from '../services/locationService';
import { reverseGeocode } from '../services/geocodingService';
import {
  loadCalibration,
  loadVerification,
  verifyStatus,
  applyCalibration,
  type MagCalibration,
  type VerifyStatus,
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
  loadUseMils,
  saveUseMils,
  loadLockPin,
  saveLockPin,
  clearLockPin,
  loadKeepAwake,
  saveKeepAwake,
  type AppMode,
  type DisplayMode,
} from '../services/preferencesService';
import { setKeepScreenOn } from '../services/keepAwake';
import { buildBackup, applyBackup } from '../services/backupService';
import {
  addDistance,
  flushOdometer,
  getTotals,
  type DayTotal,
} from '../services/odometerService';
import {
  loadTracks,
  type RecordedTrack,
} from '../services/trackService';
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
  formatAzimuth,
} from '../utils/compass';
import {
  haversine,
  initialBearing,
  formatDistance,
  elevationAngle,
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
import { createStyles } from './parts/styles';
import { buildModeCards } from './parts/modeCards';
import StatusPanels from './parts/StatusPanels';
import ModeView from './parts/ModeView';

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
  // zero = "sem amostra ainda": viewElevationDeg(0,0,0) devolve 0 (horizonte)
  // em vez de −90°, e BubbleLevel/HeightView continuam a dar 0 de inclinação
  const [accel, setAccel] = useState({ x: 0, y: 0, z: 0 });
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
    heading: null,
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
    const reservedHeading = 128;
    const fallbackBudget = appMode === 'full' ? 520 : 480;
    const maxByHeight =
      dialAreaH > 0 ? dialAreaH - reservedHeading : height - fallbackBudget;
    const fit = Math.floor(Math.min(maxByWidth, maxByHeight));
    return Math.max(168, Math.min(232, fit));
  }, [width, height, dialAreaH, appMode]);

  const [baroPressure, setBaroPressure] = useState<number | null>(null);
  const [baroAvailable, setBaroAvailable] = useState(true);
  const [baroBaseline, setBaroBaseline] = useState<number | null>(null);

  const [odometer, setOdometer] = useState(0);
  const [useMils, setUseMils] = useState(false);
  const [odoHistory, setOdoHistory] = useState<{
    today: number;
    week: number;
    lastDays: DayTotal[];
  } | null>(null);
  const [trackSummary, setTrackSummary] = useState<TrackSummary | null>(null);

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [wpVisible, setWpVisible] = useState(false);
  const [activeWpId, setActiveWpId] = useState<string | null>(null);
  const [virtualWpId, setVirtualWpId] = useState<string | null>(null);
  const [voiceGuide, setVoiceGuide] = useState(false);
  const [keepAwake, setKeepAwake] = useState(false);
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
    loadUseMils().then(setUseMils);
    loadKeepAwake().then(setKeepAwake);
  }, []);

  // tela sempre acesa: aplica na janela da Activity sempre que o toggle (ou a
  // preferência carregada no arranque) mudar
  useEffect(() => {
    setKeepScreenOn(keepAwake);
  }, [keepAwake]);

  useEffect(() => {
    const refresh = () => {
      getTotals()
        .then(setOdoHistory)
        .catch(() => {});
      loadTracks().then(tracks => {
        let longest: RecordedTrack | null = null;
        for (const tr of tracks) {
          if (longest === null || tr.distance > longest.distance) {
            longest = tr;
          }
        }
        setTrackSummary({
          count: tracks.length,
          totalDistance: tracks.reduce((acc, tr) => acc + tr.distance, 0),
          longestDistance: longest ? longest.distance : null,
          longestName: longest ? longest.name : null,
        });
      });
    };
    refresh();
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
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

  const toggleMils = useCallback(() => {
    setUseMils(prev => {
      const next = !prev;
      saveUseMils(next).catch(() => {});
      return next;
    });
  }, []);

  const toggleKeepAwake = useCallback(() => {
    setKeepAwake(prev => {
      const next = !prev;
      saveKeepAwake(next).catch(() => {});
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

  const handleVerifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const stored = await loadLockPin();
    return stored != null && stored === pin;
  }, []);

  const handleSetPin = useCallback(async (pin: string | null) => {
    if (pin == null) {
      await clearLockPin();
    } else {
      await saveLockPin(pin);
    }
  }, []);

  const handleExportBackup = useCallback(async () => {
    const json = await buildBackup();
    await Share.share({ message: json });
  }, []);

  const handleApplyBackup = useCallback(
    async (json: string): Promise<string | null> => {
      const result = await applyBackup(json);
      if (!result.ok) {
        return result.error === 'write_failed'
          ? `write_failed:${result.detail ?? ''}`
          : result.error;
      }
      await Promise.all([
        loadAppMode().then(setAppModeState),
        loadDeclination().then(decl => {
          declinationRef.current = decl;
          setDeclinationState(decl);
        }),
        loadWaypoints().then(setWaypoints),
        loadVoiceGuide().then(setVoiceGuide),
        loadVirtualWp().then(setVirtualWpId),
        loadUseMils().then(setUseMils),
      ]);
      getTotals()
        .then(setOdoHistory)
        .catch(() => {});
      return null;
    },
    [],
  );

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
      addDistance(d).catch(() => {});
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

  /**
   * A gravação do odômetro é debounced em 1,5 s dentro do serviço. Se o app for
   * morto nessa janela — `home` e o Android matar o processo, memória baixa, o
   * usuário forçar-parando — o último trecho de distância some sem aviso, e é
   * justamente o que a pessoa media. `flushOdometer` existia para isso e não
   * tinha chamador. Gravar ao sair do foreground não atrapalha nada: o
   * LiveTracking tem caminho próprio e continua com a sessão aberta.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        flushOdometer().catch(() => {});
      }
    });
    return () => {
      sub.remove();
      flushOdometer().catch(() => {});
    };
  }, []);

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
              showAlertNotification(alert, t);
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
  }, [location.latitude, location.longitude, t]);

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

  const resetOdometer = useCallback(() => {
    distTotalRef.current = 0;
    setOdometer(0);
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
    // elevação do alvo acima de quem observa: só existe se os dois tiverem
    // altitude guardada (waypoints sem altitude ficam sem marcador vertical)
    const elevation =
      wp.altitude !== null && location.altitude !== null
        ? elevationAngle(wp.altitude - location.altitude, distance)
        : null;
    return { name: wp.name, bearing, distance, elevation };
  }, [activeWpId, waypoints, location.latitude, location.longitude, location.altitude]);

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
    location.latitude,
    location.longitude,
    location.altitude,
    declination.enabled,
    declination.degrees,
  ]);

  const cardinal = cardinalOf(heading);
  const fullView = displayMode === 'compass' || displayMode === 'level';
  const showPanels = launcherVisible || fullView;

  const hasFix =
    location.latitude !== 0 || location.longitude !== 0 || location.provider !== null;

  // A conferência pelo Sol só é possível com GPS e Sol acima do horizonte.
  // Sem esta checagem o banner voltaria sempre para quem abre o app de
  // noite, sem que houvesse nada a fazer a respeito.
  const sunViable = useMemo(() => {
    if (!hasFix) return false;
    return solarPosition(
      new Date(),
      location.latitude,
      location.longitude,
    ).visible;
  }, [hasFix, location.latitude, location.longitude]);

  // A conferência pelo Sol exige apontar o aparelho para o Sol e segurar
  // firme, então não dá para rodá-la sozinha. O app guarda quando foi a
  // última vez que deu certo e lembra, uma vez por sessão. Quem nunca
  // calibrou já recebe o modal acima; aqui só quem já tem calibração.
  const [verify, setVerify] = useState<VerifyStatus>({
    state: 'fresh',
    days: 0,
  });
  const [verifyBanner, setVerifyBanner] = useState(false);
  const verifyPromptedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    loadVerification()
      .then(at => {
        if (alive) setVerify(verifyStatus(at));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [calibrated]);

  useEffect(() => {
    if (
      !calibrated ||
      verify.state === 'fresh' ||
      verifyPromptedRef.current ||
      calibrationVisible
    ) {
      return;
    }
    if (displayMode !== 'compass' || launcherVisible) {
      return;
    }
    // Deixa o ref intacto de propósito: assim, se o Sol estiver abaixo do
    // horizonte agora, a chance volta a ser avaliada mais tarde na sessão.
    if (!sunViable) {
      return;
    }
    verifyPromptedRef.current = true;
    setVerifyBanner(true);
  }, [
    calibrated,
    verify.state,
    calibrationVisible,
    displayMode,
    launcherVisible,
    sunViable,
  ]);

  useEffect(() => {
    if (calibrationVisible && verifyBanner) {
      setVerifyBanner(false);
    }
  }, [calibrationVisible, verifyBanner]);


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
      todayDistance: odoHistory ? odoHistory.today : null,
      weekDistance: odoHistory ? odoHistory.week : null,
      trackSummary,
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
    odoHistory,
    trackSummary,
    appMode,
    displayMode,
    theme,
    assistantWaypoints,
  ]);

  useEffect(() => {
    assistant.setActionHandler(action => {
      if (action.type === 'setMode') {
        selectDisplayMode(action.mode as DisplayMode);
      } else if (action.type === 'addWaypoint') {
        if (location.latitude === 0 && location.longitude === 0) {
          return;
        }
        addWaypoint(action.name);
      }
    });
  }, [assistant, selectDisplayMode, addWaypoint, location.latitude, location.longitude]);

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

  const modeCards = useMemo(() => buildModeCards(t), [t]);

  const statusPanels = (
    <StatusPanels
      showPanels={showPanels}
      showInstrumentPanels={showInstrumentPanels}
      appMode={appMode}
      celestial={celestial}
      issueWarnings={issueWarnings}
      baroPressure={baroPressure}
      baroAlt={baroAlt}
      baroBaseline={baroBaseline}
      baroAvailable={baroAvailable}
      onSetBaseline={() => {
        if (baroPressure != null) setBaroBaseline(baroPressure);
      }}
      onResetBaseline={() => setBaroBaseline(null)}
      location={location}
      hasFix={hasFix}
      locError={locError}
      locLoading={locLoading}
      locExpanded={locExpanded}
      onToggleLocExpanded={() => setLocExpanded(prev => !prev)}
      onOpenCoords={() => setCoordVisible(true)}
      onRefreshLocation={refreshLocation}
      locationMode={locationMode}
      place={place}
      odometer={odometer}
      onResetOdometer={resetOdometer}
      activeTarget={activeTarget}
      useMils={useMils}
      declination={declination}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => assistant.setOpen(true)}
          style={styles.roundButton}
          hitSlop={12}>
          <KeferaAvatar size={30} />
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

      {verifyBanner && (
        <View
          style={[
            styles.verifyBanner,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}>
          <Text style={[styles.verifyBannerText, { color: colors.text }]}>
            {verify.state === 'never'
              ? t('cal_verify_never')
              : t('cal_verify_stale', { days: verify.days })}
          </Text>
          <View style={styles.verifyBannerActions}>
            <Pressable onPress={openCalibration} hitSlop={8}>
              <Text style={[styles.verifyBannerCta, { color: colors.primary }]}>
                {t('cal_verify_cta')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setVerifyBanner(false)}
              hitSlop={8}
              style={styles.verifyBannerDismiss}>
              <Text style={[styles.verifyBannerCta, { color: colors.textMuted }]}>
                {t('cal_verify_later')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

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
                {t('ui_home_status')} · {formatAzimuth(heading, useMils)} {cardinal.short}
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
        <ModeView
          displayMode={displayMode}
          heading={heading}
          rotation={rotation}
          dialSize={dialSize}
          arSize={arSize}
          onDialAreaLayout={handleDialAreaLayout}
          cardinalFull={cardinal.full}
          useMils={useMils}
          sun={sunMarker}
          moon={moonMarker}
          moonIcon={celestial?.moonIcon}
          target={targetMarker}
          virtual={virtualMarker}
          activeTarget={activeTarget}
          targetRelative={targetRelative}
          arrived={arrived}
          accel={accel}
          arBlocked={arBlocked}
          location={location}
          hasFix={hasFix}
          declination={declination}
          calibrationApplied={calibrated}
          onAddWaypoint={addWaypoint}
          onAddRemoteWaypoint={addRemoteWaypoint}
          statusPanels={statusPanels}
        />
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
        mils={useMils}
        onToggleMils={toggleMils}
        keepAwake={keepAwake}
        onToggleKeepAwake={toggleKeepAwake}
        onVerifyPin={handleVerifyPin}
        onSetPin={handleSetPin}
        onExportBackup={handleExportBackup}
        onApplyBackup={handleApplyBackup}
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

export default CompassScreen;