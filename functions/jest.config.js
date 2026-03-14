/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
  // Mock Firebase admin by default
  moduleNameMapper: {
    '^firebase-admin$': '<rootDir>/src/__mocks__/firebase-admin.mock.ts',
    '^firebase-admin/firestore$': '<rootDir>/src/__mocks__/firebase-admin.mock.ts',
  },
};
