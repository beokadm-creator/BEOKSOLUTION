/**
 * Auto Checkout Scheduler - Scheduled Cloud Function for automatic participant checkout
 * 
 * This function runs every 5 minutes and:
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

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { batchCreateExitLogs, type ZoneConfig } from './exitLogger';

// Custom logger with context
const logger = functions.logger;

// Get Firestore instance - called inside functions to ensure initialization
const getDb = () => admin.firestore();

/**
 * Configuration for auto checkout behavior
 */
interface AutoCheckoutConfig {
  enabled: boolean;
  dryRun: boolean;
  whitelist: string[];
}

/**
 * Gets feature flag configuration from Firestore
 * 
 * In production, this should use Firebase Remote Config.
 * For now, we use a Firestore document for easier management.
 */
async function getAutoCheckoutConfig(): Promise<AutoCheckoutConfig> {
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
      enabled: data.enabled ?? true,
      dryRun: data.dry_run ?? false,
      whitelist: Array.isArray(data.whitelist) ? data.whitelist : [],
    };
  } catch (error) {
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
async function getAttendanceRules(
  confId: string,
  date: string
): Promise<{
  globalGoalMinutes: number;
  completionMode: 'DAILY_SEPARATE' | 'CUMULATIVE';
  cumulativeGoalMinutes: number;
  zones: Array<{
    id: string;
    name: string;
    start: string;
    end: string;
    autoCheckout: boolean;
    breaks: Array<{ label: string; start: string; end: string }>;
    points: number;
    goalMinutes?: number;
  }>;
} | null> {
  try {
    const db = getDb();
    const rulesDoc = await db
      .doc(`conferences/${confId}/settings/attendance`)
      .get();

    if (!rulesDoc.exists) {
      return null;
    }

    const allRules = rulesDoc.data()?.rules || {};
    return allRules[date] || null;
  } catch (error) {
    logger.error(`[AutoCheckout] Failed to get rules for ${confId}:`, error);
    return null;
  }
}

/**
 * Gets all active conferences
 */
async function getActiveConferences(): Promise<string[]> {
  try {
    const db = getDb();
    const snapshot = await db
      .collection('conferences')
      .where('status', '==', 'active')
      .get();

    return snapshot.docs.map(doc => doc.id);
  } catch (error) {
    logger.error('[AutoCheckout] Failed to get active conferences:', error);
    return [];
  }
}

/**
 * Checks if a zone has ended (current time >= zone end time)
 */
function isZoneEnded(zoneEnd: string, currentTime: Date): boolean {
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
async function processConferenceAutoCheckout(
  confId: string,
  config: AutoCheckoutConfig
): Promise<{
  conferenceId: string;
  zonesProcessed: number;
  participantsCheckedOut: number;
  errors: string[];
}> {
  const result = {
    conferenceId: confId,
    zonesProcessed: 0,
    participantsCheckedOut: 0,
    errors: [] as string[],
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
    const endedZones = rules.zones.filter(zone => 
      zone.autoCheckout && isZoneEnded(zone.end, currentTime)
    );

    if (endedZones.length === 0) {
      logger.info(`[AutoCheckout] No ended zones with autoCheckout for ${confId}`);
      return result;
    }

    logger.info(
      `[AutoCheckout] Processing ${endedZones.length} ended zones for ${confId}`
    );

    // Process each ended zone
    for (const zone of endedZones) {
      try {
        logger.info(
          `[AutoCheckout] Processing zone ${zone.name} (${zone.id}) - ended at ${zone.end}`
        );

        const zoneConfig: ZoneConfig = {
          start: zone.start,
          end: zone.end,
          breaks: zone.breaks,
          ruleDate: today,
          goalMinutes: zone.goalMinutes || 0,
          globalGoalMinutes: rules.globalGoalMinutes || 0,
          completionMode: rules.completionMode || 'DAILY_SEPARATE',
          cumulativeGoalMinutes: rules.cumulativeGoalMinutes || 0,
        };

        const batchResult = await batchCreateExitLogs(
          confId,
          zone.id,
          now,
          config.dryRun,
          zoneConfig
        );

        result.zonesProcessed++;
        result.participantsCheckedOut += batchResult.successful;

        logger.info(
          `[AutoCheckout] Zone ${zone.name}: ${batchResult.successful}/${batchResult.processed} checked out`
        );

        if (batchResult.failed > 0) {
          logger.warn(
            `[AutoCheckout] Zone ${zone.name}: ${batchResult.failed} failures`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Zone ${zone.name}: ${errorMsg}`);
        logger.error(`[AutoCheckout] Error processing zone ${zone.name}:`, error);
      }
    }

    return result;
  } catch (error) {
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
export const scheduledAutoCheckout = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    const startTime = Date.now();
    logger.info('[AutoCheckout] Scheduler started', { 
      timestamp: new Date().toISOString(),
      eventId: context.eventId 
    });

    try {
      // Get configuration
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

      // Get active conferences
      let conferences = await getActiveConferences();

      // Apply whitelist filter if specified
      if (config.whitelist.length > 0) {
        conferences = conferences.filter(confId => config.whitelist.includes(confId));
        logger.info(`[AutoCheckout] Whitelist applied: ${conferences.length} conferences`);
      }

      if (conferences.length === 0) {
        logger.info('[AutoCheckout] No conferences to process');
        return null;
      }

      logger.info(`[AutoCheckout] Processing ${conferences.length} conferences`);

      // Process each conference
      const results: Array<{ conferenceId: string; zonesProcessed: number; participantsCheckedOut: number; errors: string[] }> = [];
      const errors: string[] = [];

      for (const confId of conferences) {
        try {
          const result = await processConferenceAutoCheckout(confId, config);
          results.push(result);
          
          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
        } catch (error) {
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
        conferencesProcessed: conferences.length,
        zonesProcessed: totalZonesProcessed,
        participantsCheckedOut: totalParticipantsCheckedOut,
        errors: errors.length,
        durationMs: duration,
        dryRun: config.dryRun,
      });

      // Return summary for monitoring
      return {
        success: true,
        conferencesProcessed: conferences.length,
        zonesProcessed: totalZonesProcessed,
        participantsCheckedOut: totalParticipantsCheckedOut,
        errors: errors.length,
        durationMs: duration,
        dryRun: config.dryRun,
      };

    } catch (error) {
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
export const manualAutoCheckout = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }

    const { confId, dryRun = true } = data;

    if (!confId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'confId is required'
      );
    }

    logger.info(`[AutoCheckout] Manual trigger for ${confId}`, {
      dryRun,
      caller: context.auth.uid,
    });

    try {
      const config: AutoCheckoutConfig = {
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
    } catch (error) {
      logger.error(`[AutoCheckout] Manual trigger failed for ${confId}:`, error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Auto checkout failed'
      );
    }
  }
);
