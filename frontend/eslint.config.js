import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

const baseTsConfig = {
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    globals: globals.browser,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react-refresh/only-export-components': 'warn',
    'no-case-declarations': 'warn',
    'no-empty': 'warn',
    'no-useless-escape': 'warn',
    'prefer-const': 'warn',
    'react-hooks/rules-of-hooks': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'no-irregular-whitespace': 'warn',
    '@typescript-eslint/no-require-imports': 'warn',
  },
}

const testOverride = {
  files: [
    'src/**/__tests__/**/*.{ts,tsx}',
    'src/**/*.test.{ts,tsx}',
    'src/**/*.spec.{ts,tsx}',
    'src/test-utils/**/*.{ts,tsx}',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'react-refresh/only-export-components': 'off',
    '@typescript-eslint/no-require-imports': 'off',
  },
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    globals: {
      ...globals.browser,
      ...globals.jest,
    },
  },
}

const jsOverride = {
  files: ['src/index.js'],
  extends: [js.configs.recommended],
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    globals: globals.browser,
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
}

export default tseslint.config([
  globalIgnores([
    'dist/**',
    'coverage/**',
    'tests/e2e/**',
    'src/test-utils/**',
    'frontend_backup/**',
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
  baseTsConfig,
  testOverride,
  jsOverride,
])
