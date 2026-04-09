"use strict";
/**
 * Exit Logger - Creates EXIT logs for automatic checkout
 *
 * This module provides safe, idempotent EXIT log creation with:
 * - Duplicate prevention (checks for existing EXIT logs)
 * - Transaction support for atomicity
 * - Support for both regular and external attendees
 * - Dry-run mode for testing
 * - Break time exclusion (matches kiosk logic)
 * - totalMinutes accumulation and isCompleted evaluation
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
exports.createExitLog = createExitLog;
exports.findParticipantsInZone = findParticipantsInZone;
exports.batchCreateExitLogs = batchCreateExitLogs;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
/**
 * Gets the Firestore instance - lazy initialization
 * This ensures db is only accessed when actually needed
 */
function getDb() {
    return admin.firestore();
}
/**
 * Fetches zone config from conferences/{confId}/settings/attendance.
 * Used as a fallback when zoneConfig is not explicitly provided.
 */
async function fetchZoneConfig(confId, zoneId) {
    var _a;
    try {
        const rulesDoc = await getDb()
            .doc(`conferences/${confId}/settings/attendance`)
            .get();
        if (!rulesDoc.exists)
            return null;
        const allRules = ((_a = rulesDoc.data()) === null || _a === void 0 ? void 0 : _a.rules) || {};
        for (const [dateStr, rule] of Object.entries(allRules)) {
            const typedRule = rule;
            if (!(typedRule === null || typedRule === void 0 ? void 0 : typedRule.zones))
                continue;
            for (const z of typedRule.zones) {
                if (z.id === zoneId) {
                    return {
                        start: z.start,
                        end: z.end,
                        breaks: z.breaks,
                        ruleDate: dateStr,
                        goalMinutes: z.goalMinutes || 0,
                        globalGoalMinutes: typedRule.globalGoalMinutes || 0,
                        completionMode: typedRule.completionMode || 'DAILY_SEPARATE',
                        cumulativeGoalMinutes: typedRule.cumulativeGoalMinutes || 0,
                    };
                }
            }
        }
        return null;
    }
    catch (error) {
        console.error(`[ExitLogger] Failed to fetch zone config for ${confId}/${zoneId}:`, error);
        return null;
    }
}
/**
 * Creates an EXIT log for a participant in a specific zone
 *
 * Features:
 * - Prevents duplicate EXIT logs (idempotent)
 * - Uses Firestore transactions for atomicity
 * - Supports both regular registrations and external attendees
 * - Respects dry-run mode
 *
 * @param confId - Conference ID
 * @param registrationId - Registration or external attendee ID
 * @param zoneId - Zone ID where the participant is checked in
 * @param exitTime - Time to record for the exit
 * @param isExternal - Whether this is an external attendee
 * @param dryRun - If true, simulate without writing
 * @returns ExitLogResult indicating success/failure and reason
 */
async function createExitLog(confId, registrationId, zoneId, exitTime, isExternal = false, dryRun = false, zoneConfig) {
    const collectionName = isExternal ? 'external_attendees' : 'registrations';
    const registrationRef = getDb().doc(`conferences/${confId}/${collectionName}/${registrationId}`);
    const logsRef = getDb().collection(`conferences/${confId}/${collectionName}/${registrationId}/logs`);
    const accessLogsRef = getDb().collection(`conferences/${confId}/access_logs`);
    const today = exitTime.toISOString().split('T')[0];
    const resolvedZoneConfig = zoneConfig || await fetchZoneConfig(confId, zoneId);
    try {
        return await getDb().runTransaction(async (transaction) => {
            var _a, _b;
            const regDoc = await transaction.get(registrationRef);
            if (!regDoc.exists) {
                return { success: false, reason: 'REGISTRATION_NOT_FOUND', registrationId, zoneId };
            }
            const registration = regDoc.data();
            if ((registration === null || registration === void 0 ? void 0 : registration.attendanceStatus) !== 'INSIDE') {
                return { success: false, reason: 'ALREADY_CHECKED_OUT', registrationId, zoneId };
            }
            if ((registration === null || registration === void 0 ? void 0 : registration.currentZone) !== zoneId) {
                return { success: false, reason: 'ZONE_MISMATCH', registrationId, zoneId };
            }
            const existingExitQuery = logsRef
                .where('type', '==', 'EXIT')
                .where('zoneId', '==', zoneId)
                .where('date', '==', today)
                .limit(1);
            const existingExits = await transaction.get(existingExitQuery);
            if (!existingExits.empty) {
                return { success: false, reason: 'EXIT_ALREADY_EXISTS', registrationId, zoneId };
            }
            const lastEntryQuery = logsRef
                .where('type', '==', 'ENTER')
                .where('zoneId', '==', zoneId)
                .orderBy('timestamp', 'desc')
                .limit(1);
            const lastEntry = await transaction.get(lastEntryQuery);
            if (lastEntry.empty) {
                return { success: false, reason: 'NO_ENTRY_FOUND', registrationId, zoneId };
            }
            const entryData = lastEntry.docs[0].data();
            const entryTime = ((_a = entryData.timestamp) === null || _a === void 0 ? void 0 : _a.toDate) ? entryData.timestamp.toDate() : new Date(entryData.timestamp._seconds * 1000);
            const lastCheckInDate = ((_b = registration.lastCheckIn) === null || _b === void 0 ? void 0 : _b.toDate) ? registration.lastCheckIn.toDate() : entryTime;
            // Calculate recognized duration with zone boundaries and break time exclusion
            // (mirrors GatePage.tsx / AttendanceScannerPage.tsx kiosk logic)
            let rawDurationMinutes = 0;
            let recognizedMinutes = 0;
            if (exitTime > lastCheckInDate) {
                let boundedStart = lastCheckInDate;
                let boundedEnd = exitTime;
                if ((resolvedZoneConfig === null || resolvedZoneConfig === void 0 ? void 0 : resolvedZoneConfig.start) && (resolvedZoneConfig === null || resolvedZoneConfig === void 0 ? void 0 : resolvedZoneConfig.end)) {
                    const dateStr = resolvedZoneConfig.ruleDate || lastCheckInDate.toISOString().split('T')[0];
                    const zoneStart = new Date(`${dateStr}T${resolvedZoneConfig.start}:00+09:00`);
                    const zoneEnd = new Date(`${dateStr}T${resolvedZoneConfig.end}:00+09:00`);
                    boundedStart = new Date(Math.max(lastCheckInDate.getTime(), zoneStart.getTime()));
                    boundedEnd = new Date(Math.min(exitTime.getTime(), zoneEnd.getTime()));
                }
                if (boundedEnd > boundedStart) {
                    rawDurationMinutes = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);
                    let deduction = 0;
                    if ((resolvedZoneConfig === null || resolvedZoneConfig === void 0 ? void 0 : resolvedZoneConfig.breaks) && Array.isArray(resolvedZoneConfig.breaks)) {
                        for (const brk of resolvedZoneConfig.breaks) {
                            const dateStr = resolvedZoneConfig.ruleDate || lastCheckInDate.toISOString().split('T')[0];
                            const breakStart = new Date(`${dateStr}T${brk.start}:00+09:00`);
                            const breakEnd = new Date(`${dateStr}T${brk.end}:00+09:00`);
                            const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
                            const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
                            if (overlapEnd > overlapStart) {
                                deduction += Math.floor((overlapEnd - overlapStart) / 60000);
                            }
                        }
                    }
                    recognizedMinutes = Math.max(0, rawDurationMinutes - deduction);
                }
            }
            const previousTotalMinutes = registration.totalMinutes || 0;
            const newTotalMinutes = previousTotalMinutes + recognizedMinutes;
            const todayStr = exitTime.toISOString().split('T')[0];
            const dailyMinutes = { ...(registration.dailyMinutes || {}) };
            dailyMinutes[todayStr] = (dailyMinutes[todayStr] || 0) + recognizedMinutes;
            let newIsCompleted = registration.isCompleted || false;
            if ((resolvedZoneConfig === null || resolvedZoneConfig === void 0 ? void 0 : resolvedZoneConfig.completionMode) === 'CUMULATIVE') {
                const goal = resolvedZoneConfig.cumulativeGoalMinutes || 0;
                if (goal > 0 && newTotalMinutes >= goal)
                    newIsCompleted = true;
            }
            else {
                const dailyGoal = (resolvedZoneConfig === null || resolvedZoneConfig === void 0 ? void 0 : resolvedZoneConfig.goalMinutes) || (resolvedZoneConfig === null || resolvedZoneConfig === void 0 ? void 0 : resolvedZoneConfig.globalGoalMinutes) || 0;
                newIsCompleted = dailyGoal > 0 && (dailyMinutes[todayStr] || 0) >= dailyGoal;
            }
            if (dryRun) {
                console.log(`[DRY-RUN] Would create EXIT for ${registrationId} in ${zoneId} at ${exitTime.toISOString()}, +${recognizedMinutes}min, total=${newTotalMinutes}, completed=${newIsCompleted}`);
                return { success: true, reason: 'DRY_RUN', registrationId, zoneId, exitTime };
            }
            const exitTimestamp = firestore_1.Timestamp.fromDate(exitTime);
            const exitLogRef = logsRef.doc();
            transaction.set(exitLogRef, {
                type: 'EXIT',
                zoneId: zoneId,
                timestamp: exitTimestamp,
                date: today,
                method: 'AUTO_CHECKOUT',
                autoGenerated: true,
                source: 'auto-checkout-scheduler',
                rawDuration: rawDurationMinutes,
                deduction: rawDurationMinutes - recognizedMinutes,
                recognizedMinutes: recognizedMinutes,
                accumulatedTotal: newTotalMinutes,
            });
            transaction.update(registrationRef, {
                attendanceStatus: 'OUTSIDE',
                currentZone: null,
                lastCheckOut: exitTimestamp,
                totalMinutes: newTotalMinutes,
                dailyMinutes: dailyMinutes,
                isCompleted: newIsCompleted,
            });
            const accessLogRef = accessLogsRef.doc();
            transaction.set(accessLogRef, {
                action: 'EXIT',
                scannedQr: (registration === null || registration === void 0 ? void 0 : registration.badgeQr) || registrationId,
                registrationId: registrationId,
                zoneId: zoneId,
                timestamp: exitTimestamp,
                date: todayStr,
                method: 'AUTO_CHECKOUT',
                autoGenerated: true,
                source: 'auto-checkout-scheduler',
                isExternal: isExternal,
                recognizedMinutes: recognizedMinutes,
                accumulatedTotal: newTotalMinutes,
            });
            return { success: true, reason: 'EXIT_CREATED', registrationId, zoneId, exitTime };
        });
    }
    catch (error) {
        console.error(`[ExitLogger] Error creating exit log for ${registrationId}:`, error);
        return { success: false, reason: 'ERROR', registrationId, zoneId };
    }
}
/**
 * Finds all participants currently checked in to a specific zone
 *
 * @param confId - Conference ID
 * @param zoneId - Zone ID to search
 * @param collectionName - 'registrations' or 'external_attendees'
 * @returns Array of registration documents with their IDs
 */
async function findParticipantsInZone(confId, zoneId, collectionName) {
    try {
        const snapshot = await getDb()
            .collection(`conferences/${confId}/${collectionName}`)
            .where('attendanceStatus', '==', 'INSIDE')
            .where('currentZone', '==', zoneId)
            .get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data(),
        }));
    }
    catch (error) {
        console.error(`[ExitLogger] Error finding participants in zone ${zoneId}:`, error);
        return [];
    }
}
/**
 * Batch creates EXIT logs for multiple participants
 *
 * @param confId - Conference ID
 * @param zoneId - Zone ID
 * @param exitTime - Exit time for all participants
 * @param dryRun - If true, simulate without writing
 * @returns Summary of results
 */
async function batchCreateExitLogs(confId, zoneId, exitTime, dryRun = false, zoneConfig) {
    const results = [];
    let successful = 0;
    let failed = 0;
    const registrations = await findParticipantsInZone(confId, zoneId, 'registrations');
    for (const reg of registrations) {
        const result = await createExitLog(confId, reg.id, zoneId, exitTime, false, dryRun, zoneConfig);
        results.push(result);
        if (result.success) {
            successful++;
        }
        else {
            failed++;
        }
    }
    const externalAttendees = await findParticipantsInZone(confId, zoneId, 'external_attendees');
    for (const ext of externalAttendees) {
        const result = await createExitLog(confId, ext.id, zoneId, exitTime, true, dryRun, zoneConfig);
        results.push(result);
        if (result.success) {
            successful++;
        }
        else {
            failed++;
        }
    }
    return {
        processed: registrations.length + externalAttendees.length,
        successful,
        failed,
        results,
    };
}
//# sourceMappingURL=exitLogger.js.map