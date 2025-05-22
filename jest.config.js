module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': '<rootDir>/ts-jest-transformer.js',
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
};
