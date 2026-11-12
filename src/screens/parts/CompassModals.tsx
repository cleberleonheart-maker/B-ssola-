import React from 'react';

import CalibrationModal from '../../components/CalibrationModal';
import StarCalibrationModal from '../../components/StarCalibrationModal';
import SettingsModal from '../../components/SettingsModal';
import WaypointModal from '../../components/WaypointModal';
import AlertsModal from '../../components/AlertsModal';
import EmergencyModal from '../../components/EmergencyModal';
import CoordModal from '../../components/CoordModal';
import type { MagCalibration } from '../../services/calibrationService';
import type { Waypoint } from '../../services/waypointsService';
import type { LocationFix, LocationMode } from '../../services/locationService';
import type { AppMode } from '../../services/preferencesService';
import type { Declination } from '../../utils/declination';
import type { UnitSystem } from '../../utils/units';
import type { BackupMode } from '../../services/backupService';

/**
 * Os diálogos do ecrã principal.
 *
 * Estão juntos aqui porque são a mesma coisa: os modais que abrem por cima da
 * bússola, cada um com os seus botões. O ecrã principal fica assim com a
 * composição e com a lógica; a ligação dos botões fica aqui, à vista.
 */

export type CompassModalsProps = {
  settingsVisible: boolean;
  onCloseSettings: () => void;
  locationMode: LocationMode;
  onSelectMode: (mode: LocationMode) => void;
  calibrated: boolean;
  onOpenCalibration: () => void;
  onOpenStarCal: () => void;
  appMode: AppMode;
  onSelectAppMode: (mode: AppMode) => void;
  declination: Declination;
  onSetDeclination: (decl: Declination) => void;
  declinationSuggest: { city: string; uf: string; decl: number } | null;
  onOpenWaypoints: () => void;
  onShareLocation: () => void;
  arStatus: { supported: boolean; label: string };
  voiceGuide: boolean;
  onToggleVoiceGuide: () => void;
  mils: boolean;
  onToggleMils: () => void;
  unitSystem: UnitSystem;
  onToggleUnitSystem: () => void;
  keepAwake: boolean;
  onToggleKeepAwake: () => void;
  onVerifyPin: (pin: string) => Promise<boolean>;
  onSetPin: (pin: string | null) => Promise<void>;
  beaconEnabled: boolean;
  onToggleBeacon: (enabled: boolean) => void;
  emergencyContact: string;
  onChangeEmergencyContact: (contact: string) => void;
  beaconIntervalMinutes: number;
  onChangeBeaconInterval: (minutes: number) => void;
  fallDetection: boolean;
  onToggleFallDetection: (enabled: boolean) => void;
  onExportBackup: () => Promise<void>;
  onApplyBackup: (json: string, mode: BackupMode) => Promise<string | null>;

  calibrationVisible: boolean;
  onCloseCalibration: () => void;
  onSaveCalibration: (cal: MagCalibration | null) => void;
  heading: number;

  starCalVisible: boolean;
  onCloseStarCal: () => void;
  onSaveStarCal: (degrees: number) => void;
  calibration: MagCalibration | null;

  wpVisible: boolean;
  onCloseWaypoints: () => void;
  waypoints: Waypoint[];
  hasFix: boolean;
  activeWpId: string | null;
  pinnedId: string | null;
  onActivateWaypoint: (id: string | null) => void;
  onPinWaypoint: (id: string | null) => void;
  onAddWaypoint: (name: string) => Promise<void>;
  onDeleteWaypoint: (id: string) => Promise<void>;

  alertsVisible: boolean;
  onCloseAlerts: () => void;

  coordVisible: boolean;
  onCloseCoord: () => void;

  emergencyVisible: boolean;
  onCloseEmergency: () => void;
  location: LocationFix;
  place: { name: string; cep: string | null } | null;
  onBeaconSent: () => void;
};

const CompassModals = (props: CompassModalsProps) => {
  const {
    settingsVisible,
    onCloseSettings,
    locationMode,
    onSelectMode,
    calibrated,
    onOpenCalibration,
    onOpenStarCal,
    appMode,
    onSelectAppMode,
    declination,
    onSetDeclination,
    declinationSuggest,
    onOpenWaypoints,
    onShareLocation,
    arStatus,
    voiceGuide,
    onToggleVoiceGuide,
    mils,
    onToggleMils,
    unitSystem,
    onToggleUnitSystem,
    keepAwake,
    onToggleKeepAwake,
    onVerifyPin,
    onSetPin,
    beaconEnabled,
    onToggleBeacon,
    emergencyContact,
    onChangeEmergencyContact,
    beaconIntervalMinutes,
    onChangeBeaconInterval,
    fallDetection,
    onToggleFallDetection,
    onExportBackup,
    onApplyBackup,
    calibrationVisible,
    onCloseCalibration,
    onSaveCalibration,
    heading,
    starCalVisible,
    onCloseStarCal,
    onSaveStarCal,
    calibration,
    wpVisible,
    onCloseWaypoints,
    waypoints,
    hasFix,
    activeWpId,
    pinnedId,
    onActivateWaypoint,
    onPinWaypoint,
    onAddWaypoint,
    onDeleteWaypoint,
    alertsVisible,
    onCloseAlerts,
    coordVisible,
    onCloseCoord,
    emergencyVisible,
    onCloseEmergency,
    location,
    place,
    onBeaconSent,
  } = props;

  return (
    <>
      <SettingsModal
        visible={settingsVisible}
        onClose={onCloseSettings}
        locationMode={locationMode}
        onSelectMode={onSelectMode}
        calibrated={calibrated}
        onOpenCalibration={onOpenCalibration}
        onOpenStarCal={onOpenStarCal}
        appMode={appMode}
        onSelectAppMode={onSelectAppMode}
        declination={declination}
        onSetDeclination={onSetDeclination}
        declinationSuggest={declinationSuggest}
        onOpenWaypoints={onOpenWaypoints}
        onShareLocation={onShareLocation}
        arStatus={arStatus}
        voiceGuide={voiceGuide}
        onToggleVoiceGuide={onToggleVoiceGuide}
        mils={mils}
        onToggleMils={onToggleMils}
        unitSystem={unitSystem}
        onToggleUnitSystem={onToggleUnitSystem}
        keepAwake={keepAwake}
        onToggleKeepAwake={onToggleKeepAwake}
        onVerifyPin={onVerifyPin}
        onSetPin={onSetPin}
        beaconEnabled={beaconEnabled}
        onToggleBeacon={onToggleBeacon}
        emergencyContact={emergencyContact}
        onChangeEmergencyContact={onChangeEmergencyContact}
        beaconIntervalMinutes={beaconIntervalMinutes}
        onChangeBeaconInterval={onChangeBeaconInterval}
        fallDetection={fallDetection}
        onToggleFallDetection={onToggleFallDetection}
        onExportBackup={onExportBackup}
        onApplyBackup={onApplyBackup}
      />

      <CalibrationModal
        visible={calibrationVisible}
        onClose={onCloseCalibration}
        onSave={onSaveCalibration}
        heading={heading}
        latitude={location.latitude}
        longitude={location.longitude}
        declinationEnabled={declination.enabled}
        declinationDegrees={declination.degrees}
      />

      <StarCalibrationModal
        visible={starCalVisible}
        onClose={onCloseStarCal}
        onSave={onSaveStarCal}
        latitude={location.latitude}
        longitude={location.longitude}
        calibration={calibration}
        currentDegrees={declination.degrees}
      />

      <WaypointModal
        visible={wpVisible}
        onClose={onCloseWaypoints}
        waypoints={waypoints}
        latitude={location.latitude}
        longitude={location.longitude}
        hasFix={hasFix}
        activeId={activeWpId}
        pinnedId={pinnedId}
        onActivate={onActivateWaypoint}
        onPin={onPinWaypoint}
        onAdd={onAddWaypoint}
        onDelete={onDeleteWaypoint}
      />

      <AlertsModal
        visible={alertsVisible}
        latitude={location.latitude}
        longitude={location.longitude}
        onClose={onCloseAlerts}
      />

      <CoordModal
        visible={coordVisible}
        onClose={onCloseCoord}
        latitude={location.latitude}
        longitude={location.longitude}
        altitude={location.altitude}
      />

      <EmergencyModal
        visible={emergencyVisible}
        onClose={onCloseEmergency}
        location={location}
        heading={heading}
        place={place}
        onBeaconSent={onBeaconSent}
      />
    </>
  );
};

export default CompassModals;
