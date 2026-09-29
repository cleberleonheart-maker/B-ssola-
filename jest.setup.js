jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

jest.mock('@react-native-community/voice', () => ({
  __esModule: true,
  default: {
    onSpeechResults: jest.fn(() => ({ remove: jest.fn() })),
    onSpeechError: jest.fn(() => ({ remove: jest.fn() })),
    onSpeechEnd: jest.fn(() => ({ remove: jest.fn() })),
    onSpeechPartialResults: jest.fn(() => ({ remove: jest.fn() })),
    start: jest.fn(),
    stop: jest.fn(),
    destroy: jest.fn(),
    isAvailable: jest.fn(async () => true),
    requestPermissions: jest.fn(async () => true),
  },
  SpeechResultsEvent: {},
  SpeechErrorEvent: {},
}));

jest.mock('react-native-tts', () => ({
  __esModule: true,
  default: {
    getInitStatus: jest.fn(async () => 'ready'),
    setDefaultLanguage: jest.fn(async () => 'ok'),
    setDefaultRate: jest.fn(async () => 'ok'),
    requestInstallData: jest.fn(async () => 'ok'),
    speak: jest.fn(),
    stop: jest.fn(async () => 'ok'),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// O mock que vem com react-native-sensors chama `observer(valor)` em vez de
// `observer.next(valor)`, o que quebra com a API de observer object usada no
// projeto. Além disso importar a lib real estoura no import: rnsensors.js
// lança se nenhum módulo nativo está presente, e no Jest eles não estão.
jest.mock('react-native-sensors', () => {
  const makeObservable = () => {
    const observable = { handlers: [] };
    observable.subscribe = jest.fn(observer => {
      observable.handlers.push(observer);
      return {
        unsubscribe: jest.fn(() => {
          observable.handlers = observable.handlers.filter(
            h => h !== observer,
          );
        }),
      };
    });
    observable.emit = data => {
      observable.handlers.forEach(h => h.next && h.next(data));
    };
    observable.fail = err => {
      observable.handlers.forEach(h => h.error && h.error(err));
    };
    observable.reset = () => {
      observable.handlers = [];
    };
    return observable;
  };

  return {
    __esModule: true,
    SensorTypes: {
      accelerometer: 'accelerometer',
      gyroscope: 'gyroscope',
      magnetometer: 'magnetometer',
      barometer: 'barometer',
      orientation: 'orientation',
      gravity: 'gravity',
    },
    accelerometer: makeObservable(),
    gyroscope: makeObservable(),
    magnetometer: makeObservable(),
    barometer: makeObservable(),
    orientation: makeObservable(),
    gravity: makeObservable(),
    setUpdateIntervalForType: jest.fn(),
    setLogLevelForType: jest.fn(),
  };
});
