export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['esbuild-jest', {
      loaders: {
        '.ts': 'ts',
        '.tsx': 'tsx',
      },
      inject: ['<rootDir>/src/test/import-meta-shim.ts'],
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testTimeout: 10000,

  // 경로 별칭 (@/) 처리
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@testing-library/react$': '<rootDir>/node_modules/@testing-library/react',
    '^../firebase$': '<rootDir>/src/firebase.mock.ts',
  },

  // 커버리지 설정
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/main.tsx',
    '!src/vite-env.d.ts'
  ],

  // Firebase 모듈 모킹 + uuid ESM 처리
  transformIgnorePatterns: [
    'node_modules/(?!(firebase|@firebase|uuid)/)'
  ]
};
