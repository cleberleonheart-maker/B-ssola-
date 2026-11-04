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

/**
 * Diz ao widget se há rastreio ao vivo a correr (ideia #105).
 *
 * Vai em separado dos números: o rastreio arranca e para sozinho, e o botão
 * do widget precisa de trocar entre "Partilhar" e "Parar" sem esperar que o
 * rumo ou a temperatura se mexam.
 */
export const setWidgetShareState = (active: boolean, since: number): void => {
  if (!widgetSupported) return;
  const bridge = NativeModules.WidgetBridge as {
    setShareState?: (active: boolean, since: number) => void;
  };
  if (typeof bridge.setShareState !== 'function') return;
  bridge.setShareState(Boolean(active), Number(since) || 0);
};
