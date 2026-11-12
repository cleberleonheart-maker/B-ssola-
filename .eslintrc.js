module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // `void` como instrução é a forma de dizer "esta promise fica ao acaso,
    // de propósito". Sem esta opção, cada uma dessas vinte e tal chamadas
    // penduradas dava um aviso — e trocar por `.catch(() => {})` esconderia
    // rejeições que são bugs.
    'no-void': ['warn', { allowAsStatement: true }],
  },
  overrides: [
    {
      // O setup roda fora do ambiente de teste, mas usa o global `jest`.
      files: ['jest.setup.js'],
      env: { jest: true },
    },
  ],
};
