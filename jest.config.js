module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // O async-storage é distribuído em ESM; sem esta exceção o Jest tenta
  // executá-lo sem transpilar e a suíte morre em "Cannot use import statement".
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@react-native-async-storage)/)',
  ],
};
