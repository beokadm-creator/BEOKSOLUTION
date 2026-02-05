export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom', // React 컴포넌트 테스트를 위해 jsdom 사용
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testTimeout: 10000,

  // 경로 별칭 (@/) 처리
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@testing-library/react$': '<rootDir>/node_modules/@testing-library/react',
    '^../firebase$': '<rootDir>/src/firebase.mock.ts', // firebase.ts 모킹
  },

  // 커버리지 설정 (선택 사항)
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
