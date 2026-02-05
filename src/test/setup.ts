/**
 * Jest 테스트 환경 설정 파일
 * 모든 테스트 파일 실행 전에 이 파일이 먼저 로드됩니다
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Test setup file with intentional type mismatches for Jest globals

// Node.js TextEncoder/TextDecoder polyfill
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as unknown;

// @testing-library/jest-dom DOM 매처 추가
import '@testing-library/jest-dom';

// Firebase 모킹 (실제 Firebase 연결 방지)
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
    signOut: jest.fn(),
  })),
  onAuthStateChanged: jest.fn(),
  signInWithCustomToken: jest.fn(),
  signOut: jest.fn(),
  browserSessionPersistence: 'session',
}));

jest.mock('firebase/firestore', () => {
  const mockTimestamp = { seconds: Math.floor(Date.now() / 1000), toMillis: () => Date.now() };
  return {
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    collection: jest.fn(),
    addDoc: jest.fn(),
    onSnapshot: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    Timestamp: {
      now: jest.fn(() => mockTimestamp),
      fromDate: jest.fn((date: Date) => ({ seconds: Math.floor(date.getTime() / 1000), toMillis: () => date.getTime() })),
    },
  };
});

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(() => jest.fn()),
}));

jest.mock('firebase/analytics', () => ({
  getAnalytics: jest.fn(),
}));

jest.mock('../firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  analytics: {},
  functions: {},
  app: {},
  default: {},
}));

jest.mock('../constants/adminConstants', () => ({
  ...jest.requireActual('../constants/adminConstants'),
  SUPER_ADMIN_EMAILS: ['aaron@beoksolution.com'],
}));

// localStorage 모킹
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(global as unknown, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// window.matchMedia 모킹 (Responsive UI 테스트를 위해)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
