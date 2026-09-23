import Geolocation, {
  type GeolocationOptions,
} from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform, Linking } from 'react-native';

export type PermissionStatus = 'granted' | 'denied';

export const checkLocationPermission = async (): Promise<PermissionStatus> => {
  if (Platform.OS !== 'android') return 'granted';
  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
};

export const requestLocationPermission = async (): Promise<PermissionStatus> => {
  if (Platform.OS !== 'android') return 'granted';
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Localização da Bússola',
        message:
          'Precisamos da sua localização para mostrar coordenadas, precisão e velocidade.',
        buttonNeutral: 'Depois',
        buttonNegative: 'Cancelar',
        buttonPositive: 'Permitir',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED
      ? 'granted'
      : 'denied';
  } catch {
    return 'denied';
  }
};

export const openLocationSettings = () => {
  Linking.openSettings();
};

export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  provider: string | null;
  updatedAt: number | null;
};

export type LocationMode = 'satellite' | 'network' | 'tower';

export type WatchOptions = {
  mode: LocationMode;
  distanceFilter?: number;
  relaxed?: boolean;
};

const toFix = (position: any): LocationFix => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy ?? null,
  altitude: position.coords.altitude ?? null,
  speed: position.coords.speed ?? null,
  provider: position.coords.provider ?? null,
  updatedAt: position.timestamp ?? Date.now(),
});

const buildOptions = (opts: WatchOptions): GeolocationOptions => {
  const sat = opts.mode === 'satellite';
  const tower = opts.mode === 'tower';
  const relaxed = !!opts.relaxed;
  return {
    enableHighAccuracy: sat,
    distanceFilter:
      opts.distanceFilter ?? (relaxed ? (sat ? 20 : 50) : sat ? 1 : 10),
    timeout: tower ? 8000 : 15000,
    maximumAge: tower ? 30000 : sat ? 1000 : 5000,
    interval: relaxed ? (sat ? 20000 : tower ? 40000 : 30000) : sat ? 5000 : tower ? 15000 : 10000,
  };
};

export const watchLocation = (
  opts: WatchOptions,
  onFix: (fix: LocationFix) => void,
  onError: (error: Error) => void,
): (() => void) => {
  const watchId = Geolocation.watchPosition(
    position => onFix(toFix(position)),
    error => onError(new Error(error.message)),
    buildOptions(opts),
  );

  return () => Geolocation.clearWatch(watchId);
};

export const getLocationOnce = (
  opts: WatchOptions,
  onFix: (fix: LocationFix) => void,
  onError: (error: Error) => void,
) => {
  Geolocation.getCurrentPosition(
    position => onFix(toFix(position)),
    error => onError(new Error(error.message)),
    buildOptions(opts),
  );
};