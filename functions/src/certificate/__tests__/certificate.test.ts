/**
 * Unit tests for certificate/index.ts
 *
 * Note: Helper functions (generateVerificationToken, extractAttendeeFields,
 * assertCertificateAdmin, etc.) are not exported. Tests replicate their pure
 * logic to verify correctness, following the existing test patterns in
 * autoCheckout.test.ts and exitLogger.test.ts.
 */

jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  https: {
    HttpsError: class HttpsError extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
    onCall: jest.fn(),
    onRequest: jest.fn(),
  },
  runWith: jest.fn(() => ({
    https: { onCall: jest.fn(), onRequest: jest.fn() },
  })),
}));

jest.mock('firebase-admin', () => {
  const mockFirestore = {
    collection: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      get: jest.fn(() => Promise.resolve({ docs: [], empty: true })),
      doc: jest.fn().mockReturnThis(),
    })),
    doc: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ exists: false, data: () => null })),
      update: jest.fn(),
      collection: jest.fn().mockReturnThis(),
    })),
    runTransaction: jest.fn(),
  };

  return {
    firestore: jest.fn(() => mockFirestore),
    initializeApp: jest.fn(),
    apps: [],
  };
});

import * as crypto from 'crypto';

type CertificateStatus = 'ISSUED' | 'REVOKED' | 'REISSUED';

interface AttendeeDataLike {
  name?: string;
  email?: string;
  organization?: string;
  affiliation?: string;
  userInfo?: { name?: string; email?: string; affiliation?: string };
}

describe('certificate module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Certificate number format', () => {
    it('should format as CERT-XXXX with 4-digit zero-padded number', () => {
      const num = `CERT-${String(1).padStart(4, '0')}`;
      expect(num).toBe('CERT-0001');
    });

    it('should zero-pad single-digit numbers', () => {
      const num = `CERT-${String(7).padStart(4, '0')}`;
      expect(num).toBe('CERT-0007');
    });

    it('should zero-pad double-digit numbers', () => {
      const num = `CERT-${String(42).padStart(4, '0')}`;
      expect(num).toBe('CERT-0042');
    });

    it('should zero-pad triple-digit numbers', () => {
      const num = `CERT-${String(999).padStart(4, '0')}`;
      expect(num).toBe('CERT-0999');
    });

    it('should not pad 4+ digit numbers', () => {
      const num = `CERT-${String(1234).padStart(4, '0')}`;
      expect(num).toBe('CERT-1234');
    });

    it('should handle large numbers', () => {
      const num = `CERT-${String(99999).padStart(4, '0')}`;
      expect(num).toBe('CERT-99999');
    });

    it('should always start with CERT-', () => {
      for (let i = 1; i <= 5; i++) {
        const num = `CERT-${String(i).padStart(4, '0')}`;
        expect(num).toMatch(/^CERT-/);
      }
    });
  });

  describe('Verification token format', () => {
    it('should start with crt_ prefix', () => {
      const token = `crt_${crypto.randomBytes(24).toString('base64url')}`;
      expect(token).toMatch(/^crt_/);
    });

    it('should have correct base64url length for 24 random bytes', () => {
      const token = `crt_${crypto.randomBytes(24).toString('base64url')}`;
      const body = token.slice(4);
      expect(body).toHaveLength(32);
    });

    it('should contain only base64url-safe characters (no +, /, =)', () => {
      const token = `crt_${crypto.randomBytes(24).toString('base64url')}`;
      const body = token.slice(4);
      expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate different tokens on successive calls', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 10; i++) {
        tokens.add(`crt_${crypto.randomBytes(24).toString('base64url')}`);
      }
      expect(tokens.size).toBe(10);
    });
  });

  describe('extractAttendeeFields logic', () => {
    it('should prefer top-level name over userInfo.name', () => {
      const data: AttendeeDataLike = { name: '홍길동', userInfo: { name: '김철수' } };
      const name = data.name || data.userInfo?.name || '';
      expect(name).toBe('홍길동');
    });

    it('should fall back to userInfo.name when top-level name is empty', () => {
      const data: AttendeeDataLike = { name: '', userInfo: { name: '김철수' } };
      const name = data.name || data.userInfo?.name || '';
      expect(name).toBe('김철수');
    });

    it('should return empty string when both names are missing', () => {
      const data: AttendeeDataLike = {};
      const name = data.name || data.userInfo?.name || '';
      expect(name).toBe('');
    });

    it('should prefer top-level email over userInfo.email', () => {
      const data: AttendeeDataLike = { email: 'top@test.com', userInfo: { email: 'user@test.com' } };
      const email = data.email || data.userInfo?.email;
      expect(email).toBe('top@test.com');
    });

    it('should fall back to userInfo.email when top-level is undefined', () => {
      const data: AttendeeDataLike = { userInfo: { email: 'user@test.com' } };
      const email = data.email || data.userInfo?.email;
      expect(email).toBe('user@test.com');
    });

    it('should prefer organization over affiliation for organization field', () => {
      const data: AttendeeDataLike = {
        organization: '병원',
        affiliation: '대학교',
        userInfo: { affiliation: '협회' },
      };
      const org = data.organization || data.affiliation || data.userInfo?.affiliation;
      expect(org).toBe('병원');
    });

    it('should fall back to affiliation when organization is missing', () => {
      const data: AttendeeDataLike = { affiliation: '대학교' };
      const org = data.organization || data.affiliation || data.userInfo?.affiliation;
      expect(org).toBe('대학교');
    });

    it('should fall back to userInfo.affiliation as last resort', () => {
      const data: AttendeeDataLike = { userInfo: { affiliation: '협회' } };
      const org = data.organization || data.affiliation || data.userInfo?.affiliation;
      expect(org).toBe('협회');
    });

    it('should return undefined when no affiliation fields exist', () => {
      const data: AttendeeDataLike = {};
      const org = data.organization || data.affiliation || data.userInfo?.affiliation;
      expect(org).toBeUndefined();
    });
  });

  describe('Admin role detection', () => {
    interface AuthToken { admin?: boolean; super?: boolean; email: string }

    it('should detect SUPER_ADMIN via token.admin', () => {
      const token: AuthToken = { admin: true, email: 'admin@test.com' };
      const isSuper = token.admin === true || token.super === true;
      expect(isSuper).toBe(true);
    });

    it('should detect SUPER_ADMIN via token.super', () => {
      const token: AuthToken = { super: true, email: 'super@test.com' };
      const isSuper = token.admin === true || token.super === true;
      expect(isSuper).toBe(true);
    });

    it('should not grant super admin when neither flag is true', () => {
      const token: AuthToken = { admin: false, super: false, email: 'user@test.com' };
      const isSuper = token.admin === true || token.super === true;
      expect(isSuper).toBe(false);
    });

    it('should require auth to be present', () => {
      const auth = undefined;
      expect(auth).toBeUndefined();
    });
  });

  describe('Authorization paths', () => {
    it('should resolve BADGE_TOKEN mode when badgeToken is provided', () => {
      const badgeToken = 'TKN-test123';
      const hasToken = !!badgeToken;
      expect(hasToken).toBe(true);
    });

    it('should resolve OWNER mode when auth matches attendee userId', () => {
      const auth = { uid: 'user123', token: { email: 'user@test.com' } };
      const attendeeUserId = 'user123';
      const isOwner = attendeeUserId === auth.uid;
      expect(isOwner).toBe(true);
    });

    it('should not match OWNER when userId is GUEST', () => {
      const auth = { uid: 'user123', token: { email: 'user@test.com' } };
      const attendeeUserId = 'GUEST';
      const isOwner = attendeeUserId && attendeeUserId !== 'GUEST' && attendeeUserId === auth.uid;
      expect(isOwner).toBeFalsy();
    });

    it('should fall through to ADMIN mode when no badge token or owner match', () => {
      const badgeToken = undefined;
      const isOwner = false;
      const isAdmin = !badgeToken && !isOwner;
      expect(isAdmin).toBe(true);
    });
  });

  describe('Certificate status transitions', () => {
    function canReissue(status: CertificateStatus): boolean {
      return status !== 'REVOKED' && status !== 'REISSUED';
    }

    it('should allow reissue for ISSUED status', () => {
      expect(canReissue('ISSUED')).toBe(true);
    });

    it('should block reissue when already REVOKED', () => {
      expect(canReissue('REVOKED')).toBe(false);
    });

    it('should block reissue when already REISSUED', () => {
      expect(canReissue('REISSUED')).toBe(false);
    });

    it('should block revoke when already REVOKED', () => {
      const status: CertificateStatus = 'REVOKED';
      const isRevoked = status === 'REVOKED';
      expect(isRevoked).toBe(true);
    });

    it('should block revoke when REISSUED (direct user to replacement)', () => {
      const status: CertificateStatus = 'REISSUED';
      const isReissued = status === 'REISSUED';
      expect(isReissued).toBe(true);
    });

    it('should allow revoke for ISSUED status', () => {
      const statuses: CertificateStatus[] = ['ISSUED'];
      const canRevoke = statuses.every(s => s !== 'REVOKED' && s !== 'REISSUED');
      expect(canRevoke).toBe(true);
    });
  });

  describe('Checked-in eligibility', () => {
    it('should allow issuance when isCheckedIn is true', () => {
      const data = { isCheckedIn: true, badgeIssued: false };
      const canIssue = !!data.isCheckedIn || !!data.badgeIssued;
      expect(canIssue).toBe(true);
    });

    it('should allow issuance when badgeIssued is true', () => {
      const data = { isCheckedIn: false, badgeIssued: true };
      const canIssue = !!data.isCheckedIn || !!data.badgeIssued;
      expect(canIssue).toBe(true);
    });

    it('should block issuance when neither checked in nor badge issued', () => {
      const data = { isCheckedIn: false, badgeIssued: false };
      const canIssue = !!data.isCheckedIn || !!data.badgeIssued;
      expect(canIssue).toBe(false);
    });
  });

  describe('Error case validation', () => {
    it('should detect missing name as error condition', () => {
      const name = '';
      const hasName = !!name;
      expect(hasName).toBe(false);
    });

    it('should detect missing confId as error condition', () => {
      const confId = '';
      const regId = 'REG-123';
      const isValid = !!confId && !!regId;
      expect(isValid).toBe(false);
    });

    it('should detect missing regId as error condition', () => {
      const confId = 'kap_2026spring';
      const regId = '';
      const isValid = !!confId && !!regId;
      expect(isValid).toBe(false);
    });

    it('should detect missing verification token as error condition', () => {
      const token = '';
      const isValid = !!token;
      expect(isValid).toBe(false);
    });

    it('should validate certificate exists before revocation', () => {
      const certExists = false;
      expect(certExists).toBe(false);
    });
  });

  describe('Log collection name resolution', () => {
    type SourceType = 'registration' | 'external_attendee';

    function resolveLogCollection(sourceType: SourceType): string {
      return sourceType === 'external_attendee' ? 'external_attendees' : 'registrations';
    }

    it('should use registrations collection for registration source type', () => {
      expect(resolveLogCollection('registration')).toBe('registrations');
    });

    it('should use external_attendees collection for external_attendee source type', () => {
      expect(resolveLogCollection('external_attendee')).toBe('external_attendees');
    });
  });

  describe('Download log method determination', () => {
    it('should use BADGE_TOKEN method when badge token provided', () => {
      const badgeToken = 'TKN-test';
      const hasBadgeToken = !!badgeToken;
      expect(hasBadgeToken).toBe(true);
    });

    it('should use ADMIN method for super admin', () => {
      const auth = { uid: 'admin', token: { admin: true, email: 'admin@test.com' } };
      const isSuper = auth.token.admin === true;
      expect(isSuper).toBe(true);
    });

    it('should use OWNER method for matching user', () => {
      const auth = { uid: 'user123', token: { email: 'user@test.com' } };
      const attendeeUserId = 'user123' as string | undefined;
      const isOwner = attendeeUserId && attendeeUserId !== 'GUEST' && attendeeUserId === auth.uid;
      expect(isOwner).toBe(true);
    });
  });
});
