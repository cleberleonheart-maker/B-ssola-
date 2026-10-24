import { Accelerometer } from 'react-native-sensors';
import { Vibration } from 'react-native';
import { map } from 'rxjs/operators';

export type FallCallback = () => void;

let subscription: any = null;
let lastImpact = 0;
let lastStill = 0;
let impactCount = 0;

const IMPACT_THRESHOLD = 2.8;
const STILL_THRESHOLD = 0.4;
const IMPACT_WINDOW = 1500;
const STILL_WINDOW = 4000;

export const startFallDetection = (onFall: FallCallback) => {
  if (subscription) return;
  try {
    subscription = new Accelerometer({
      updateInterval: 100,
    })
      .pipe(map(({ x, y, z }: any) => Math.sqrt((x * x + y * y + z * z) / 9.81)))
      .subscribe((g: number) => {
        const now = Date.now();
        if (g > IMPACT_THRESHOLD) {
          if (now - lastImpact > IMPACT_WINDOW) {
            impactCount = 1;
            lastImpact = now;
          } else {
            impactCount += 1;
          }
        }
        if (g < 1 + STILL_THRESHOLD && g > 1 - STILL_THRESHOLD) {
          if (impactCount > 0 && now - lastImpact < IMPACT_WINDOW + STILL_WINDOW) {
            if (now - lastStill > 2000) {
              lastStill = now;
              try {
                Vibration.vibrate([200, 100, 200]);
              } catch {}
              onFall();
            }
          }
        }
      });
  } catch {
    // sensores não disponíveis
  }
};

export const stopFallDetection = () => {
  if (subscription) {
    try {
      subscription.unsubscribe();
    } catch {}
    subscription = null;
  }
  impactCount = 0;
  lastImpact = 0;
  lastStill = 0;
};
