/**
 * Exit Logger - Creates EXIT logs for automatic checkout
 * 
 * This module provides safe, idempotent EXIT log creation with:
 * - Duplicate prevention (checks for existing EXIT logs)
 * - Transaction support for atomicity
 * - Support for both regular and external attendees
 * - Dry-run mode for testing
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Gets the Firestore instance - lazy initialization
 * This ensures db is only accessed when actually needed
 */
function getDb(): admin.firestore.Firestore {
    return admin.firestore();
}

/**
 * Result of an exit log creation attempt
 */
export interface ExitLogResult {
  success: boolean;
  reason?: string;
  registrationId?: string;
  zoneId?: string;
  exitTime?: Date;
}

/**
 * Configuration for exit log creation
 */
export interface ExitLogConfig {
  dryRun?: boolean; // If true, don't actually write to database
  conferenceWhitelist?: string[]; // Only process these conference IDs (empty = all)
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
export async function createExitLog(
  confId: string,
  registrationId: string,
  zoneId: string,
  exitTime: Date,
  isExternal: boolean = false,
  dryRun: boolean = false
): Promise<ExitLogResult> {
  const collectionName = isExternal ? 'external_attendees' : 'registrations';
  const registrationRef = getDb().doc(`conferences/${confId}/${collectionName}/${registrationId}`);
  const logsRef = getDb().collection(`conferences/${confId}/${collectionName}/${registrationId}/logs`);
  const accessLogsRef = getDb().collection(`conferences/${confId}/access_logs`);
  const today = exitTime.toISOString().split('T')[0];

  try {
    // Use transaction for atomicity
    return await getDb().runTransaction(async (transaction) => {
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
      if (registration?.attendanceStatus !== 'INSIDE') {
        return {
          success: false,
          reason: 'ALREADY_CHECKED_OUT',
          registrationId,
          zoneId,
        };
      }

      // 3. Verify current zone matches
      if (registration?.currentZone !== zoneId) {
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
      const entryTime = entryData.timestamp?.toDate ? entryData.timestamp.toDate() : new Date(entryData.timestamp._seconds * 1000);
      const lastCheckIn = registration.lastCheckIn?.toDate ? registration.lastCheckIn.toDate() : entryTime;

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
      const exitTimestamp = Timestamp.fromDate(exitTime);

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
        scannedQr: registration?.badgeQr || registrationId,
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
  } catch (error) {
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
export async function findParticipantsInZone(
  confId: string,
  zoneId: string,
  collectionName: 'registrations' | 'external_attendees'
): Promise<Array<{ id: string; data: admin.firestore.DocumentData }>> {
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
  } catch (error) {
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
export async function batchCreateExitLogs(
  confId: string,
  zoneId: string,
  exitTime: Date,
  dryRun: boolean = false
): Promise<{
  processed: number;
  successful: number;
  failed: number;
  results: ExitLogResult[];
}> {
  const results: ExitLogResult[] = [];
  let successful = 0;
  let failed = 0;

  // Process regular registrations
  const registrations = await findParticipantsInZone(confId, zoneId, 'registrations');
  
  for (const reg of registrations) {
    const result = await createExitLog(confId, reg.id, zoneId, exitTime, false, dryRun);
    results.push(result);
    
    if (result.success) {
      successful++;
    } else {
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
    } else {
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
