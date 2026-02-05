/**
 * Firebase 모의 객체 (Mock) 라이브러리
 * 테스트에서 사용할 수 있는 재사용 가능한 Mock 유틸리티
 */

// Firestore Document Mock
export const createMockDoc = <T = unknown>(data: {
  id: string;
  exists: boolean;
  data?: () => T;
}) => ({
  id: data.id,
  exists: data.exists,
  data: data.data || (() => ({})),
  ref: { id: data.id },
});

// Firestore Collection Mock
export const createMockCollection = <T = unknown>(docs: Array<{ id: string; data: T }>) => ({
  docs: docs.map(doc => ({
    id: doc.id,
    data: () => doc.data,
    exists: true,
  })),
  forEach: jest.fn(callback => {
    docs.forEach(doc => callback({ id: doc.id, data: () => doc.data, exists: true }));
  }),
  empty: docs.length === 0,
  size: docs.length,
});

// Timestamp Mock Helper
export const createMockTimestamp = (seconds: number) => ({
  seconds,
  nanoseconds: 0,
  toMillis: () => seconds * 1000,
  toDate: () => new Date(seconds * 1000),
});

// Firebase User Mock
export const createMockUser = (overrides?: Partial<import('firebase/auth').User>) => ({
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  emailVerified: true,
  ...overrides,
});

// Auth State Mock
export const createMockAuthState = (user: import('firebase/auth').User | null = null) => ({
  user,
  loading: false,
  step: user ? 'LOGGED_IN' : 'IDLE',
  error: null,
});

// Conference Mock (스키마 기반)
export const createMockConference = (overrides?: Partial<import('@/types/schema').Conference>) => ({
  id: 'kap_2026spring',
  societyId: 'kap',
  slug: '2026spring',
  title: { ko: 'KAP 2026 봄학술대회', en: 'KAP 2026 Spring Conference' },
  dates: {
    start: createMockTimestamp(Math.floor(Date.now() / 1000)),
    end: createMockTimestamp(Math.floor(Date.now() / 1000) + 86400),
  },
  location: '서울 코역스',
  status: 'OPEN' as const,
  createdAt: createMockTimestamp(Math.floor(Date.now() / 1000)),
  ...overrides,
});

// Registration Mock (스키마 기반)
export const createMockRegistration = (overrides?: Partial<import('@/types/schema').Registration>) => ({
  id: 'reg-123',
  userId: 'user-123',
  conferenceId: 'kap_2026spring',
  paymentStatus: 'PAID' as const,
  paymentMethod: 'CARD' as const,
  amount: 100000,
  refundAmount: 0,
  receiptNumber: '2026-SP-001',
  confirmationQr: 'CONF-reg-123',
  badgeQr: null,
  isCheckedIn: false,
  checkInTime: null,
  createdAt: createMockTimestamp(Math.floor(Date.now() / 1000)),
  updatedAt: createMockTimestamp(Math.floor(Date.now() / 1000)),
  ...overrides,
});

// ConferenceUser Mock (스키마 기반)
export const createMockConferenceUser = (overrides?: Partial<import('@/types/schema').ConferenceUser>) => ({
  uid: 'user-123',
  id: 'user-123',
  name: '홍길동',
  email: 'test@example.com',
  phone: '010-1234-5678',
  country: 'KR',
  isForeigner: false,
  tier: 'MEMBER' as const,
  authStatus: {
    emailVerified: true,
    phoneVerified: true,
  },
  affiliations: {},
  createdAt: createMockTimestamp(Math.floor(Date.now() / 1000) - 86400),
  updatedAt: createMockTimestamp(Math.floor(Date.now() / 1000)),
  ...overrides,
});

// Async 테스트 헬퍼: resolve를 기다림
export const waitFor = (condition: () => boolean, timeout = 1000) => {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
};

// Mock 함수 실행 결과 추적 헬퍼
export const mockFunctionResults = <T extends (...args: unknown[]) => unknown>(fn: jest.MockedFunction<T>) => {
  return {
    getCount: () => fn.mock.calls.length,
    getLastCall: () => fn.mock.calls[fn.mock.calls.length - 1],
    getAllResults: () => fn.mock.results.map(r => r.value),
  };
};
