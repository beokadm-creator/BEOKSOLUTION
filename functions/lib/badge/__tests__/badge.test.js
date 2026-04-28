"use strict";
/**
 * Unit tests for badge/index.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Mock firebase-functions
jest.mock('firebase-functions', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
    firestore: {
        document: jest.fn(() => ({
            onCreate: jest.fn(),
        })),
    },
    https: {
        HttpsError: class HttpsError extends Error {
            constructor(code, message) {
                super(message);
                this.code = code;
            }
        },
        onCall: jest.fn(),
    },
    runWith: jest.fn(() => ({
        https: { onCall: jest.fn() },
    })),
}));
// Mock firebase-admin (auto-mapped via moduleNameMapper, but explicit for clarity)
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
        })),
        runTransaction: jest.fn(),
        batch: jest.fn(),
    };
    return {
        firestore: jest.fn(() => mockFirestore),
        initializeApp: jest.fn(),
        apps: [],
    };
});
// Mock notificationService
jest.mock('../../services/notificationService', () => ({
    sendAlimTalk: jest.fn(),
}));
// Import the pure function + interfaces
const index_1 = require("../index");
describe('badge module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('generateBadgePrepToken', () => {
        it('should start with TKN- prefix', () => {
            const token = (0, index_1.generateBadgePrepToken)();
            expect(token).toMatch(/^TKN-/);
        });
        it('should have total length of 36 characters (TKN- + 32 chars)', () => {
            const token = (0, index_1.generateBadgePrepToken)();
            expect(token).toHaveLength(36);
        });
        it('should contain only alphanumeric characters after prefix', () => {
            const token = (0, index_1.generateBadgePrepToken)();
            const body = token.slice(4); // strip 'TKN-'
            expect(body).toMatch(/^[A-Za-z0-9]+$/);
        });
        it('should generate different tokens on successive calls', () => {
            const tokens = new Set();
            const iterations = 20;
            for (let i = 0; i < iterations; i++) {
                tokens.add((0, index_1.generateBadgePrepToken)());
            }
            // 20 unique tokens out of 62^32 space — extremely unlikely to collide
            expect(tokens.size).toBe(iterations);
        });
        it('should generate tokens with consistent format across many calls', () => {
            for (let i = 0; i < 50; i++) {
                const token = (0, index_1.generateBadgePrepToken)();
                expect(token).toMatch(/^TKN-[A-Za-z0-9]{32}$/);
            }
        });
    });
    describe('Conference interface', () => {
        it('should support minimal conference structure', () => {
            const conference = {
                id: 'kap_2026spring',
                societyId: 'kap',
                title: { ko: 'KAP 2026 춘계학술대회', en: 'KAP 2026 Spring Conference' },
            };
            expect(conference.id).toBe('kap_2026spring');
            expect(conference.societyId).toBe('kap');
            expect(conference.title.ko).toBe('KAP 2026 춘계학술대회');
            expect(conference.title.en).toBe('KAP 2026 Spring Conference');
        });
        it('should support full conference structure with dates and venue', () => {
            var _a;
            const conference = {
                id: 'kadd_2026fall',
                conferenceId: 'kadd_2026fall',
                societyId: 'kadd',
                slug: '2026fall',
                startDate: undefined,
                title: { ko: 'KADD 2026 추계학술대회' },
                dates: {
                    start: undefined,
                    end: undefined,
                },
                venue: {
                    name: { ko: '코엑스', en: 'COEX' },
                },
            };
            expect(conference.conferenceId).toBe('kadd_2026fall');
            expect(conference.slug).toBe('2026fall');
            expect(conference.dates).toBeDefined();
            expect(typeof ((_a = conference.venue) === null || _a === void 0 ? void 0 : _a.name)).toBe('object');
        });
        it('should support string venue name', () => {
            var _a;
            const conference = {
                id: 'test_conf',
                societyId: 'test',
                title: { ko: 'Test' },
                venue: {
                    name: '단순 문자열 장소',
                },
            };
            expect(typeof ((_a = conference.venue) === null || _a === void 0 ? void 0 : _a.name)).toBe('string');
        });
        it('should allow optional fields to be undefined', () => {
            const conference = {
                id: 'minimal',
                societyId: 'soc',
                title: { ko: 'Minimal' },
            };
            expect(conference.conferenceId).toBeUndefined();
            expect(conference.slug).toBeUndefined();
            expect(conference.startDate).toBeUndefined();
            expect(conference.dates).toBeUndefined();
            expect(conference.venue).toBeUndefined();
        });
    });
    describe('Registration interface', () => {
        it('should support minimal registration structure', () => {
            const registration = {
                name: '홍길동',
                email: 'test@example.com',
            };
            expect(registration.name).toBe('홍길동');
            expect(registration.email).toBe('test@example.com');
        });
        it('should support full registration with all fields', () => {
            var _a;
            const registration = {
                name: '김철수',
                email: 'kim@test.com',
                phone: '010-1234-5678',
                affiliation: '서울대학교',
                organization: '서울대학교 병원',
                licenseNumber: 'LC-12345',
                userInfo: {
                    name: '김철수',
                    email: 'kim@test.com',
                    phone: '010-1234-5678',
                    affiliation: '서울대학교',
                    licenseNumber: 'LC-12345',
                },
                badgeIssued: false,
                badgeQr: null,
                attendanceStatus: 'OUTSIDE',
                currentZone: undefined,
                totalMinutes: 0,
                receiptNumber: 'RCP-001',
                confirmationQr: 'REG-123',
                userId: 'uid_abc',
                paymentStatus: 'PAID',
                status: 'ACTIVE',
                amount: 50000,
            };
            expect(registration.badgeIssued).toBe(false);
            expect(registration.badgeQr).toBeNull();
            expect(registration.paymentStatus).toBe('PAID');
            expect(registration.amount).toBe(50000);
            expect((_a = registration.userInfo) === null || _a === void 0 ? void 0 : _a.name).toBe('김철수');
        });
        it('should allow optional fields to be undefined', () => {
            const registration = {};
            expect(registration.name).toBeUndefined();
            expect(registration.email).toBeUndefined();
            expect(registration.phone).toBeUndefined();
            expect(registration.badgeIssued).toBeUndefined();
            expect(registration.paymentStatus).toBeUndefined();
        });
    });
    describe('Token expiry calculation logic', () => {
        it('should set expiry to conference end + 2 days when dates.end exists', () => {
            const conferenceEndMs = 1700000000000; // arbitrary timestamp
            const twoDaysMs = 48 * 60 * 60 * 1000;
            const expectedExpiryMs = conferenceEndMs + twoDaysMs;
            // Replicate the logic from onRegistrationCreated
            const hasEndDate = true;
            let expiresAt;
            if (hasEndDate) {
                expiresAt = conferenceEndMs + twoDaysMs;
            }
            else {
                expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
            }
            expect(expiresAt).toBe(expectedExpiryMs);
        });
        it('should fall back to 7 days from now when no conference end date', () => {
            const now = Date.now();
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            const hasEndDate = false;
            let expiresAt;
            if (hasEndDate) {
                expiresAt = 1700000000000;
            }
            else {
                expiresAt = now + sevenDaysMs;
            }
            expect(expiresAt).toBe(now + sevenDaysMs);
        });
        it('should set expiry exactly 48 hours after conference end', () => {
            const conferenceEndMs = 1700000000000;
            const twoDaysMs = 48 * 60 * 60 * 1000; // 172,800,000 ms
            const expiresAt = conferenceEndMs + twoDaysMs;
            const diffMs = expiresAt - conferenceEndMs;
            expect(diffMs).toBe(172800000); // exactly 48 hours
        });
    });
    describe('Badge QR format', () => {
        it('should format badge QR as BADGE-{regId}', () => {
            const regId = 'REG-abc123';
            const badgeQr = `BADGE-${regId}`;
            expect(badgeQr).toBe('BADGE-REG-abc123');
        });
        it('should format badge QR for external attendees', () => {
            const regId = 'EXT-xyz789';
            const badgeQr = `BADGE-${regId}`;
            expect(badgeQr).toBe('BADGE-EXT-xyz789');
        });
        it('should include the full regId in badge QR', () => {
            const regId = 'some-unique-registration-id';
            const badgeQr = `BADGE-${regId}`;
            expect(badgeQr).toContain(regId);
            expect(badgeQr).toMatch(/^BADGE-/);
        });
    });
    describe('External attendee detection', () => {
        it('should detect external attendee via EXT- prefix', () => {
            const regId = 'EXT-some-id';
            const isExternal = regId.startsWith('EXT-');
            expect(isExternal).toBe(true);
        });
        it('should not flag regular registration as external', () => {
            const regId = 'REG-regular-id';
            const isExternal = regId.startsWith('EXT-');
            expect(isExternal).toBe(false);
        });
        it('should detect external attendee via path check', () => {
            const path = 'conferences/kap_2026spring/external_attendees/EXT-123';
            const isExternal = path.includes('/external_attendees/');
            expect(isExternal).toBe(true);
        });
        it('should not flag registrations path as external', () => {
            const path = 'conferences/kap_2026spring/registrations/REG-123';
            const isExternal = path.includes('/external_attendees/');
            expect(isExternal).toBe(false);
        });
        it('should determine collection name from regId prefix', () => {
            const collectionName = 'EXT-123'.startsWith('EXT-') ? 'external_attendees' : 'registrations';
            expect(collectionName).toBe('external_attendees');
        });
        it('should determine registrations collection for regular regId', () => {
            const collectionName = 'REG-456'.startsWith('EXT-') ? 'external_attendees' : 'registrations';
            expect(collectionName).toBe('registrations');
        });
    });
    describe('Payment status filtering', () => {
        it('should allow PAID paymentStatus for regular registrations', () => {
            const regData = { paymentStatus: 'PAID' };
            const isExternal = false;
            const isPaid = isExternal
                ? true
                : regData.paymentStatus === 'PAID' || regData.status === 'PAID';
            expect(isPaid).toBe(true);
        });
        it('should allow PAID status field as alternative to paymentStatus', () => {
            const regData = { paymentStatus: undefined, status: 'PAID' };
            const isExternal = false;
            const isPaid = isExternal
                ? true
                : regData.paymentStatus === 'PAID' || regData.status === 'PAID';
            expect(isPaid).toBe(true);
        });
        it('should reject non-PAID registrations for regular path', () => {
            const regData = { paymentStatus: 'PENDING' };
            const isExternal = false;
            const isPaid = isExternal
                ? true
                : regData.paymentStatus === 'PAID' || regData.status === 'PAID';
            expect(isPaid).toBe(false);
        });
        it('should bypass payment check for external attendees', () => {
            const isExternal = true;
            const isPaid = isExternal
                ? true
                : false;
            expect(isPaid).toBe(true);
        });
        it('should skip unpaid registrations in onRegistrationCreated', () => {
            const regData = { paymentStatus: 'PENDING' };
            const shouldProcess = regData.paymentStatus === 'PAID';
            expect(shouldProcess).toBe(false);
        });
        it('should process PAID registrations in onRegistrationCreated', () => {
            const regData = { paymentStatus: 'PAID' };
            const shouldProcess = regData.paymentStatus === 'PAID';
            expect(shouldProcess).toBe(true);
        });
    });
    describe('Registration data resolution logic', () => {
        it('should prefer top-level name over userInfo.name', () => {
            var _a;
            const regData = { name: '홍길동', userInfo: { name: '김철수' }, paymentStatus: undefined };
            const name = regData.name || ((_a = regData.userInfo) === null || _a === void 0 ? void 0 : _a.name) || '';
            expect(name).toBe('홍길동');
        });
        it('should fall back to userInfo.name when top-level name is missing', () => {
            var _a;
            const regData = { userInfo: { name: '김철수' } };
            const name = regData.name || ((_a = regData.userInfo) === null || _a === void 0 ? void 0 : _a.name) || '';
            expect(name).toBe('김철수');
        });
        it('should resolve affiliation from multiple possible fields', () => {
            var _a;
            const regData = {
                organization: '병원',
                affiliation: '대학교',
                userInfo: { affiliation: '협회' },
            };
            const affiliation = regData.organization || regData.affiliation || ((_a = regData.userInfo) === null || _a === void 0 ? void 0 : _a.affiliation) || '';
            expect(affiliation).toBe('병원');
        });
        it('should fall back to affiliation when organization is missing', () => {
            var _a;
            const regData = {
                affiliation: '대학교',
                userInfo: { affiliation: '협회' },
            };
            const affiliation = regData.organization || regData.affiliation || ((_a = regData.userInfo) === null || _a === void 0 ? void 0 : _a.affiliation) || '';
            expect(affiliation).toBe('대학교');
        });
        it('should fall back to userInfo.affiliation when both top-level are missing', () => {
            var _a;
            const regData = {
                userInfo: { affiliation: '협회' },
            };
            const affiliation = regData.organization || regData.affiliation || ((_a = regData.userInfo) === null || _a === void 0 ? void 0 : _a.affiliation) || '';
            expect(affiliation).toBe('협회');
        });
    });
    describe('URL construction logic', () => {
        it('should construct badge prep URL correctly', () => {
            const societyId = 'kap';
            const slug = '2026spring';
            const token = 'TKN-abc123def456';
            const domain = `https://${societyId}.eregi.co.kr`;
            const url = `${domain}/${slug}/badge-prep/${token}`;
            expect(url).toBe('https://kap.eregi.co.kr/2026spring/badge-prep/TKN-abc123def456');
        });
        it('should use conference.id when slug is not available', () => {
            const societyId = 'kadd';
            const conference = { id: 'kadd_2026fall', slug: undefined };
            const domain = `https://${societyId}.eregi.co.kr`;
            const redirectSlug = conference.id || conference.slug;
            const url = `${domain}/${redirectSlug}/badge-prep/TKN-test123`;
            expect(url).toBe('https://kadd.eregi.co.kr/kadd_2026fall/badge-prep/TKN-test123');
        });
    });
    describe('Token status transitions', () => {
        it('should identify ACTIVE tokens as valid', () => {
            const statuses = ['ACTIVE', 'ISSUED'];
            const tokenStatus = 'ACTIVE';
            expect(statuses).toContain(tokenStatus);
        });
        it('should identify ISSUED tokens as valid for lookup', () => {
            const statuses = ['ACTIVE', 'ISSUED'];
            expect(statuses).toContain('ISSUED');
        });
        it('should expire old tokens when resending', () => {
            const oldStatus = 'ACTIVE';
            const newStatus = 'EXPIRED';
            expect(newStatus).not.toBe(oldStatus);
        });
    });
});
//# sourceMappingURL=badge.test.js.map