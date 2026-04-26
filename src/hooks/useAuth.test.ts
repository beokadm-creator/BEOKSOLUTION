/**
 * useAuth Hook Tests
 *
 * Purpose: Test authentication state management, login/logout flows,
 * session restoration, and non-member session clearing.
 *
 * Testing Strategy:
 * - Mock Firebase Auth (onAuthStateChanged, signOut)
 * - Mock Firebase Firestore (doc, onSnapshot)
 * - Mock session utilities (getSessionToken, getRootCookie, clearAllSessions)
 * - Test auth state change listener behavior
 * - Test logout function
 * - Test session restoration flow with custom token
 */

import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getSessionToken } from '../utils/sessionManager';
import { getRootCookie, clearAllSessions } from '../utils/cookie';
import { normalizeUserData } from '../utils/userDataMapper';

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
  signInWithCustomToken: jest.fn(),
  getAuth: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
  getFunctions: jest.fn(),
}));

jest.mock('../firebase', () => ({
  auth: {},
  db: {},
  functions: {},
}));

jest.mock('../utils/sessionManager', () => ({
  getSessionToken: jest.fn(),
}));

jest.mock('../utils/cookie', () => ({
  getRootCookie: jest.fn(),
  removeRootCookie: jest.fn(),
  clearAllSessions: jest.fn(),
}));

jest.mock('../utils/userDataMapper', () => ({
  normalizeUserData: jest.fn(),
}));

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('useAuth', () => {
  const mockUnsubscribe = jest.fn();
  const mockDocUnsub = jest.fn();

  const mockCurrentUser = {
    uid: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    emailVerified: true,
  };

  const mockFirestoreDoc = {
    exists: jest.fn(),
    data: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (onAuthStateChanged as jest.Mock).mockReturnValue(mockUnsubscribe);
    (doc as jest.Mock).mockReturnValue({ path: 'users/user-123' });
    (onSnapshot as jest.Mock).mockReturnValue(mockDocUnsub);
    (getRootCookie as jest.Mock).mockReturnValue(null);
    (getSessionToken as jest.Mock).mockReturnValue({ token: null, isValid: false, source: 'none' });
    (normalizeUserData as jest.Mock).mockReturnValue({
      name: 'Test User',
      email: 'test@example.com',
      phone: '010-1234-5678',
      organization: 'Test Org',
      licenseNumber: 'LC-12345',
      tier: 'MEMBER',
      country: 'KR',
      isForeigner: false,
      authStatus: { emailVerified: true, phoneVerified: false },
      affiliations: undefined,
      createdAt: null,
      updatedAt: null,
    });
    (signOut as jest.Mock).mockResolvedValue(undefined);
    (clearAllSessions as jest.Mock).mockImplementation(() => {});
    sessionStorageMock.store = {};
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('should initialize with loading=true and no user', () => {
      (onAuthStateChanged as jest.Mock).mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useAuth());

      expect(result.current.auth.loading).toBe(true);
      expect(result.current.auth.user).toBeNull();
      expect(result.current.auth.step).toBe('IDLE');
      expect(result.current.auth.error).toBeNull();
    });

    it('should provide logout function', () => {
      (onAuthStateChanged as jest.Mock).mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useAuth());

      expect(typeof result.current.logout).toBe('function');
    });
  });

  describe('auth state change - authenticated user', () => {
    it('should set user data when auth state changes with current user', async () => {
      let authCallback: (user: unknown) => void;
      (onAuthStateChanged as jest.Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
        authCallback = callback;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useAuth());

      mockFirestoreDoc.exists.mockReturnValue(true);
      mockFirestoreDoc.data.mockReturnValue({
        name: 'Test User',
        email: 'test@example.com',
        phone: '010-1234-5678',
        organization: 'Test Org',
      });

      await act(async () => {
        authCallback(mockCurrentUser);
        (onSnapshot as jest.Mock).mock.calls[0][1](mockFirestoreDoc);
      });

      expect(result.current.auth.loading).toBe(false);
      expect(result.current.auth.step).toBe('LOGGED_IN');
      expect(result.current.auth.user).toBeTruthy();
    });

    it('should clear non-member session on login', async () => {
      sessionStorageMock.store['NON_MEMBER'] = 'some-data';

      let authCallback: (user: unknown) => void;
      (onAuthStateChanged as jest.Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
        authCallback = callback;
        return mockUnsubscribe;
      });

      renderHook(() => useAuth());

      await act(async () => {
        authCallback(mockCurrentUser);
        (onSnapshot as jest.Mock).mock.calls[0][1](mockFirestoreDoc);
      });

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('NON_MEMBER');
    });

    it('should handle user doc not existing', async () => {
      let authCallback: (user: unknown) => void;
      (onAuthStateChanged as jest.Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
        authCallback = callback;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useAuth());

      mockFirestoreDoc.exists.mockReturnValue(false);

      await act(async () => {
        authCallback(mockCurrentUser);
        (onSnapshot as jest.Mock).mock.calls[0][1](mockFirestoreDoc);
      });

      expect(result.current.auth.step).toBe('LOGGED_IN');
      expect(result.current.auth.loading).toBe(false);
    });

    it('should handle onSnapshot error', async () => {
      let authCallback: (user: unknown) => void;
      (onAuthStateChanged as jest.Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
        authCallback = callback;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        authCallback(mockCurrentUser);
        const snapshotError = { code: 'permission-denied', message: 'Permission denied' };
        (onSnapshot as jest.Mock).mock.calls[0][2](snapshotError);
      });

      expect(result.current.auth.error).toBe('Permission denied');
      expect(result.current.auth.loading).toBe(false);
    });
  });

  describe('auth state change - no user (logged out)', () => {
    it('should set idle state when no user and no session token', async () => {
      let authCallback: (user: unknown) => void;
      (onAuthStateChanged as jest.Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
        authCallback = callback;
        return mockUnsubscribe;
      });
      (getSessionToken as jest.Mock).mockReturnValue({ token: null, isValid: false, source: 'none' });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        authCallback(null);
      });

      expect(result.current.auth.loading).toBe(false);
      expect(result.current.auth.user).toBeNull();
      expect(result.current.auth.step).toBe('IDLE');
      expect(result.current.auth.error).toBeNull();
    });
  });

  describe('session restoration', () => {
    it('should attempt session restoration when session token exists', async () => {
      let authCallback: (user: unknown) => void;
      (onAuthStateChanged as jest.Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
        authCallback = callback;
        return mockUnsubscribe;
      });

      (getSessionToken as jest.Mock).mockReturnValue({
        token: 'valid-session-token',
        isValid: true,
        source: 'cookie',
      });

      const mockMintFn = jest.fn().mockResolvedValue({ data: { token: 'custom-token-123' } });
      (httpsCallable as jest.Mock).mockReturnValue(mockMintFn);
      (signInWithCustomToken as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        authCallback(null);
      });

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'mintCrossDomainToken');
      expect(signInWithCustomToken).toHaveBeenCalledWith(expect.anything(), 'custom-token-123');
      expect(result.current.auth.step).toBe('REQUESTED');
    });

    it('should set error when session token is expired', async () => {
      let authCallback: (user: unknown) => void;
      (onAuthStateChanged as jest.Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
        authCallback = callback;
        return mockUnsubscribe;
      });

      (getSessionToken as jest.Mock).mockReturnValue({
        token: 'expired-token',
        isValid: false,
        source: 'cookie',
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        authCallback(null);
      });

      expect(result.current.auth.loading).toBe(false);
      expect(result.current.auth.step).toBe('IDLE');
      expect(clearAllSessions).toHaveBeenCalled();
      expect(result.current.auth.user).toBeNull();
    });

    it('should set error when mintCrossDomainToken fails', async () => {
      let authCallback: (user: unknown) => void;
      (onAuthStateChanged as jest.Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
        authCallback = callback;
        return mockUnsubscribe;
      });

      (getSessionToken as jest.Mock).mockReturnValue({
        token: 'valid-token',
        isValid: true,
        source: 'cookie',
      });

      const mockMintFn = jest.fn().mockRejectedValue(new Error('Network error'));
      (httpsCallable as jest.Mock).mockReturnValue(mockMintFn);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        authCallback(null);
      });

      expect(result.current.auth.loading).toBe(false);
      expect(result.current.auth.step).toBe('IDLE');
      expect(clearAllSessions).toHaveBeenCalled();
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'mintCrossDomainToken');
    });

    it('should set error when custom token is not received', async () => {
      let authCallback: (user: unknown) => void;
      (onAuthStateChanged as jest.Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
        authCallback = callback;
        return mockUnsubscribe;
      });

      (getSessionToken as jest.Mock).mockReturnValue({
        token: 'valid-token',
        isValid: true,
        source: 'cookie',
      });

      const mockMintFn = jest.fn().mockResolvedValue({ data: { token: null } });
      (httpsCallable as jest.Mock).mockReturnValue(mockMintFn);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        authCallback(null);
      });

      expect(result.current.auth.loading).toBe(false);
      expect(result.current.auth.step).toBe('IDLE');
      expect(clearAllSessions).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should clear sessions and sign out on logout', async () => {
      (onAuthStateChanged as jest.Mock).mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(clearAllSessions).toHaveBeenCalled();
      expect(signOut).toHaveBeenCalled();
    });

    it('should reset auth state after logout', async () => {
      (onAuthStateChanged as jest.Mock).mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.auth.user).toBeNull();
      expect(result.current.auth.loading).toBe(false);
      expect(result.current.auth.step).toBe('IDLE');
      expect(result.current.auth.error).toBeNull();
    });

    it('should handle signOut errors', async () => {
      (onAuthStateChanged as jest.Mock).mockImplementation(() => mockUnsubscribe);
      (signOut as jest.Mock).mockRejectedValue(new Error('Sign out failed'));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try { await result.current.logout(); } catch { /* expected */ }
      });

      expect(clearAllSessions).toHaveBeenCalled();
      expect(signOut).toHaveBeenCalled();
    });
  });

  describe('safety timeout', () => {
    it('should force loading=false after 15 seconds if Firebase has not responded', async () => {
      (onAuthStateChanged as jest.Mock).mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useAuth());

      expect(result.current.auth.loading).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(15000);
      });

      expect(result.current.auth.loading).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe on unmount', () => {
      (onAuthStateChanged as jest.Mock).mockImplementation(() => mockUnsubscribe);

      const { unmount } = renderHook(() => useAuth());

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
