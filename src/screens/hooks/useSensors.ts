import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  accelerometer,
  magnetometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';

import { applyCalibration, type MagCalibration } from '../../services/calibrationService';
import { recordMotionSample } from '../../services/sensorLogService';
import { getHeading, normalizeHeading } from '../../utils/compass';
import { applyDeclination, type Declination } from '../../utils/declination';
import type { Translator } from '../../i18n/strings';

const SENSOR_INTERVAL = 200;
const SMOOTHING_FAST = 0.45;
const SMOOTHING_SLOW = 0.08;
const ROTATION_DEAD_ZONE = 0.5;
const ACCEL_VERIFY_SAMPLES = 20;
const ACCEL_MIN_MAGNITUDE = 0.6;

export type Vector3 = { x: number; y: number; z: number };

export type SensorsState = {
  /** O rumo, já com a declinação aplicada. */
  heading: number;
  /** O rumo suavizado: é o que o mostrador gira. */
  rotation: number;
  /** A leitura bruta do acelerómetro. */
  accel: Vector3;
  /** O erro do magnetómetro, se o sensor não responder. */
  sensorError: string | null;
  /** O erro do acelerómetro, se a leitura não fizer sentido. */
  accelError: string | null;
};

export type UseSensorsOptions = {
  /** A calibração magnética gravada (lida por ref: muda sem reabrir o sensor). */
  calibrationRef: MutableRefObject<MagCalibration | null>;
  /** A declinação, também por ref: o sensor não pode reiniciar por causa dela. */
  declinationRef: MutableRefObject<Declination>;
  t: Translator;
};

/**
 * Os sensores de orientação: magnetómetro, acelerómetro e o rumo que sai dos
 * dois.
 *
 * O rumo é suavizado com uma intensidade que depende do que a pessoa está a
 * fazer: rápida quando se caminha ou se vira, forte quando está parada — é o
 * que resolve a tremedeira do mostrador sem fazer a agulha atrasar.
 */
export const useSensors = ({
  calibrationRef,
  declinationRef,
  t,
}: UseSensorsOptions): SensorsState & {
  /** Diz ao sensor se a pessoa está em movimento (muda a suavização). */
  setMoving: (moving: boolean) => void;
} => {
  const [heading, setHeading] = useState(0);
  const [rotation, setRotation] = useState(0);
  // zero = "sem amostra ainda": viewElevationDeg(0,0,0) devolve 0 (horizonte)
  // em vez de −90°, e BubbleLevel/HeightView continuam a dar 0 de inclinação
  const [accel, setAccel] = useState<Vector3>({ x: 0, y: 0, z: 0 });
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [accelError, setAccelError] = useState<string | null>(null);

  const prevHeadingRef = useRef<number | null>(null);
  const continuousRef = useRef(0);
  const smoothedRef = useRef(0);
  const smoothingRef = useRef(SMOOTHING_FAST);

  const setMoving = useCallback((moving: boolean) => {
    smoothingRef.current = moving ? SMOOTHING_FAST : SMOOTHING_SLOW;
  }, []);

  const handleHeading = useCallback(
    (degrees: number) => {
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
    },
    [declinationRef],
  );

  useEffect(() => {
    setUpdateIntervalForType(SensorTypes.accelerometer, SENSOR_INTERVAL);
    setUpdateIntervalForType(SensorTypes.magnetometer, SENSOR_INTERVAL);

    let lastAccel = { x: 0, y: 0, z: 1 };
    let lastMag = { x: 0, y: 0, z: 0 };
    let lastHeading: number | null = null;
    let accelSamples = 0;
    let accelMagMax = 0;

    const magSub = magnetometer.subscribe({
      next: ({ x, y, z }: Vector3) => {
        lastMag = applyCalibration({ x, y, z }, calibrationRef.current);
        const headingDeg = getHeading(lastAccel, lastMag);
        if (headingDeg !== null && headingDeg !== undefined) {
          lastHeading = headingDeg;
          handleHeading(headingDeg);
        }
      },
      error: (error: Error) => {
        setSensorError(t('ui_mag_unavailable'));
        console.warn('magnetometer error', error);
      },
    });

    const accelSub = accelerometer.subscribe({
      next: ({ x, y, z }: Vector3) => {
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

        // Alimenta o log de sensores (ideia #63) para o relato de problema.
        // Sem coordenadas: só o movimento, o heading e a qualidade do GPS.
        recordMotionSample({
          ax: x,
          ay: y,
          az: z,
          mx: lastMag.x,
          my: lastMag.y,
          mz: lastMag.z,
          heading: lastHeading,
        });
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
  }, [handleHeading, calibrationRef, t]);

  return {
    heading,
    rotation,
    accel,
    sensorError,
    accelError,
    setMoving,
  };
};
