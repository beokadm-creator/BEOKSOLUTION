"use strict";
/**
 * Auto Checkout Scheduler - Scheduled Cloud Function for automatic participant checkout
 *
 * This function runs every 60 minutes and:
 * 1. Checks all active conferences
 * 2. For each conference with autoCheckout enabled zones
 * 3. Finds participants still checked in after zone end time
 * 4. Creates EXIT logs for those participants
 *
 * Features:
 * - Feature Flag controlled (enabled/dry-run/whitelist)
 * - Graceful error handling (one conference failure doesn't stop others)
 * - Comprehensive logging for monitoring
 * - Dry-run mode for safe testing
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualAutoCheckout = exports.scheduledAutoCheckout = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const exitLogger_1 = require("./exitLogger");
// Custom logger with context
const logger = functions.logger;
// Get Firestore instance - called inside functions to ensure initialization
const getDb = () => admin.firestore();
/**
 * Gets feature flag configuration from Firestore
 *
 * In production, this should use Firebase Remote Config.
 * For now, we use a Firestore document for easier management.
 */
async function getAutoCheckoutConfig() {
    var _a, _b;
    try {
        const db = getDb();
        const configDoc = await db
            .collection('settings')
            .doc('auto_checkout')
            .get();
        if (!configDoc.exists) {
            return {
                enabled: true,
                dryRun: false,
                whitelist: [],
            };
        }
        const data = configDoc.data() || {};
        return {
            enabled: (_a = data.enabled) !== null && _a !== void 0 ? _a : true,
            dryRun: (_b = data.dry_run) !== null && _b !== void 0 ? _b : false,
            whitelist: Array.isArray(data.whitelist) ? data.whitelist : [],
        };
    }
    catch (error) {
        logger.error('[AutoCheckout] Failed to get config:', error);
        return {
            enabled: true,
            dryRun: false,
            whitelist: [],
        };
    }
}
/**
 * Gets attendance rules for a specific date
 */
async function getAttendanceRules(confId, date) {
    var _a;
    try {
        const db = getDb();
        const rulesDoc = await db
            .doc(`conferences/${confId}/settings/attendance`)
            .get();
        if (!rulesDoc.exists) {
            return null;
        }
        const allRules = ((_a = rulesDoc.data()) === null || _a === void 0 ? void 0 : _a.rules) || {};
        return allRules[date] || null;
    }
    catch (error) {
        logger.error(`[AutoCheckout] Failed to get rules for ${confId}:`, error);
        return null;
    }
}
/**
 * Gets all active conferences with their data (for end date checking)
 */
async function getActiveConferences() {
    try {
        const db = getDb();
        const snapshot = await db
            .collection('conferences')
            .where('status', '==', 'active')
            .get();
        return snapshot.docs;
    }
    catch (error) {
        logger.error('[AutoCheckout] Failed to get active conferences:', error);
        return [];
    }
}
/**
 * Extracts end date string (YYYY-MM-DD) from a conference document snapshot.
 * Returns null if no valid end date found.
 */
function getConferenceEndDateStr(confData) {
    const endDate = confData.endDate;
    if (!endDate)
        return null;
    if (endDate && typeof endDate === 'object' && 'toDate' in endDate) {
        return endDate.toDate().toISOString().split('T')[0];
    }
    if (typeof endDate === 'string') {
        return endDate;
    }
    return null;
}
/**
 * Returns today's date in KST as YYYY-MM-DD string.
 */
function getKstToday(now = new Date()) {
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstTime = new Date(now.getTime() + kstOffset);
    return kstTime.toISOString().split('T')[0];
}
/**
 * Checks if a zone has ended (current time >= zone end time)
 */
function isZoneEnded(zoneEnd, currentTime) {
    const [endHour, endMinute] = zoneEnd.split(':').map(Number);
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const endMinutes = endHour * 60 + endMinute;
    const currentMinutes = currentHour * 60 + currentMinute;
    return currentMinutes >= endMinutes;
}
/**
 * Processes auto checkout for a single conference
 */
async function processConferenceAutoCheckout(confId, config) {
    const result = {
        conferenceId: confId,
        zonesProcessed: 0,
        participantsCheckedOut: 0,
        errors: [],
    };
    try {
        // Get today's date in YYYY-MM-DD format (KST)
        const now = new Date();
        const kstOffset = 9 * 60; // KST is UTC+9
        const kstTime = new Date(now.getTime() + kstOffset * 60 * 1000);
        const today = kstTime.toISOString().split('T')[0];
        const currentTime = kstTime;
        // Get attendance rules for today
        const rules = await getAttendanceRules(confId, today);
        if (!rules || !rules.zones || rules.zones.length === 0) {
            logger.info(`[AutoCheckout] No rules or zones for ${confId} on ${today}`);
            return result;
        }
        // Filter zones with autoCheckout enabled and that have ended
        const endedZones = rules.zones.filter(zone => zone.autoCheckout && isZoneEnded(zone.end, currentTime));
        if (endedZones.length === 0) {
            logger.info(`[AutoCheckout] No ended zones with autoCheckout for ${confId}`);
            return result;
        }
        logger.info(`[AutoCheckout] Processing ${endedZones.length} ended zones for ${confId}`);
        // Process each ended zone
        for (const zone of endedZones) {
            try {
                logger.info(`[AutoCheckout] Processing zone ${zone.name} (${zone.id}) - ended at ${zone.end}`);
                const zoneConfig = {
                    start: zone.start,
                    end: zone.end,
                    breaks: zone.breaks,
                    ruleDate: today,
                    goalMinutes: zone.goalMinutes || 0,
                    globalGoalMinutes: rules.globalGoalMinutes || 0,
                    completionMode: rules.completionMode || 'DAILY_SEPARATE',
                    cumulativeGoalMinutes: rules.cumulativeGoalMinutes || 0,
                };
                const batchResult = await (0, exitLogger_1.batchCreateExitLogs)(confId, zone.id, now, config.dryRun, zoneConfig);
                result.zonesProcessed++;
                result.participantsCheckedOut += batchResult.successful;
                logger.info(`[AutoCheckout] Zone ${zone.name}: ${batchResult.successful}/${batchResult.processed} checked out`);
                if (batchResult.failed > 0) {
                    logger.warn(`[AutoCheckout] Zone ${zone.name}: ${batchResult.failed} failures`);
                }
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                result.errors.push(`Zone ${zone.name}: ${errorMsg}`);
                logger.error(`[AutoCheckout] Error processing zone ${zone.name}:`, error);
            }
        }
        return result;
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(errorMsg);
        logger.error(`[AutoCheckout] Error processing conference ${confId}:`, error);
        return result;
    }
}
/**
 * Scheduled function that runs every 5 minutes
 * Checks for zones that have ended and auto-checks out participants
 */
exports.scheduledAutoCheckout = functions.pubsub
    .schedule('every 60 minutes')
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
    const startTime = Date.now();
    const now = new Date();
    const kstToday = getKstToday(now);
    logger.info('[AutoCheckout] Scheduler started', {
        timestamp: now.toISOString(),
        eventId: context.eventId,
        kstToday,
    });
    try {
        const config = await getAutoCheckoutConfig();
        if (!config.enabled) {
            logger.info('[AutoCheckout] Feature is disabled');
            return null;
        }
        logger.info('[AutoCheckout] Configuration loaded', {
            enabled: config.enabled,
            dryRun: config.dryRun,
            whitelistCount: config.whitelist.length,
        });
        const activeConferences = await getActiveConferences();
        const conferencesToProcess = [];
        for (const conf of activeConferences) {
            if (config.whitelist.length > 0 && !config.whitelist.includes(conf.id)) {
                continue;
            }
            const endDateStr = getConferenceEndDateStr(conf.data());
            if (!endDateStr)
                continue;
            if (kstToday >= endDateStr) {
                conferencesToProcess.push(conf.id);
                logger.info(`[AutoCheckout] ${conf.id}: ending on ${endDateStr}, will process.`);
            }
            else {
                logger.info(`[AutoCheckout] ${conf.id}: ends on ${endDateStr}, skipping (today: ${kstToday}).`);
            }
        }
        if (conferencesToProcess.length === 0) {
            logger.info('[AutoCheckout] No conferences ending today. Skipping.');
            return null;
        }
        logger.info(`[AutoCheckout] Processing ${conferencesToProcess.length} conferences`);
        const results = [];
        const errors = [];
        for (const confId of conferencesToProcess) {
            try {
                const result = await processConferenceAutoCheckout(confId, config);
                results.push(result);
                if (result.errors.length > 0) {
                    errors.push(...result.errors);
                }
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`${confId}: ${errorMsg}`);
                logger.error(`[AutoCheckout] Unhandled error for ${confId}:`, error);
            }
        }
        // Summary
        const totalZonesProcessed = results.reduce((sum, r) => sum + r.zonesProcessed, 0);
        const totalParticipantsCheckedOut = results.reduce((sum, r) => sum + r.participantsCheckedOut, 0);
        const duration = Date.now() - startTime;
        logger.info('[AutoCheckout] Completed', {
            conferencesProcessed: conferencesToProcess.length,
            zonesProcessed: totalZonesProcessed,
            participantsCheckedOut: totalParticipantsCheckedOut,
            errors: errors.length,
            durationMs: duration,
            dryRun: config.dryRun,
        });
        return {
            success: true,
            conferencesProcessed: conferencesToProcess.length,
            zonesProcessed: totalZonesProcessed,
            participantsCheckedOut: totalParticipantsCheckedOut,
            errors: errors.length,
            durationMs: duration,
            dryRun: config.dryRun,
        };
    }
    catch (error) {
        logger.error('[AutoCheckout] Critical error:', error);
        // Don't throw - we want the function to complete even on error
        // The next scheduled run will try again
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
        };
    }
});
/**
 * Manual trigger for testing (HTTP callable)
 * Allows admins to manually trigger auto checkout for a specific conference
 */
exports.manualAutoCheckout = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { confId, dryRun = true } = data;
    if (!confId) {
        throw new functions.https.HttpsError('invalid-argument', 'confId is required');
    }
    logger.info(`[AutoCheckout] Manual trigger for ${confId}`, {
        dryRun,
        caller: context.auth.uid,
    });
    const db = getDb();
    const confSnap = await db.doc(`conferences/${confId}`).get();
    if (!confSnap.exists) {
        throw new functions.https.HttpsError('not-found', `Conference ${confId} not found.`);
    }
    const endDateStr = getConferenceEndDateStr(confSnap.data());
    if (!endDateStr) {
        throw new functions.https.HttpsError('failed-precondition', `Conference ${confId} has no end date configured.`);
    }
    const kstToday = getKstToday();
    if (kstToday < endDateStr) {
        throw new functions.https.HttpsError('failed-precondition', `Auto checkout is only available on the conference last day (${endDateStr}). Today is ${kstToday}.`);
    }
    try {
        const config = {
            enabled: true,
            dryRun: dryRun,
            whitelist: [confId],
        };
        const result = await processConferenceAutoCheckout(confId, config);
        return {
            success: true,
            ...result,
            dryRun: dryRun,
        };
    }
    catch (error) {
        logger.error(`[AutoCheckout] Manual trigger failed for ${confId}:`, error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Auto checkout failed');
    }
});
//# sourceMappingURL=autoCheckout.js.map