import { barometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';

export const BARO_INTERVAL = 500;

export const STANDARD_ATMOSPHERE = 1013.25;

export type BaroReading = {
  pressure: number;
  timestamp: number;
};

export const barometricAltitude = (
  pressure: number,
  baselinePressure: number | null,
): number | null => {
  if (baselinePressure == null || baselinePressure <= 0 || pressure <= 0) {
    return null;
  }
  return 44330 * (1 - Math.pow(pressure / baselinePressure, 0.190284));
};

export const watchBarometer = (
  onReading: (reading: BaroReading) => void,
  onError: (error: Error) => void,
): (() => void) => {
  setUpdateIntervalForType(SensorTypes.barometer, BARO_INTERVAL);
  const sub = barometer.subscribe({
    next: ({ pressure, timestamp }: { pressure: number; timestamp: number }) => {
      onReading({ pressure, timestamp });
    },
    error: (error: Error) => onError(error),
  });
  return () => {
    sub.unsubscribe();
    setUpdateIntervalForType(SensorTypes.barometer, 200);
  };
};