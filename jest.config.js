/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
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
