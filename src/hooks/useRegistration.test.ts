/**
 * useRegistration Hook Tests
 *
 * Purpose: Test registration flows including creation, price calculation,
 * period loading, resume, and auto-save.
 *
 * Testing Strategy:
 * - Mock Firebase Firestore (doc, getDoc, setDoc, collection, getDocs, query, where, runTransaction)
 * - Mock transaction utilities (generateReceiptNumber, generateConfirmationQr)
 * - Mock toast notifications
 * - Test registration success and failure paths
 * - Test price calculation for different user tiers
 * - Test period loading from Firestore
 * - Test resume registration from pending state
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRegistration } from './useRegistration';
import { doc, getDoc, setDoc, collection, getDocs, query, where, runTransaction } from 'firebase/firestore';
import { generateReceiptNumber, generateConfirmationQr } from '../utils/transaction';
import toast from 'react-hot-toast';

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: () => Math.floor(Date.now() / 1000),
    fromDate: (d: Date) => Math.floor(d.getTime() / 1000),
  },
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-timestamp'),
}));

jest.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'user-123' } },
}));

jest.mock('../utils/transaction', () => ({
  generateReceiptNumber: jest.fn(),
  generateConfirmationQr: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../utils/userDataMapper', () => ({
  toFirestoreUserData: jest.fn((data: Record<string, unknown>) => data),
}));

describe('useRegistration', () => {
  const createMockDocRef = (...args: unknown[]) => ({
    path: typeof args[1] === 'string' ? args.slice(1).join('/') : 'auto-id',
    id: args.length > 2 && typeof args[2] === 'string' ? args[2] : 'auto-generated-id',
    type: 'document',
  });

  const mockUser = {
    id: 'user-123',
    uid: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    phone: '010-1234-5678',
    organization: 'Test Org',
    licenseNumber: 'LC-12345',
    tier: 'MEMBER' as const,
    country: 'KR',
    isForeigner: false,
    authStatus: { emailVerified: true, phoneVerified: false },
    createdAt: null,
    updatedAt: null,
  };

  const mockPeriod = {
    id: 'early',
    name: 'Early Bird',
    startDate: { seconds: 1704067200, nanoseconds: 0 },
    endDate: { seconds: 1767225600, nanoseconds: 0 },
    prices: {
      MEMBER: 50000,
      NON_MEMBER: 70000,
    },
  };

  const mockFreePeriod = {
    id: 'free',
    name: 'Free',
    startDate: { seconds: 1704067200, nanoseconds: 0 },
    endDate: { seconds: 1767225600, nanoseconds: 0 },
    prices: {
      MEMBER: 0,
      NON_MEMBER: 0,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (doc as jest.Mock).mockImplementation(createMockDocRef);
    (collection as jest.Mock).mockReturnValue({ type: 'collection' });
    (query as jest.Mock).mockReturnValue({ type: 'query' });
    (where as jest.Mock).mockReturnValue({ type: 'filter' });
    (generateReceiptNumber as jest.Mock).mockResolvedValue('2026-SP-001');
    (generateConfirmationQr as jest.Mock).mockReturnValue('confirm-qr-123');
    (setDoc as jest.Mock).mockResolvedValue(undefined);
    (getDoc as jest.Mock).mockResolvedValue({ exists: jest.fn(() => false) });
    (getDocs as jest.Mock).mockResolvedValue({ empty: true, docs: [] });
  });

  describe('initial state', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.success).toBe(false);
    });

    it('should provide all expected functions', () => {
      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      expect(typeof result.current.register).toBe('function');
      expect(typeof result.current.calculatePrice).toBe('function');
      expect(typeof result.current.resumeRegistration).toBe('function');
      expect(typeof result.current.autoSave).toBe('function');
    });
  });

  describe('calculatePrice', () => {
    it('should return correct price for MEMBER tier', () => {
      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      const price = result.current.calculatePrice(mockPeriod);
      expect(price).toBe(50000);
    });

    it('should return NON_MEMBER price for NON_MEMBER tier', () => {
      const nonMemberUser = { ...mockUser, tier: 'NON_MEMBER' as const };
      const { result } = renderHook(() => useRegistration('conf-123', nonMemberUser));

      const price = result.current.calculatePrice(mockPeriod);
      expect(price).toBe(70000);
    });

    it('should return 0 when user is null', () => {
      const { result } = renderHook(() => useRegistration('conf-123', null));

      const price = result.current.calculatePrice(mockPeriod);
      expect(price).toBe(0);
    });

    it('should fallback to NON_MEMBER price when tier price not found', () => {
      const periodWithoutTier = {
        ...mockPeriod,
        prices: { NON_MEMBER: 70000 },
      };
      const unknownTierUser = { ...mockUser, tier: 'VIP' as 'MEMBER' | 'NON_MEMBER' };
      const { result } = renderHook(() => useRegistration('conf-123', unknownTierUser));

      const price = result.current.calculatePrice(periodWithoutTier);
      expect(price).toBe(70000);
    });

    it('should return 0 when no price is defined', () => {
      const emptyPeriod = { ...mockPeriod, prices: {} };
      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      const price = result.current.calculatePrice(emptyPeriod);
      expect(price).toBe(0);
    });
  });

  describe('register - success', () => {
    it('should register successfully for free period', async () => {
      (runTransaction as jest.Mock).mockImplementation(async (_db: unknown, callback: (tx: unknown) => Promise<string>) => {
        return callback({
          get: jest.fn(),
          set: jest.fn(),
          update: jest.fn(),
        });
      });

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await act(async () => {
        const success = await result.current.register(mockFreePeriod);
        expect(success).toBe(true);
      });

      expect(result.current.success).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(runTransaction).toHaveBeenCalled();
      expect(generateReceiptNumber).toHaveBeenCalledWith('conf-123', expect.anything());
      expect(generateConfirmationQr).toHaveBeenCalled();
    });

    it('should set loading=true during registration', async () => {
      let resolveTransaction: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveTransaction = resolve;
      });

      (runTransaction as jest.Mock).mockReturnValue(pendingPromise);

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      let registerPromise: Promise<boolean>;
      act(() => {
        registerPromise = result.current.register(mockFreePeriod);
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveTransaction!('reg-id-123');
        await registerPromise!;
      });

      expect(result.current.loading).toBe(false);
    });

    it('should set loading=true then false during paid registration', async () => {
      jest.useFakeTimers();
      (runTransaction as jest.Mock).mockImplementation(async (_db: unknown, callback: (tx: unknown) => Promise<string>) => {
        return callback({
          get: jest.fn(),
          set: jest.fn(),
          update: jest.fn(),
        });
      });

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      let registerPromise: Promise<boolean>;
      act(() => {
        registerPromise = result.current.register(mockPeriod);
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        jest.runAllTimers();
        await registerPromise!;
      });

      expect(result.current.loading).toBe(false);
      jest.useRealTimers();
    });
  });

  describe('register - failure', () => {
    it('should return false and set error when user is null', async () => {
      const { result } = renderHook(() => useRegistration('conf-123', null));

      await act(async () => {
        const success = await result.current.register(mockPeriod);
        expect(success).toBe(false);
      });

      expect(result.current.error).toBe('User not logged in');
      expect(result.current.success).toBe(false);
    });

    it('should handle transaction failure', async () => {
      (runTransaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await act(async () => {
        const success = await result.current.register(mockFreePeriod);
        expect(success).toBe(false);
      });

      expect(result.current.error).toBe('Transaction failed');
      expect(result.current.success).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('availablePeriods', () => {
    it('should fetch and filter active periods', async () => {
      const activePeriod = {
        id: 'active',
        name: 'Active',
        startDate: 0,
        endDate: 9999999999,
        prices: { MEMBER: 50000 },
      };
      const expiredPeriod = {
        id: 'expired',
        name: 'Expired',
        startDate: 100,
        endDate: 200,
        prices: { MEMBER: 30000 },
      };

      (getDoc as jest.Mock).mockResolvedValue({
        exists: jest.fn(() => true),
        data: jest.fn(() => ({ periods: [activePeriod, expiredPeriod] })),
      });

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await waitFor(() => {
        expect(result.current.availablePeriods.length).toBe(1);
      });

      expect(result.current.availablePeriods[0].id).toBe('active');
    });

    it('should handle missing registration settings', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: jest.fn(() => false),
      });

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await waitFor(() => {
        expect(result.current.availablePeriods).toBeDefined();
      });

      expect(result.current.availablePeriods).toEqual([]);
    });

    it('should handle fetch error for periods', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Fetch error'));

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await waitFor(() => {
        expect(result.current.availablePeriods).toBeDefined();
      });

      expect(result.current.availablePeriods).toEqual([]);
    });
  });

  describe('resumeRegistration', () => {
    it('should return null when no conferenceId', async () => {
      const { result } = renderHook(() => useRegistration('', mockUser));

      await act(async () => {
        const resumed = await result.current.resumeRegistration('user-123');
        expect(resumed).toBeNull();
      });
    });

    it('should return null when no userId', async () => {
      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await act(async () => {
        const resumed = await result.current.resumeRegistration('');
        expect(resumed).toBeNull();
      });
    });

    it('should query for pending registrations by userId and status', async () => {
      const mockPendingDoc = {
        id: 'reg-pending-1',
        data: jest.fn(() => ({
          status: 'PENDING',
          userId: 'user-123',
          updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
          formData: { name: 'Test' },
        })),
      };

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [mockPendingDoc],
      });

      await act(async () => {
        await result.current.resumeRegistration('user-123');
      });

      expect(getDocs).toHaveBeenCalled();
      expect(toast).toHaveBeenCalled();
    });

    it('should return null when no pending registration exists', async () => {
      (getDocs as jest.Mock).mockResolvedValue({ empty: true, docs: [] });

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await act(async () => {
        const resumed = await result.current.resumeRegistration('user-123');
        expect(resumed).toBeNull();
      });
    });

    it('should handle resume query errors', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Query error'));

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await act(async () => {
        const resumed = await result.current.resumeRegistration('user-123');
        expect(resumed).toBeNull();
      });
    });
  });

  describe('autoSave', () => {
    it('should return null when user is null', async () => {
      const { result } = renderHook(() => useRegistration('conf-123', null));

      await act(async () => {
        const saved = await result.current.autoSave(1, { name: 'Test' });
        expect(saved).toBeNull();
      });
    });

    it('should save form data to Firestore', async () => {
      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await act(async () => {
        const saved = await result.current.autoSave(1, { name: 'Test', email: 'test@example.com' });
        expect(saved).toBeTruthy();
      });

      expect(setDoc).toHaveBeenCalled();
    });

    it('should save to existing registration when regId provided', async () => {
      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await act(async () => {
        const saved = await result.current.autoSave(2, { name: 'Test' }, 'existing-reg-id');
        expect(saved).toBe('existing-reg-id');
      });

      expect(setDoc).toHaveBeenCalled();
    });

    it('should handle autoSave error gracefully', async () => {
      (setDoc as jest.Mock).mockRejectedValueOnce(new Error('Save failed'));

      const { result } = renderHook(() => useRegistration('conf-123', mockUser));

      await act(async () => {
        const saved = await result.current.autoSave(1, { name: 'Test' });
        expect(saved).toBeNull();
      });
    });
  });
});
