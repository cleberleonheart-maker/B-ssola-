import React from 'react';
import { View, Text, type LayoutChangeEvent } from 'react-native';
import AROverlay from '../../components/AROverlay';
import BubbleLevel from '../../components/BubbleLevel';
import CameraARView from '../../components/CameraARView';
import CarSpotView from '../../components/CarSpotView';
import CompassDial from '../../components/CompassDial';
import EmfReaderView from '../../components/EmfReaderView';
import ErrorBoundary from '../../components/ErrorBoundary';
import FieldNotesSheet from '../../components/FieldNotesSheet';
import HeightView from '../../components/HeightView';
import MetalDetectorView from '../../components/MetalDetectorView';
import OdometerView from '../../components/OdometerView';
import SensorSelfTestView from '../../components/SensorSelfTestView';
import SunWatchView from '../../components/SunWatchView';
import TargetNavBar from '../../components/TargetNavBar';
import TheodoliteView from '../../components/TheodoliteView';
import TrackView from '../../components/TrackView';
import TriangulationView from '../../components/TriangulationView';
import WindView from '../../components/WindView';
import { useLanguage } from '../../i18n/LanguageContext';
import { useThemeColors } from '../../theme/ThemeContext';
import type { ColorScheme } from '../../theme/themes';
import type { LocationFix } from '../../services/locationService';
import type { DisplayMode } from '../../services/preferencesService';
import type { Declination } from '../../utils/declination';
import type { CelestialPoint } from '../../utils/astro';
import { cardinalOf, formatAzimuth } from '../../utils/compass';
import { createStyles } from './styles';
import type { ActiveTarget } from './StatusPanels';

export type DialMarker = { name: string; bearing: number; distance: number };

type Props = {
  displayMode: DisplayMode;
  heading: number;
  rotation: number;
  dialSize: number;
  arSize: number;
  onDialAreaLayout: (e: LayoutChangeEvent) => void;
  cardinalFull: string;
  useMils: boolean;
  sun: CelestialPoint | null;
  moon: CelestialPoint | null;
  moonIcon?: string;
  target: DialMarker | null;
  virtual: DialMarker | null;
  activeTarget: ActiveTarget | null;
  targetRelative: number;
  arrived: boolean;
  accel: { x: number; y: number; z: number };
  arBlocked: string | null;
  location: LocationFix;
  hasFix: boolean;
  declination: Declination;
  calibrationApplied: boolean;
  onAddWaypoint: (name: string) => void;
  onAddRemoteWaypoint: (wp: {
    name: string;
    latitude: number;
    longitude: number;
  }) => void;
  statusPanels: React.ReactNode;
};

const ModeView = (props: Props) => {
  const colors: ColorScheme = useThemeColors();
  const { t } = useLanguage();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const {
    displayMode,
    heading,
    rotation,
    dialSize,
    arSize,
    onDialAreaLayout,
    cardinalFull,
    useMils,
    sun,
    moon,
    moonIcon,
    target,
    virtual,
    activeTarget,
    targetRelative,
    arrived,
    accel,
    arBlocked,
    location,
    hasFix,
    declination,
    calibrationApplied,
    onAddWaypoint,
    onAddRemoteWaypoint,
    statusPanels,
  } = props;

  return (
    <>
      {displayMode === 'compass' ? (
        <View style={styles.dialArea} onLayout={onDialAreaLayout}>
          <CompassDial
            rotation={rotation}
            size={dialSize}
            sun={sun}
            moon={moon}
            moonIcon={moonIcon}
            target={target ? { bearing: target.bearing, name: target.name } : null}
          />

          <View style={styles.headingBlock}>
            <Text style={styles.headingBig}>{formatAzimuth(heading, useMils)}</Text>
            <Text style={styles.headingCardinal}>{cardinalFull}</Text>
            <Text style={styles.backBearing}>
              {t('ui_back_bearing')}{' '}
              {formatAzimuth(heading + 180, useMils)}{' '}
              {cardinalOf(heading + 180).short}
            </Text>
          </View>

          {activeTarget && target ? (
            <TargetNavBar
              name={activeTarget.name}
              distance={activeTarget.distance}
              relative={targetRelative}
              arrived={arrived}
              mils={useMils}
            />
          ) : null}
        </View>
      ) : displayMode === 'level' ? (
        <View style={styles.dialArea} onLayout={onDialAreaLayout}>
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
              sun={sun}
              moon={moon}
              moonIcon={moonIcon ?? '🌙'}
              target={target}
              virtual={virtual}
              mils={useMils}
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
          <EmfReaderView active hasFix={hasFix} onAdd={onAddWaypoint} />
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
            targetDistance={target ? target.distance : null}
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
            mils={useMils}
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
            mils={useMils}
            onAdd={onAddRemoteWaypoint}
          />
        </View>
      ) : displayMode === 'sun' ? (
        <View style={styles.arArea}>
          <SunWatchView lat={location.latitude} lon={location.longitude} />
        </View>
      ) : displayMode === 'wind' ? (
        <View style={styles.arArea}>
          <WindView active />
        </View>
      ) : displayMode === 'track' ? (
        <View style={styles.trackArea}>
          <TrackView active location={location} heading={heading} mils={useMils} />
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
      ) : displayMode === 'odometer' ? (
        <View style={styles.trackArea}>
          <OdometerView />
        </View>
      ) : displayMode === 'selftest' ? (
        <SensorSelfTestView
          active
          heading={heading}
          calibrationApplied={calibrationApplied}
        />
      ) : (
        <View style={styles.arArea}>
          <AROverlay
            heading={heading}
            rotation={rotation}
            size={arSize}
            sun={sun}
            moon={moon}
            moonIcon={moonIcon ?? '🌙'}
            target={target}
            virtual={virtual}
            mils={useMils}
            blocked={arBlocked}
          />
        </View>
      )}

      {statusPanels}
    </>
  );
};

export default ModeView;
