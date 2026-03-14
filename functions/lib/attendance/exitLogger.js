"use strict";
/**
 * Exit Logger - Creates EXIT logs for automatic checkout
 *
 * This module provides safe, idempotent EXIT log creation with:
 * - Duplicate prevention (checks for existing EXIT logs)
 * - Transaction support for atomicity
 * - Support for both regular and external attendees
 * - Dry-run mode for testing
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
async function createExitLog(confId, registrationId, zoneId, exitTime, isExternal = false, dryRun = false) {
    const collectionName = isExternal ? 'external_attendees' : 'registrations';
    const registrationRef = getDb().doc(`conferences/${confId}/${collectionName}/${registrationId}`);
    const logsRef = getDb().collection(`conferences/${confId}/${collectionName}/${registrationId}/logs`);
    const accessLogsRef = getDb().collection(`conferences/${confId}/access_logs`);
    const today = exitTime.toISOString().split('T')[0];
    try {
        // Use transaction for atomicity
        return await getDb().runTransaction(async (transaction) => {
            var _a, _b;
            // 1. Get registration document
            const regDoc = await transaction.get(registrationRef);
            if (!regDoc.exists) {
                return {
                    success: false,
                    reason: 'REGISTRATION_NOT_FOUND',
                    registrationId,
                    zoneId,
                };
            }
            const registration = regDoc.data();
            // 2. Check if already checked out (no current zone or attendance status is OUTSIDE)
            if ((registration === null || registration === void 0 ? void 0 : registration.attendanceStatus) !== 'INSIDE') {
                return {
                    success: false,
                    reason: 'ALREADY_CHECKED_OUT',
                    registrationId,
                    zoneId,
                };
            }
            // 3. Verify current zone matches
            if ((registration === null || registration === void 0 ? void 0 : registration.currentZone) !== zoneId) {
                return {
                    success: false,
                    reason: 'ZONE_MISMATCH',
                    registrationId,
                    zoneId,
                };
            }
            // 4. Check for existing EXIT log today in this zone
            const existingExitQuery = logsRef
                .where('type', '==', 'EXIT')
                .where('zoneId', '==', zoneId)
                .where('date', '==', today)
                .limit(1);
            const existingExits = await transaction.get(existingExitQuery);
            if (!existingExits.empty) {
                return {
                    success: false,
                    reason: 'EXIT_ALREADY_EXISTS',
                    registrationId,
                    zoneId,
                };
            }
            // 5. Find the last ENTRY log for this zone
            const lastEntryQuery = logsRef
                .where('type', '==', 'ENTER')
                .where('zoneId', '==', zoneId)
                .orderBy('timestamp', 'desc')
                .limit(1);
            const lastEntry = await transaction.get(lastEntryQuery);
            if (lastEntry.empty) {
                return {
                    success: false,
                    reason: 'NO_ENTRY_FOUND',
                    registrationId,
                    zoneId,
                };
            }
            const entryData = lastEntry.docs[0].data();
            const entryTime = ((_a = entryData.timestamp) === null || _a === void 0 ? void 0 : _a.toDate) ? entryData.timestamp.toDate() : new Date(entryData.timestamp._seconds * 1000);
            const lastCheckIn = ((_b = registration.lastCheckIn) === null || _b === void 0 ? void 0 : _b.toDate) ? registration.lastCheckIn.toDate() : entryTime;
            // 6. Calculate duration (will be used for statistics)
            let durationMinutes = 0;
            if (exitTime > lastCheckIn) {
                durationMinutes = Math.floor((exitTime.getTime() - lastCheckIn.getTime()) / 60000);
            }
            // 7. Dry-run mode - don't actually write
            if (dryRun) {
                console.log(`[DRY-RUN] Would create EXIT for ${registrationId} in ${zoneId} at ${exitTime.toISOString()}`);
                return {
                    success: true,
                    reason: 'DRY_RUN',
                    registrationId,
                    zoneId,
                    exitTime,
                };
            }
            // 8. Create EXIT log in subcollection
            const exitLogRef = logsRef.doc();
            const exitTimestamp = firestore_1.Timestamp.fromDate(exitTime);
            transaction.set(exitLogRef, {
                type: 'EXIT',
                zoneId: zoneId,
                timestamp: exitTimestamp,
                date: today,
                method: 'AUTO_CHECKOUT',
                autoGenerated: true,
                source: 'auto-checkout-scheduler',
                rawDuration: durationMinutes,
                deduction: 0,
                recognizedMinutes: durationMinutes,
            });
            // 9. Update registration document
            transaction.update(registrationRef, {
                attendanceStatus: 'OUTSIDE',
                currentZone: null,
                lastCheckOut: exitTimestamp,
                // Note: totalMinutes will be calculated by a separate process or trigger
            });
            // 10. Add to access_logs (for statistics)
            const accessLogRef = accessLogsRef.doc();
            transaction.set(accessLogRef, {
                action: 'EXIT',
                scannedQr: (registration === null || registration === void 0 ? void 0 : registration.badgeQr) || registrationId,
                registrationId: registrationId,
                zoneId: zoneId,
                timestamp: exitTimestamp,
                method: 'AUTO_CHECKOUT',
                autoGenerated: true,
                source: 'auto-checkout-scheduler',
                isExternal: isExternal,
                recognizedMinutes: durationMinutes,
            });
            return {
                success: true,
                reason: 'EXIT_CREATED',
                registrationId,
                zoneId,
                exitTime,
            };
        });
    }
    catch (error) {
        console.error(`[ExitLogger] Error creating exit log for ${registrationId}:`, error);
        return {
            success: false,
            reason: 'ERROR',
            registrationId,
            zoneId,
        };
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
async function batchCreateExitLogs(confId, zoneId, exitTime, dryRun = false) {
    const results = [];
    let successful = 0;
    let failed = 0;
    // Process regular registrations
    const registrations = await findParticipantsInZone(confId, zoneId, 'registrations');
    for (const reg of registrations) {
        const result = await createExitLog(confId, reg.id, zoneId, exitTime, false, dryRun);
        results.push(result);
        if (result.success) {
            successful++;
        }
        else {
            failed++;
        }
    }
    // Process external attendees
    const externalAttendees = await findParticipantsInZone(confId, zoneId, 'external_attendees');
    for (const ext of externalAttendees) {
        const result = await createExitLog(confId, ext.id, zoneId, exitTime, true, dryRun);
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