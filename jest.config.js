/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/jest/setup.js'],
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^expo-router$': '<rootDir>/test/jest/expo-router.js',
    '^expo-constants$': '<rootDir>/test/jest/expo-constants.js',
    '^expo-localization$': '<rootDir>/test/jest/expo-localization.js',
    '^expo-haptics$': '<rootDir>/test/jest/expo-haptics.js',
    '^@expo/vector-icons$': '<rootDir>/test/jest/expo-vector-icons.js',
    '^lucide-react-native$': '<rootDir>/test/jest/lucide-react-native.js',
    '^react-native-gesture-handler$': '<rootDir>/test/jest/react-native-gesture-handler.js',
    '^react-native-reanimated$': '<rootDir>/test/jest/react-native-reanimated.js',
    '^react-native-safe-area-context$': '<rootDir>/test/jest/react-native-safe-area-context.js',
    '^react-native-url-polyfill/auto$': '<rootDir>/test/jest/empty.js',
    '^@sentry/react-native$': '<rootDir>/test/jest/sentry-react-native.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo|@expo|expo-modules-core|expo-router|@react-native|react-native|nativewind|react-native-css-interop|react-native-url-polyfill)/)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.expo/',
    '/dist/',
    '/android/',
    '/ios/',
    '/.claude/worktrees/',
    // Legacy live-integration suites (Venue*, *Educational*Integration) load the
    // real Supabase client which requires a React Native env. They were never
    // adapted for unit-test runs. Move to /tests/integration/ before re-enabling.
    '.*Integration\\.test\\.ts$',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Inherit project tsconfig but override jsx to "react" so JSX in .tsx
        // sources is transformed to React.createElement under jest's node env.
        // The app's "react-native" jsx mode preserves JSX for Metro; jest has
        // no Metro pipeline, so it needs the classic transform here.
        jsx: 'react',
        esModuleInterop: true,
        moduleResolution: 'node',
        target: 'ES2019',
        resolveJsonModule: true,
        strict: true,
        paths: { '@/*': ['./*'] },
        baseUrl: '.',
      },
      diagnostics: false,
    }],
  },
};
