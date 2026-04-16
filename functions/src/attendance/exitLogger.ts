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
 * Zone configuration for duration calculation with break time exclusion.
 * Mirrors the zone rule structure used in GatePage.tsx / AttendanceScannerPage.tsx.
 */
export interface ZoneConfig {
  start?: string;               // Zone start time "HH:mm"
  end?: string;                 // Zone end time "HH:mm"
  breaks?: Array<{ label: string; start: string; end: string }>;
  ruleDate?: string;            // "YYYY-MM-DD" — date this zone rule belongs to
  goalMinutes?: number;         // Per-zone goal (0 = use globalGoalMinutes)
  globalGoalMinutes?: number;   // Daily global goal (default 240)
  completionMode?: 'DAILY_SEPARATE' | 'CUMULATIVE';
  cumulativeGoalMinutes?: number;
}

/**
 * Fetches zone config from conferences/{confId}/settings/attendance.
 * Used as a fallback when zoneConfig is not explicitly provided.
 */
async function fetchZoneConfig(
  confId: string,
  zoneId: string
): Promise<ZoneConfig | null> {
  try {
    const rulesDoc = await getDb()
      .doc(`conferences/${confId}/settings/attendance`)
      .get();

    if (!rulesDoc.exists) return null;

    const allRules = rulesDoc.data()?.rules || {};
    for (const [dateStr, rule] of Object.entries(allRules)) {
      const typedRule = rule as {
        globalGoalMinutes?: number;
        completionMode?: 'DAILY_SEPARATE' | 'CUMULATIVE';
        cumulativeGoalMinutes?: number;
        zones?: Array<Record<string, unknown>>;
      };
      if (!typedRule?.zones) continue;

      for (const z of typedRule.zones) {
        if ((z as { id: string }).id === zoneId) {
          return {
            start: (z as { start?: string }).start,
            end: (z as { end?: string }).end,
            breaks: (z as { breaks?: Array<{ label: string; start: string; end: string }> }).breaks,
            ruleDate: dateStr,
            goalMinutes: (z as { goalMinutes?: number }).goalMinutes || 0,
            globalGoalMinutes: typedRule.globalGoalMinutes || 0,
            completionMode: typedRule.completionMode || 'DAILY_SEPARATE',
            cumulativeGoalMinutes: typedRule.cumulativeGoalMinutes || 0,
          };
        }
      }
    }
    return null;
  } catch (error) {
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
export async function createExitLog(
  confId: string,
  registrationId: string,
  zoneId: string,
  exitTime: Date,
  isExternal: boolean = false,
  dryRun: boolean = false,
  zoneConfig?: ZoneConfig
): Promise<ExitLogResult> {
  const collectionName = isExternal ? 'external_attendees' : 'registrations';
  const registrationRef = getDb().doc(`conferences/${confId}/${collectionName}/${registrationId}`);
  const logsRef = getDb().collection(`conferences/${confId}/${collectionName}/${registrationId}/logs`);
  const accessLogsRef = getDb().collection(`conferences/${confId}/access_logs`);
  // Extract KST date from real UTC time
  const kstMs = exitTime.getTime() + 9 * 60 * 60 * 1000;
  const today = new Date(kstMs).toISOString().split('T')[0];

  const resolvedZoneConfig = zoneConfig || await fetchZoneConfig(confId, zoneId);

  try {
    return await getDb().runTransaction(async (transaction) => {
      const regDoc = await transaction.get(registrationRef);
      
      if (!regDoc.exists) {
        return { success: false, reason: 'REGISTRATION_NOT_FOUND', registrationId, zoneId };
      }

      const registration = regDoc.data();

      if (registration?.attendanceStatus !== 'INSIDE') {
        return { success: false, reason: 'ALREADY_CHECKED_OUT', registrationId, zoneId };
      }

      if (registration?.currentZone !== zoneId) {
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
      const entryTime = entryData.timestamp?.toDate ? entryData.timestamp.toDate() : new Date(entryData.timestamp._seconds * 1000);
      const lastCheckInDate = registration.lastCheckIn?.toDate ? registration.lastCheckIn.toDate() : entryTime;

      // Calculate recognized duration with zone boundaries and break time exclusion
      // (mirrors GatePage.tsx / AttendanceScannerPage.tsx kiosk logic)
      let rawDurationMinutes = 0;
      let recognizedMinutes = 0;

      if (exitTime > lastCheckInDate) {
        let boundedStart = lastCheckInDate;
        let boundedEnd = exitTime;

        if (resolvedZoneConfig?.start && resolvedZoneConfig?.end) {
          const kstMs = lastCheckInDate.getTime() + 9 * 60 * 60 * 1000;
          const dateStr = resolvedZoneConfig.ruleDate || new Date(kstMs).toISOString().split('T')[0];
          const zoneStart = new Date(`${dateStr}T${resolvedZoneConfig.start}:00+09:00`);
          const zoneEnd = new Date(`${dateStr}T${resolvedZoneConfig.end}:00+09:00`);
          boundedStart = new Date(Math.max(lastCheckInDate.getTime(), zoneStart.getTime()));
          boundedEnd = new Date(Math.min(exitTime.getTime(), zoneEnd.getTime()));
        }

        if (boundedEnd > boundedStart) {
          rawDurationMinutes = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);

          let deduction = 0;
          if (resolvedZoneConfig?.breaks && Array.isArray(resolvedZoneConfig.breaks)) {
            for (const brk of resolvedZoneConfig.breaks) {
              const kstMs = lastCheckInDate.getTime() + 9 * 60 * 60 * 1000;
              const dateStr = resolvedZoneConfig.ruleDate || new Date(kstMs).toISOString().split('T')[0];
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

      // KST date from real UTC time
      const kstMs = exitTime.getTime() + 9 * 60 * 60 * 1000;
      const todayStr = resolvedZoneConfig?.ruleDate || new Date(kstMs).toISOString().split('T')[0];

      const dailyMinutes = { ...(registration.dailyMinutes || {}) };
      dailyMinutes[todayStr] = (dailyMinutes[todayStr] || 0) + recognizedMinutes;

      // Per-zone tracking
      const zoneMinutes: Record<string, number> = { ...(registration.zoneMinutes || {}) };
      const zoneCompleted: Record<string, boolean> = { ...(registration.zoneCompleted || {}) };

      // Add recognized minutes to the zone being checked out
      if (zoneId && recognizedMinutes > 0) {
        zoneMinutes[zoneId] = (zoneMinutes[zoneId] || 0) + recognizedMinutes;
      }

      // Per-zone completion check — skip in CUMULATIVE mode
      if (zoneId && recognizedMinutes > 0 && resolvedZoneConfig?.completionMode !== 'CUMULATIVE') {
        const zoneGoal = resolvedZoneConfig?.goalMinutes || resolvedZoneConfig?.globalGoalMinutes || 0;
        if (zoneGoal > 0 && (zoneMinutes[zoneId] || 0) >= zoneGoal) {
          zoneCompleted[zoneId] = true;
        }
      }

      // isCompleted = any zone completed OR cumulative goal met
      const anyZoneCompleted = Object.values(zoneCompleted).some(v => v === true);
      const cumulativeCompleted = resolvedZoneConfig?.completionMode === 'CUMULATIVE'
        && !!resolvedZoneConfig.cumulativeGoalMinutes
        && newTotalMinutes >= (resolvedZoneConfig.cumulativeGoalMinutes || 0);
      const newIsCompleted = anyZoneCompleted || !!cumulativeCompleted || (registration.isCompleted || false);

      if (dryRun) {
        console.log(`[DRY-RUN] Would create EXIT for ${registrationId} in ${zoneId} at ${exitTime.toISOString()}, +${recognizedMinutes}min, total=${newTotalMinutes}, completed=${newIsCompleted}`);
        return { success: true, reason: 'DRY_RUN', registrationId, zoneId, exitTime };
      }

      const exitTimestamp = Timestamp.fromDate(exitTime);

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
        zoneMinutes: zoneMinutes,
        zoneCompleted: zoneCompleted,
        isCompleted: newIsCompleted,
      });

      const accessLogRef = accessLogsRef.doc();
      transaction.set(accessLogRef, {
        action: 'EXIT',
        scannedQr: registration?.badgeQr || registrationId,
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
  } catch (error) {
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
  dryRun: boolean = false,
  zoneConfig?: ZoneConfig
): Promise<{
  processed: number;
  successful: number;
  failed: number;
  results: ExitLogResult[];
}> {
  const results: ExitLogResult[] = [];
  let successful = 0;
  let failed = 0;

  const registrations = await findParticipantsInZone(confId, zoneId, 'registrations');
  
  // Process in chunks to avoid timeout (H1 fix)
  const CHUNK_SIZE = 20;
  
  for (let i = 0; i < registrations.length; i += CHUNK_SIZE) {
    const chunk = registrations.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(reg => createExitLog(confId, reg.id, zoneId, exitTime, false, dryRun, zoneConfig))
    );
    
    for (const result of chunkResults) {
      results.push(result);
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }
  }

  const externalAttendees = await findParticipantsInZone(confId, zoneId, 'external_attendees');
  
  for (let i = 0; i < externalAttendees.length; i += CHUNK_SIZE) {
    const chunk = externalAttendees.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(ext => createExitLog(confId, ext.id, zoneId, exitTime, true, dryRun, zoneConfig))
    );
    
    for (const result of chunkResults) {
      results.push(result);
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }
  }

  return {
    processed: registrations.length + externalAttendees.length,
    successful,
    failed,
    results,
  };
}
