/**
 * useRegistration Hook Tests
 *
 * Purpose: Test period loading and resume registration functionality.
 *
 * Testing Strategy:
 * - Mock Firebase Firestore (doc, getDoc, collection, getDocs, query, where)
 * - Mock toast notifications
 * - Test period loading from Firestore
 * - Test resume registration from pending state
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRegistration } from './useRegistration';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: () => Math.floor(Date.now() / 1000),
    fromDate: (d: Date) => Math.floor(d.getTime() / 1000),
  },
  doc: jest.fn(),
  getDoc: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

jest.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'user-123' } },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();

    (doc as jest.Mock).mockImplementation(createMockDocRef);
    (collection as jest.Mock).mockReturnValue({ type: 'collection' });
    (query as jest.Mock).mockReturnValue({ type: 'query' });
    (where as jest.Mock).mockReturnValue({ type: 'filter' });
    (getDoc as jest.Mock).mockResolvedValue({ exists: jest.fn(() => false) });
    (getDocs as jest.Mock).mockResolvedValue({ empty: true, docs: [] });
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
});
