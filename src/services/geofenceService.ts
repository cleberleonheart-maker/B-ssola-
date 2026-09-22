import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

export type GeofenceInput = {
  id: string;
  name: string;
  title: string;
  latitude: number;
  longitude: number;
  radius: number;
};

export const geofenceSupported = Platform.OS === 'android' && !!NativeModules.Geofence;

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!geofenceSupported) return true;
  if (Platform.OS === 'android' && Platform.Version < 33) return true;
  try {
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

export const addGeofence = async (geo: GeofenceInput): Promise<boolean> => {
  if (!geofenceSupported) return false;
  try {
    await NativeModules.Geofence.addGeofence(
      String(geo.id),
      String(geo.name),
      String(geo.title),
      geo.latitude,
      geo.longitude,
      geo.radius,
    );
    return true;
  } catch {
    return false;
  }
};

export const removeGeofence = async (id: string): Promise<void> => {
  if (!geofenceSupported) return;
  NativeModules.Geofence.removeGeofence(String(id));
};