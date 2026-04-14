/**
 * useCheckIn Hook Tests
 *
 * Purpose: Test conference check-in and badge issuance functionality
 * - QR code scanning (document ID, confirmationQr field, CONF- prefix)
 * - Badge issuance (first-time and reprint)
 * - Error handling and loading states
 *
 * Testing Strategy:
 * - Mock Firebase Firestore operations
 * - Test all QR code formats (document ID, confirmationQr, CONF- prefix, JSON)
 * - Test badge issuance flows (new vs reprint)
 * - Test error scenarios (invalid QR, missing registration, Firestore errors)
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useCheckIn } from './useCheckIn';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { generateBadgeQr } from '../utils/transaction';
import { printBadge } from '../utils/printer';
import { Registration, ConferenceUser, ConferenceInfo } from '../types/schema';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

// Mock transaction utilities
jest.mock('../utils/transaction', () => ({
  generateBadgeQr: jest.fn(),
}));

// Mock printer utility
jest.mock('../utils/printer', () => ({
  printBadge: jest.fn(),
}));

// Mock firebase db
jest.mock('../firebase', () => ({
  db: {},
}));

describe('useCheckIn', () => {
  const mockConferenceId = 'test-conf-123';
  const mockRegId = 'reg-456';
  const mockUserId = 'user-789';

  const mockRegistration: Registration = {
    id: mockRegId,
    userId: mockUserId,
    conferenceId: mockConferenceId,
    paymentStatus: 'PAID',
    paymentMethod: 'CARD',
    amount: 100000,
    refundAmount: 0,
    receiptNumber: '2025-SP-001',
    userTier: 'MEMBER',
    userName: 'Test User',
    userEmail: 'test@example.com',
    userPhone: '010-1234-5678',
    affiliation: 'Test Org',
    licenseNumber: 'LC-12345',
    confirmationQr: 'qr-123',
    badgeQr: null,
    isCheckedIn: false,
    checkInTime: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const mockUser: ConferenceUser = {
    id: mockUserId,
    name: 'Test User',
    email: 'test@example.com',
    phone: '010-1234-5678',
    organization: 'Test Org',
    tier: 'MEMBER',
    licenseNumber: 'LC-12345',
  };

  const mockConferenceInfo: ConferenceInfo = {
    badgeLayout: {
      name: { x: 10, y: 10, fontSize: 20, isVisible: true, type: 'NAME' },
      organization: { x: 10, y: 30, fontSize: 14, isVisible: true, type: 'ORG' },
      qr: { x: 80, y: 10, fontSize: 12, isVisible: true, type: 'QR' },
    },
  };

  const createMockDocRef = (...args: unknown[]) => {
    const path = typeof args[1] === 'string' ? args[1] : '';
    return {
      path,
      type: 'document',
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    (doc as jest.Mock).mockImplementation(createMockDocRef);
    (collection as jest.Mock).mockReturnValue({ type: 'collection' });
    (query as jest.Mock).mockReturnValue({ type: 'query' });
    (where as jest.Mock).mockReturnValue({ type: 'filter' });
    (generateBadgeQr as jest.Mock).mockReturnValue('badge-qr-123');
    (printBadge as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initial state', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      expect(result.current.status).toEqual({
        loading: false,
        error: null,
        message: null,
      });
      expect(result.current.scannedReg).toBeNull();
      expect(result.current.scannedUser).toBeNull();
    });

    it('should provide scanConfirmationQr and issueBadge functions', () => {
      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      expect(typeof result.current.scanConfirmationQr).toBe('function');
      expect(typeof result.current.issueBadge).toBe('function');
    });
  });

  describe('scanConfirmationQr - by document ID', () => {
    it('should scan registration by document ID', async () => {
      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => mockRegistration),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(mockRegId);
      });

      expect(result.current.scannedReg).toEqual(mockRegistration);
      expect(result.current.scannedUser).toEqual(mockUser);
      expect(result.current.status.loading).toBe(false);
      expect(result.current.status.error).toBeNull();
      expect(result.current.status.message).toBe('Registration Found. Ready to Issue Badge.');
    });

    it('should handle CONF- prefix correctly', async () => {
      const confPrefixedQr = `CONF-${mockRegId}`;
      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => mockRegistration),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(confPrefixedQr);
      });

      expect(result.current.scannedReg).toEqual(mockRegistration);
      expect(getDoc).toHaveBeenCalledWith(
        expect.objectContaining({
          path: `conferences/${mockConferenceId}/registrations/${mockRegId}`,
        })
      );
    });
  });

  describe('scanConfirmationQr - by confirmationQr field', () => {
    it('should scan registration by confirmationQr field when document ID not found', async () => {
      const mockNotFoundDocSnap = {
        exists: jest.fn(() => false),
      };

      const mockQuerySnap = {
        empty: false,
        docs: [
          {
            id: mockRegId,
            data: jest.fn(() => mockRegistration),
          },
        ],
      };

      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };

      (getDoc as jest.Mock).mockResolvedValueOnce(mockNotFoundDocSnap);
      (getDocs as jest.Mock).mockResolvedValueOnce(mockQuerySnap);
      (getDoc as jest.Mock).mockResolvedValueOnce(mockUserDocSnap);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr('qr-123');
      });

      expect(result.current.scannedReg).toEqual(mockRegistration);
      expect(result.current.scannedUser).toEqual(mockUser);
      expect(getDocs).toHaveBeenCalled();
    });

    it('should throw error when registration not found by confirmationQr', async () => {
      const mockNotFoundDocSnap = {
        exists: jest.fn(() => false),
      };
      const mockEmptyQuerySnap = {
        empty: true,
        docs: [],
      };
      (getDoc as jest.Mock).mockResolvedValueOnce(mockNotFoundDocSnap);
      (getDocs as jest.Mock).mockResolvedValueOnce(mockEmptyQuerySnap);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr('nonexistent-qr');
      });

      expect(result.current.status.error).toBe('등록 정보를 찾을 수 없습니다.');
      expect(result.current.scannedReg).toBeNull();
      expect(result.current.scannedUser).toBeNull();
    });
  });

  describe('scanConfirmationQr - JSON format', () => {
    it('should handle JSON QR format with CONFIRM type', async () => {
      const jsonQr = JSON.stringify({
        type: 'CONFIRM',
        regId: mockRegId,
      });

      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => mockRegistration),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(jsonQr);
      });

      expect(result.current.scannedReg).toEqual(mockRegistration);
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidJson = '{invalid-json}';

      const mockDocSnap = {
        exists: jest.fn(() => false),
      };
      const mockEmptyQuerySnap = {
        empty: true,
        docs: [],
      };
      (getDoc as jest.Mock).mockResolvedValueOnce(mockDocSnap);
      (getDocs as jest.Mock).mockResolvedValueOnce(mockEmptyQuerySnap);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(invalidJson);
      });

      expect(result.current.status.error).toBe('등록 정보를 찾을 수 없습니다.');
      expect(result.current.scannedReg).toBeNull();
      expect(result.current.scannedUser).toBeNull();
    });
  });

  describe('scanConfirmationQr - error handling', () => {
    it('should throw error for empty QR code', async () => {
      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr('');
      });

      expect(result.current.status.error).toBe('유효하지 않은 QR 코드입니다.');
      expect(result.current.scannedReg).toBeNull();
      expect(result.current.scannedUser).toBeNull();
    });

    it('should handle Firestore errors gracefully', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(mockRegId);
      });

      expect(result.current.status.error).toBe('Firestore error');
      expect(result.current.status.loading).toBe(false);
    });

    it('should set loading state during scan', async () => {
      let resolveGetDoc: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveGetDoc = resolve;
      });

      (getDoc as jest.Mock).mockReturnValue(pendingPromise);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      act(() => {
        result.current.scanConfirmationQr(mockRegId);
      });

      expect(result.current.status.loading).toBe(true);

      await act(async () => {
        resolveGetDoc!({
          exists: jest.fn(() => true),
          id: mockRegId,
          data: jest.fn(() => mockRegistration),
        });
      });

      expect(result.current.status.loading).toBe(false);
    });
  });

  describe('issueBadge - first-time issuance', () => {
    it('should issue badge for first time', async () => {
      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => mockRegistration),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      const mockInfoDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockConferenceInfo),
      };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap)
        .mockResolvedValueOnce(mockInfoDocSnap);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(mockRegId);
      });

      await act(async () => {
        await result.current.issueBadge();
      });

      expect(updateDoc).toHaveBeenCalled();
      expect(printBadge).toHaveBeenCalledWith(
        mockConferenceInfo.badgeLayout,
        expect.objectContaining({
          name: mockUser.name,
          badgeQr: 'badge-qr-123',
        })
      );

      expect(result.current.status.message).toBe('Badge Issued Successfully!');
      expect(result.current.scannedReg?.badgeQr).toBe('badge-qr-123');
      expect(result.current.scannedReg?.isCheckedIn).toBe(true);
    });

    it('should generate new badge QR when badgeQr is null', async () => {
      const registrationWithoutBadge = {
        ...mockRegistration,
        badgeQr: null,
      };

      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => registrationWithoutBadge),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      const mockInfoDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockConferenceInfo),
      };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap)
        .mockResolvedValueOnce(mockInfoDocSnap);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(mockRegId);
      });

      await act(async () => {
        await result.current.issueBadge();
      });

      expect(generateBadgeQr).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('issueBadge - reprint', () => {
    it('should reprint badge when already issued', async () => {
      const existingBadgeQr = 'existing-badge-qr';
      const registrationWithBadge = {
        ...mockRegistration,
        badgeQr: existingBadgeQr,
        isCheckedIn: true,
        checkInTime: Timestamp.now(),
      };

      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => registrationWithBadge),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      const mockInfoDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockConferenceInfo),
      };
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap)
        .mockResolvedValueOnce(mockInfoDocSnap);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(mockRegId);
      });

      await act(async () => {
        await result.current.issueBadge();
      });

      expect(generateBadgeQr).not.toHaveBeenCalled();

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          badgeQr: existingBadgeQr,
        })
      );

      expect(result.current.status.message).toBe('Badge Reprinted Successfully!');
    });

    it('should preserve original checkInTime during reprint', async () => {
      const originalCheckInTime = Timestamp.now();
      const registrationWithBadge = {
        ...mockRegistration,
        badgeQr: 'existing-badge-qr',
        isCheckedIn: true,
        checkInTime: originalCheckInTime,
      };

      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => registrationWithBadge),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      const mockInfoDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockConferenceInfo),
      };
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap)
        .mockResolvedValueOnce(mockInfoDocSnap);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(mockRegId);
      });

      await act(async () => {
        await result.current.issueBadge();
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          checkInTime: originalCheckInTime,
        })
      );
    });
  });

  describe('issueBadge - error handling', () => {
    it('should not issue badge when no registration scanned', async () => {
      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.issueBadge();
      });

      expect(updateDoc).not.toHaveBeenCalled();
      expect(printBadge).not.toHaveBeenCalled();
    });

    it('should handle Firestore update errors', async () => {
      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => mockRegistration),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      const mockInfoDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockConferenceInfo),
      };
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap)
        .mockResolvedValueOnce(mockInfoDocSnap);
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(mockRegId);
      });

      await act(async () => {
        await result.current.issueBadge();
      });

      expect(result.current.status.error).toBe('Update failed');
      expect(result.current.status.loading).toBe(false);
    });

    it('should handle missing badge layout gracefully', async () => {
      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => mockRegistration),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      const mockInfoDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({})),
      };
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap)
        .mockResolvedValueOnce(mockInfoDocSnap);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(mockRegId);
      });

      await act(async () => {
        await result.current.issueBadge();
      });

      expect(updateDoc).toHaveBeenCalled();
      expect(printBadge).not.toHaveBeenCalled();
      expect(result.current.status.message).toBe('Badge Issued Successfully!');
    });

    it('should set loading state during badge issuance', async () => {
      let resolveUpdate: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveUpdate = resolve;
      });

      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => mockRegistration),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      const mockInfoDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockConferenceInfo),
      };
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap)
        .mockResolvedValueOnce(mockInfoDocSnap);
      (updateDoc as jest.Mock).mockReturnValue(pendingPromise);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(mockRegId);
      });

      act(() => {
        result.current.issueBadge();
      });

      expect(result.current.status.loading).toBe(true);

      await act(async () => {
        resolveUpdate!(undefined);
      });

      expect(result.current.status.loading).toBe(false);
    });
  });

  describe('integration flows', () => {
    it('should complete full check-in flow: scan -> issue badge', async () => {
      const mockDocSnap = {
        exists: jest.fn(() => true),
        id: mockRegId,
        data: jest.fn(() => mockRegistration),
      };
      const mockUserDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockUser),
      };
      const mockInfoDocSnap = {
        exists: jest.fn(() => true),
        data: jest.fn(() => mockConferenceInfo),
      };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap)
        .mockResolvedValueOnce(mockUserDocSnap)
        .mockResolvedValueOnce(mockInfoDocSnap);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      await act(async () => {
        await result.current.scanConfirmationQr(mockRegId);
      });

      expect(result.current.scannedReg).toEqual(mockRegistration);
      expect(result.current.scannedUser).toEqual(mockUser);
      expect(result.current.status.message).toBe('Registration Found. Ready to Issue Badge.');

      await act(async () => {
        await result.current.issueBadge();
      });

      expect(result.current.scannedReg?.badgeQr).toBe('badge-qr-123');
      expect(result.current.scannedReg?.isCheckedIn).toBe(true);
      expect(result.current.status.message).toBe('Badge Issued Successfully!');
      expect(updateDoc).toHaveBeenCalled();
      expect(printBadge).toHaveBeenCalled();
    });

    it('should handle multiple scans in sequence', async () => {
      const { result } = renderHook(() => useCheckIn(mockConferenceId));

      const mockDocSnap1 = {
        exists: jest.fn(() => true),
        id: 'reg-1',
        data: jest.fn(() => ({ ...mockRegistration, id: 'reg-1' })),
      };
      const mockUserDocSnap1 = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({ ...mockUser, id: 'user-1' })),
      };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap1)
        .mockResolvedValueOnce(mockUserDocSnap1);

      await act(async () => {
        await result.current.scanConfirmationQr('reg-1');
      });

      expect(result.current.scannedReg?.id).toBe('reg-1');

      const mockDocSnap2 = {
        exists: jest.fn(() => true),
        id: 'reg-2',
        data: jest.fn(() => ({ ...mockRegistration, id: 'reg-2' })),
      };
      const mockUserDocSnap2 = {
        exists: jest.fn(() => true),
        data: jest.fn(() => ({ ...mockUser, id: 'user-2' })),
      };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnap2)
        .mockResolvedValueOnce(mockUserDocSnap2);

      await act(async () => {
        await result.current.scanConfirmationQr('reg-2');
      });

      expect(result.current.scannedReg?.id).toBe('reg-2');
      expect(result.current.status.message).toBe('Registration Found. Ready to Issue Badge.');
    });
  });
});
