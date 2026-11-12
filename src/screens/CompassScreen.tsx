import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  BackHandler,
  Pressable,
  useWindowDimensions,
  Alert,
  AppState,
  Linking,
  Share,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '../theme/ThemeContext';
import { useAssistant } from '../assistant/AssistantContext';
import { useLanguage } from '../i18n/LanguageContext';
import type { TrackSummary } from '../assistant/types';
import { spacing } from '../theme/colors';
import { useWhereabouts } from '../services/whereaboutsService';
import {
  loadVerification,
  verifyStatus,
  type VerifyStatus,
} from '../services/calibrationService';
import {
  loadLockPin,
  saveLockPin,
  clearLockPin,
  saveBeaconLastSent,
  type DisplayMode,
} from '../services/preferencesService';
import { buildBackup, applyBackup, type BackupMode } from '../services/backupService';
import {
  getTotals,
  resetToday,
  flushOdometer,
  type DayTotal,
} from '../services/odometerService';
import { loadTracks } from '../services/trackService';
import { suggestDeclination } from '../utils/declination';
import { solarPosition } from '../utils/astro';
import {
  cardinalOf,
  formatCoord,
  normalizeHeading,
} from '../utils/compass';
import { hasLocationFix } from '../utils/geo';
import { formatAccuracy } from '../utils/units';
import { parseModeUrl } from '../utils/deepLinks';
import { useRepetitiveBeep, soundAvailable } from '../services/sound';
import {
  updateWidget,
  widgetSupported,
} from '../services/widgetService';
import { requestNotificationPermission } from '../services/geofenceService';
import { createStyles } from './parts/styles';
import StatusPanels from './parts/StatusPanels';
import ModeView from './parts/ModeView';
import CompassModals from './parts/CompassModals';
import CompassHeader from './parts/CompassHeader';
import CompassLauncher from './parts/CompassLauncher';
import { useSensors } from './hooks/useSensors';
import { useLocation } from './hooks/useLocation';
import { usePreferences } from './hooks/usePreferences';
import { useWaypoints } from './hooks/useWaypoints';
import { useSafety } from './hooks/useSafety';
import { useAssistantBridge } from './hooks/useAssistantBridge';
import { useBarometer } from './hooks/useBarometer';
import { useWeatherAlerts } from './hooks/useWeatherAlerts';

/**
 * O ecrã principal.
 *
 * Este ficheiro é o que junta tudo; a lógica vive nos hooks em `./hooks` e
 * nos componentes em `./parts`. O que fica aqui é a composição: o que o ecrã
 * mostra e o que o utilizador pode fazer com ele.
 */
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

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [coordVisible, setCoordVisible] = useState(false);
  const [calibrationVisible, setCalibrationVisible] = useState(false);
  const [starCalVisible, setStarCalVisible] = useState(false);
  const [alertsVisible, setAlertsVisible] = useState(false);
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const [wpVisible, setWpVisible] = useState(false);
  const [launcherVisible, setLauncherVisible] = useState(true);

  const openAlerts = useCallback(() => setAlertsVisible(true), []);
  const openSos = useCallback(() => setEmergencyVisible(true), []);

  const {
    calibration,
    calibrationRef,
    calibrated,
    declination,
    declinationRef,
    appMode,
    displayMode,
    voiceGuide,
    useMils,
    unitSystem,
    keepAwake,
    emergencyContact,
    beaconEnabled,
    beaconIntervalMinutes,
    fallDetection,
    virtualWpId,
    selectDisplayMode,
    selectAppMode,
    setDeclination,
    toggleVoiceGuide,
    toggleMils,
    toggleUnitSystem,
    toggleKeepAwake,
    toggleBeacon,
    changeEmergencyContact,
    changeBeaconInterval,
    toggleFallDetection,
    selectVirtualWp,
    saveCalibration,
    reload: reloadPreferences,
  } = usePreferences();

  const {
    heading,
    rotation,
    accel,
    sensorError,
    accelError,
    setMoving,
  } = useSensors({ calibrationRef, declinationRef, t });

  const {
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
    resetOdometer: resetLiveOdometer,
  } = useLocation({ setMoving, t, lang });

  const {
    baroPressure,
    baroAvailable,
    baroBaseline,
    setBaroBaseline,
    baroAlt,
  } = useBarometer(t);

  const hasFix = hasLocationFix(location);

  const clearVirtualWp = useCallback(
    (id: string) => {
      if (virtualWpId === id) {
        selectVirtualWp(null);
      }
    },
    [virtualWpId, selectVirtualWp],
  );

  const {
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
    reload: reloadWaypoints,
  } = useWaypoints({
    location,
    hasFix,
    declination,
    virtualWpId,
    voiceGuide,
    clearVirtualWp,
    t,
  });

  useSafety({
    fallDetection,
    beaconEnabled,
    emergencyContact,
    beaconIntervalMinutes,
    onOpenSos: openSos,
    t,
  });

  const [odoHistory, setOdoHistory] = useState<{
    today: number;
    week: number;
    lastDays: DayTotal[];
  } | null>(null);
  const [trackSummary, setTrackSummary] = useState<TrackSummary | null>(null);

  useEffect(() => {
    const refresh = () => {
      getTotals()
        .then(setOdoHistory)
        .catch(() => {});
      loadTracks()
        .then(tracks => {
          let longest: (typeof tracks)[number] | null = null;
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
        })
        .catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, []);

  const { widgetTemp } = useWeatherAlerts(
    location.latitude,
    location.longitude,
    latestFixRef,
    openAlerts,
    t,
  );

  const cardinal = cardinalOf(heading);
  const cardinalFull = cardinal.full;

  const assistantTarget = useMemo(
    () =>
      activeTarget
        ? { name: activeTarget.name, distance: activeTarget.distance }
        : null,
    [activeTarget],
  );

  const addWaypointForAssistant = useCallback(
    (name: string) => {
      addWaypoint(name).catch(() => {});
    },
    [addWaypoint],
  );

  useAssistantBridge({
    assistant,
    heading,
    cardinal: cardinalFull,
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
    waypoints: assistantWaypoints,
    target: assistantTarget,
    voiceGuide,
    selectDisplayMode,
    addWaypoint: addWaypointForAssistant,
    t,
  });

  const dialSize = useMemo(() => {
    const maxByWidth = width - spacing.lg * 2 - spacing.md;
    const reservedHeading = 128;
    const fallbackBudget = appMode === 'full' ? 520 : 480;
    const maxByHeight =
      dialAreaH > 0 ? dialAreaH - reservedHeading : height - fallbackBudget;
    const fit = Math.floor(Math.min(maxByWidth, maxByHeight));
    return Math.max(168, Math.min(232, fit));
  }, [width, height, dialAreaH, appMode]);

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

  // "Onde estive" (ideia #36): regista por onde a app passa, para o mapa de
  // calor do modo Mapa ter o dia (e a semana) desenhados. A amostragem é
  // preguiçosa e vive no hook; aqui só se liga.
  useWhereabouts(true, location);

  const resetOdometer = useCallback(() => {
    resetLiveOdometer();
    // Zera também o total diário persistido — é dele que vêm o modo
    // Odômetro, o painel "quanto andei hoje" e as respostas do assistente.
    resetToday()
      .then(() => getTotals())
      .then(setOdoHistory)
      .catch(() => {});
  }, [resetLiveOdometer]);

  const openCalibration = useCallback(() => {
    setSettingsVisible(false);
    setCalibrationVisible(true);
  }, []);

  const requestGeoNotifications = useCallback(async () => {
    await requestNotificationPermission();
  }, []);

  const openWaypoints = useCallback(() => {
    setSettingsVisible(false);
    setWpVisible(true);
    requestGeoNotifications();
  }, [requestGeoNotifications]);

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

  /*
   * Atalhos que abrem a app: o `bussola://sos` do botão do widget (ideia
   * #105) abre o ecrã de emergência — que é onde a sessão e o link de partilha
   * são criados — e o `bussola://mode/<modo>` dos tiles das Definições
   * Rápidas (ideia #14) abre a app já no modo pedido.
   */
  useEffect(() => {
    const abrir = (url: string | null | undefined) => {
      if (!url) return;
      if (url.startsWith('bussola://sos')) {
        setEmergencyVisible(true);
        return;
      }
      const mode = parseModeUrl(url);
      if (mode) openMode(mode);
    };
    Linking.getInitialURL()
      .then(abrir)
      .catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => abrir(url));
    return () => sub.remove();
  }, [openMode]);

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

  // A conferência pelo norte: quem nunca calibrou recebe o modal; quem já
  // calibrou recebe um lembrete, porque a conferência exige apontar o
  // aparelho ao Sol e segurá-lo — não dá para a app fazer sozinha.
  const calPromptedRef = useRef(false);
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

  // A conferência pelo Sol só é possível com GPS e Sol acima do horizonte.
  // Sem esta checagem o banner voltaria sempre para quem abre o app de
  // noite, sem que houvesse nada a fazer a respeito.
  const sunViable = useMemo(() => {
    if (!hasFix) return false;
    return solarPosition(new Date(), location.latitude, location.longitude).visible;
  }, [hasFix, location.latitude, location.longitude]);

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

  useEffect(() => {
    if (!widgetSupported) return;
    updateWidget({
      heading,
      cardinal: cardinalFull,
      pressure: baroPressure ?? 0,
      altitude: baroAlt ?? location.altitude ?? 0,
      hasAlt: baroAlt != null || location.altitude != null,
      temp: widgetTemp,
    });
  }, [heading, cardinalFull, baroPressure, baroAlt, location.altitude, widgetTemp]);

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
    async (json: string, mode: BackupMode): Promise<string | null> => {
      const result = await applyBackup(json, { mode });
      if (!result.ok) {
        return result.error === 'write_failed'
          ? `write_failed:${result.detail ?? ''}`
          : result.error;
      }
      await Promise.all([reloadPreferences(), reloadWaypoints()]);
      getTotals()
        .then(setOdoHistory)
        .catch(() => {});
      return null;
    },
    [reloadPreferences, reloadWaypoints],
  );

  const shareLocation = useCallback(async () => {
    if (location.latitude === 0 && location.longitude === 0) {
      Alert.alert(t('ui_no_loc_title'), t('ui_no_loc_body'));
      return;
    }
    try {
      await Share.share({
        message: `📍 ${t('ui_share_here')} — ${t('ui_app_title')}\n${formatCoord(location.latitude, true)}\n${formatCoord(location.longitude, false)}\n${t('ui_share_accuracy')}: ±${formatAccuracy(location.accuracy ?? 0)}`,
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

  const targetRelative = targetMarker
    ? normalizeHeading(targetMarker.bearing - heading)
    : 0;

  const gMag =
    Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2) || 1;
  const tiltX = accel.x / gMag;
  const tiltY = -accel.y / gMag;
  const levelValue = Math.max(0, 1 - Math.sqrt(tiltX * tiltX + tiltY * tiltY));
  const leveled = levelValue >= 0.995;
  const fullView = displayMode === 'compass' || displayMode === 'level';
  const showPanels = launcherVisible || fullView;
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
  const showInstrumentPanels = appMode === 'full' || appMode === 'adventure';

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
      onToggleLocExpanded={() => setLocExpanded(!locExpanded)}
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
      <CompassHeader
        cardinal={cardinal}
        geoNorth={declination.enabled}
        sensorUnavailable={issueWarnings.length > 0}
        launcherVisible={launcherVisible}
        onOpenAssistant={() => assistant.setOpen(true)}
        onGoHome={goHome}
        onOpenSos={openSos}
        onOpenAlerts={openAlerts}
        onOpenSettings={() => setSettingsVisible(true)}
        t={t}
        styles={styles}
      />

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
        <CompassLauncher
          primary={colors.primary}
          success={colors.success}
          heading={heading}
          useMils={useMils}
          cardinal={cardinal}
          onOpenMode={openMode}
          statusPanels={statusPanels}
          t={t}
          styles={styles}
        />
      )}

      {!launcherVisible && (
        <ModeView
          displayMode={displayMode}
          heading={heading}
          rotation={rotation}
          dialSize={dialSize}
          arSize={arSize}
          onDialAreaLayout={handleDialAreaLayout}
          cardinalFull={cardinalFull}
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
          calibration={calibration}
          onOpenCalibration={openCalibration}
          onAddWaypoint={addWaypoint}
          onAddRemoteWaypoint={addRemoteWaypoint}
          waypoints={waypoints}
          statusPanels={statusPanels}
        />
      )}

      <CompassModals
        settingsVisible={settingsVisible}
        onCloseSettings={() => setSettingsVisible(false)}
        locationMode={locationMode}
        onSelectMode={selectMode}
        calibrated={calibrated}
        onOpenCalibration={openCalibration}
        onOpenStarCal={() => setStarCalVisible(true)}
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
        unitSystem={unitSystem}
        onToggleUnitSystem={toggleUnitSystem}
        keepAwake={keepAwake}
        onToggleKeepAwake={toggleKeepAwake}
        onVerifyPin={handleVerifyPin}
        onSetPin={handleSetPin}
        beaconEnabled={beaconEnabled}
        onToggleBeacon={toggleBeacon}
        emergencyContact={emergencyContact}
        onChangeEmergencyContact={changeEmergencyContact}
        beaconIntervalMinutes={beaconIntervalMinutes}
        onChangeBeaconInterval={changeBeaconInterval}
        fallDetection={fallDetection}
        onToggleFallDetection={toggleFallDetection}
        onExportBackup={handleExportBackup}
        onApplyBackup={handleApplyBackup}
        calibrationVisible={calibrationVisible}
        onCloseCalibration={() => setCalibrationVisible(false)}
        onSaveCalibration={saveCalibration}
        heading={heading}
        starCalVisible={starCalVisible}
        onCloseStarCal={() => setStarCalVisible(false)}
        onSaveStarCal={degrees => setDeclination({ enabled: true, degrees })}
        calibration={calibration}
        wpVisible={wpVisible}
        onCloseWaypoints={() => setWpVisible(false)}
        waypoints={waypoints}
        hasFix={hasFix}
        activeWpId={activeWpId}
        pinnedId={virtualWpId}
        onActivateWaypoint={setActiveWpId}
        onPinWaypoint={selectVirtualWp}
        onAddWaypoint={addWaypoint}
        onDeleteWaypoint={deleteWaypoint}
        alertsVisible={alertsVisible}
        onCloseAlerts={() => setAlertsVisible(false)}
        coordVisible={coordVisible}
        onCloseCoord={() => setCoordVisible(false)}
        emergencyVisible={emergencyVisible}
        onCloseEmergency={() => setEmergencyVisible(false)}
        location={location}
        place={place}
        onBeaconSent={() => {
          saveBeaconLastSent().catch(() => {});
        }}
      />
    </SafeAreaView>
  );
};

export default CompassScreen;
