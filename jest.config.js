module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': '<rootDir>/ts-transformer.js'
  },
  moduleFileExtensions: ['ts', 'js'],
};
