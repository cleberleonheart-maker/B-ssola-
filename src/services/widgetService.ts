import { NativeModules, Platform } from 'react-native';

export type WidgetData = {
  heading: number;
  cardinal: string;
  pressure: number;
  altitude: number;
  hasAlt: boolean;
  temp?: string | null;
};

export const widgetSupported = Platform.OS === 'android' && !!NativeModules.WidgetBridge;

export const updateWidget = (data: WidgetData): void => {
  if (!widgetSupported) return;
  NativeModules.WidgetBridge.update({
    ...data,
    temp: data.temp ?? null,
    hasAlt: Boolean(data.hasAlt),
  });
};