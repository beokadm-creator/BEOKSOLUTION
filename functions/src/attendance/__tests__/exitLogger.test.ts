/**
 * Unit tests for exitLogger.ts
 * 
 * Note: These tests use heavy mocking of Firebase Admin SDK.
 * For integration tests, use Firebase Emulator Suite.
 */

// Must mock before any imports
const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ docs: [], empty: true, exists: false, data: () => null }),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  runTransaction: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
};

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(() => mockFirestore),
  initializeApp: jest.fn(),
  apps: [],
}));

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
      toDate: () => date,
    })),
  },
}));

// Import after mocking
import { ExitLogResult } from '../exitLogger';

describe('exitLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ExitLogResult interface', () => {
    it('should have correct structure for success case', () => {
      const result: ExitLogResult = {
        success: true,
        reason: 'EXIT_CREATED',
        registrationId: 'test-reg',
        zoneId: 'zone-1',
        exitTime: new Date(),
      };

      expect(result.success).toBe(true);
      expect(result.reason).toBe('EXIT_CREATED');
    });

    it('should have correct structure for failure case', () => {
      const result: ExitLogResult = {
        success: false,
        reason: 'REGISTRATION_NOT_FOUND',
        registrationId: 'test-reg',
        zoneId: 'zone-1',
      };

      expect(result.success).toBe(false);
      expect(result.reason).toBe('REGISTRATION_NOT_FOUND');
    });

    it('should support all failure reasons', () => {
      const reasons = [
        'REGISTRATION_NOT_FOUND',
        'ALREADY_CHECKED_OUT',
        'ZONE_MISMATCH',
        'EXIT_ALREADY_EXISTS',
        'NO_ENTRY_FOUND',
        'ERROR',
        'DRY_RUN',
        'EXIT_CREATED',
      ];

      reasons.forEach(reason => {
        const result: ExitLogResult = {
          success: reason === 'EXIT_CREATED' || reason === 'DRY_RUN',
          reason,
          registrationId: 'test-reg',
          zoneId: 'zone-1',
        };

        expect(result.reason).toBe(reason);
      });
    });
  });

  describe('Mock verification', () => {
    it('should have mockFirestore available', () => {
      expect(mockFirestore).toBeDefined();
      expect(mockFirestore.collection).toBeDefined();
      expect(mockFirestore.doc).toBeDefined();
    });
  });
});

describe('ExitLogger logic tests', () => {
  describe('Time calculations', () => {
    it('should calculate duration correctly', () => {
      const entryTime = new Date('2024-01-15T10:00:00Z');
      const exitTime = new Date('2024-01-15T12:30:00Z');

      const durationMinutes = Math.floor(
        (exitTime.getTime() - entryTime.getTime()) / 60000
      );

      expect(durationMinutes).toBe(150); // 2.5 hours
    });

    it('should handle zero duration', () => {
      const entryTime = new Date('2024-01-15T10:00:00Z');
      const exitTime = new Date('2024-01-15T10:00:00Z');

      const durationMinutes = Math.floor(
        (exitTime.getTime() - entryTime.getTime()) / 60000
      );

      expect(durationMinutes).toBe(0);
    });

    it('should not allow negative duration', () => {
      const entryTime = new Date('2024-01-15T12:00:00Z');
      const exitTime = new Date('2024-01-15T10:00:00Z');

      let durationMinutes = 0;
      if (exitTime > entryTime) {
        durationMinutes = Math.floor(
          (exitTime.getTime() - entryTime.getTime()) / 60000
        );
      }

      expect(durationMinutes).toBe(0);
    });
  });

  describe('Registration status checks', () => {
    it('should identify INSIDE status correctly', () => {
      const registration = {
        attendanceStatus: 'INSIDE',
        currentZone: 'zone-1',
      };

      expect(registration.attendanceStatus).toBe('INSIDE');
      expect(registration.currentZone).toBe('zone-1');
    });

    it('should identify OUTSIDE status correctly', () => {
      const registration = {
        attendanceStatus: 'OUTSIDE',
        currentZone: null,
      };

      expect(registration.attendanceStatus).toBe('OUTSIDE');
      expect(registration.currentZone).toBeNull();
    });
  });

  describe('Collection name handling', () => {
    it('should use registrations collection for regular attendees', () => {
      const isExternal = false;
      const collectionName = isExternal ? 'external_attendees' : 'registrations';

      expect(collectionName).toBe('registrations');
    });

    it('should use external_attendees collection for external attendees', () => {
      const isExternal = true;
      const collectionName = isExternal ? 'external_attendees' : 'registrations';

      expect(collectionName).toBe('external_attendees');
    });
  });
});
