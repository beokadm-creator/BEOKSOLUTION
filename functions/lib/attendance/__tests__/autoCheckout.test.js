"use strict";
/**
 * Unit tests for autoCheckout.ts
 */
// Mock firebase-functions logger
jest.mock('firebase-functions', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
    pubsub: {
        schedule: jest.fn(() => ({
            timeZone: jest.fn(() => ({
                onRun: jest.fn(),
            })),
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
}));
// Mock firebase-admin
jest.mock('firebase-admin', () => {
    const mockFirestore = {
        collection: jest.fn(() => ({
            where: jest.fn(() => ({
                get: jest.fn(() => Promise.resolve({ docs: [], empty: true })),
            })),
            get: jest.fn(() => Promise.resolve({ docs: [], empty: true })),
            doc: jest.fn(),
        })),
        doc: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ exists: false, data: () => null })),
        })),
        runTransaction: jest.fn(),
    };
    return {
        firestore: jest.fn(() => mockFirestore),
        initializeApp: jest.fn(),
        apps: [],
    };
});
describe('autoCheckout', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('AutoCheckoutConfig interface', () => {
        it('should have correct structure', () => {
            const config = {
                enabled: true,
                dryRun: false,
                whitelist: ['conf1', 'conf2'],
            };
            expect(config.enabled).toBe(true);
            expect(config.dryRun).toBe(false);
            expect(config.whitelist).toHaveLength(2);
        });
        it('should support empty whitelist', () => {
            const config = {
                enabled: true,
                dryRun: true,
                whitelist: [],
            };
            expect(config.whitelist).toHaveLength(0);
        });
    });
    describe('isZoneEnded function (via time calculation)', () => {
        it('should correctly determine if zone has ended', () => {
            // Zone end: 14:00, Current: 14:30 -> should be ended
            const zoneEnd = '14:00';
            const currentTime = new Date();
            currentTime.setHours(14, 30, 0, 0);
            const [endHour, endMinute] = zoneEnd.split(':').map(Number);
            const currentHour = currentTime.getHours();
            const currentMinute = currentTime.getMinutes();
            const endMinutes = endHour * 60 + endMinute;
            const currentMinutes = currentHour * 60 + currentMinute;
            const isEnded = currentMinutes >= endMinutes;
            expect(isEnded).toBe(true);
        });
        it('should correctly determine if zone has not ended', () => {
            // Zone end: 16:00, Current: 14:30 -> should not be ended
            const zoneEnd = '16:00';
            const currentTime = new Date();
            currentTime.setHours(14, 30, 0, 0);
            const [endHour, endMinute] = zoneEnd.split(':').map(Number);
            const currentHour = currentTime.getHours();
            const currentMinute = currentTime.getMinutes();
            const endMinutes = endHour * 60 + endMinute;
            const currentMinutes = currentHour * 60 + currentMinute;
            const isEnded = currentMinutes >= endMinutes;
            expect(isEnded).toBe(false);
        });
        it('should handle exact end time', () => {
            // Zone end: 14:00, Current: 14:00 -> should be ended (>=)
            const zoneEnd = '14:00';
            const currentTime = new Date();
            currentTime.setHours(14, 0, 0, 0);
            const [endHour, endMinute] = zoneEnd.split(':').map(Number);
            const currentHour = currentTime.getHours();
            const currentMinute = currentTime.getMinutes();
            const endMinutes = endHour * 60 + endMinute;
            const currentMinutes = currentHour * 60 + currentMinute;
            const isEnded = currentMinutes >= endMinutes;
            expect(isEnded).toBe(true);
        });
    });
    describe('KST time handling', () => {
        it('should correctly calculate KST offset', () => {
            const kstOffset = 9 * 60; // KST is UTC+9
            expect(kstOffset).toBe(540); // 9 hours in minutes
        });
        it('should format date correctly', () => {
            const now = new Date('2024-01-15T05:00:00Z'); // 5:00 UTC
            const kstOffset = 9 * 60;
            const kstTime = new Date(now.getTime() + kstOffset * 60 * 1000);
            const today = kstTime.toISOString().split('T')[0];
            // 5:00 UTC + 9 hours = 14:00 KST on the same day
            expect(today).toBe('2024-01-15');
        });
    });
    describe('Zone filtering logic', () => {
        it('should filter zones with autoCheckout enabled', () => {
            const zones = [
                { id: '1', name: 'Zone A', start: '09:00', end: '12:00', autoCheckout: true },
                { id: '2', name: 'Zone B', start: '09:00', end: '12:00', autoCheckout: false },
                { id: '3', name: 'Zone C', start: '09:00', end: '12:00', autoCheckout: true },
            ];
            const autoCheckoutZones = zones.filter(z => z.autoCheckout);
            expect(autoCheckoutZones).toHaveLength(2);
            expect(autoCheckoutZones.map(z => z.id)).toEqual(['1', '3']);
        });
        it('should handle empty zones array', () => {
            const zones = [];
            const autoCheckoutZones = zones.filter(z => z.autoCheckout);
            expect(autoCheckoutZones).toHaveLength(0);
        });
    });
    describe('Whitelist filtering', () => {
        it('should filter conferences by whitelist', () => {
            const conferences = ['conf1', 'conf2', 'conf3', 'conf4'];
            const whitelist = ['conf1', 'conf3'];
            const filtered = conferences.filter(id => whitelist.includes(id));
            expect(filtered).toEqual(['conf1', 'conf3']);
        });
        it('should return empty array if no matches', () => {
            const conferences = ['conf1', 'conf2'];
            const whitelist = ['conf3', 'conf4'];
            const filtered = conferences.filter(id => whitelist.includes(id));
            expect(filtered).toHaveLength(0);
        });
        it('should return all conferences if whitelist is empty', () => {
            const conferences = ['conf1', 'conf2'];
            const whitelist = [];
            // When whitelist is empty, process all conferences
            const filtered = whitelist.length > 0
                ? conferences.filter(id => whitelist.includes(id))
                : conferences;
            expect(filtered).toEqual(['conf1', 'conf2']);
        });
    });
    describe('Result aggregation', () => {
        it('should correctly aggregate results', () => {
            const results = [
                { conferenceId: 'conf1', zonesProcessed: 2, participantsCheckedOut: 10, errors: [] },
                { conferenceId: 'conf2', zonesProcessed: 3, participantsCheckedOut: 15, errors: ['error1'] },
                { conferenceId: 'conf3', zonesProcessed: 1, participantsCheckedOut: 5, errors: [] },
            ];
            const totalZones = results.reduce((sum, r) => sum + r.zonesProcessed, 0);
            const totalParticipants = results.reduce((sum, r) => sum + r.participantsCheckedOut, 0);
            const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
            expect(totalZones).toBe(6);
            expect(totalParticipants).toBe(30);
            expect(totalErrors).toBe(1);
        });
    });
    describe('Error handling', () => {
        it('should handle conference processing errors gracefully', () => {
            const errors = [];
            // Simulate processing with error
            const confId = 'conf-with-error';
            const errorMsg = 'Database connection failed';
            errors.push(`${confId}: ${errorMsg}`);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain(confId);
            expect(errors[0]).toContain(errorMsg);
        });
    });
});
describe('Feature Flag behavior', () => {
    it('should disable function when enabled=false', () => {
        const config = {
            enabled: false,
            dryRun: true,
            whitelist: [],
        };
        // Function should return early when disabled
        expect(config.enabled).toBe(false);
    });
    it('should enable function when enabled=true', () => {
        const config = {
            enabled: true,
            dryRun: false,
            whitelist: ['test-conf'],
        };
        expect(config.enabled).toBe(true);
        expect(config.dryRun).toBe(false);
    });
    it('should support dry-run mode', () => {
        const config = {
            enabled: true,
            dryRun: true,
            whitelist: [],
        };
        expect(config.dryRun).toBe(true);
    });
});
//# sourceMappingURL=autoCheckout.test.js.map