module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended'
  ],
  env: {
    node: true,
    es2020: true,
    jest: true
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  globals: {
    NodeJS: 'readonly'
  },
  rules: {
    'no-unused-vars': 'off',
    'no-console': 'off'
  }
};