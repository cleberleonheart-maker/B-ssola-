module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // O setup roda fora do ambiente de teste, mas usa o global `jest`.
      files: ['jest.setup.js'],
      env: { jest: true },
    },
  ],
};
