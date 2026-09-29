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
