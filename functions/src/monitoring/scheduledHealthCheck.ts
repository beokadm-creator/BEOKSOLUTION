import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface HealthCheckResult {
    status: string;
    latencyMs?: number;
    error?: string;
}

/**
 * Scheduled: Infrastructure Health Check
 *
 * Runs every 6 hours and verifies core services (Firestore, Auth) are operational.
 * Logs results to Firestore at system/health_checks/logs.
 */
export const scheduledHealthCheck = functions.pubsub
    .schedule('every 6 hours')
    .onRun(async (context) => {
        const db = admin.firestore();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        const results: Record<string, HealthCheckResult> = {};

        // 1. Check Firestore connectivity
        try {
            const start = Date.now();
            await db.doc('system/health').get();
            results.firestore = { status: 'healthy', latencyMs: Date.now() - start };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            results.firestore = { status: 'unhealthy', error: msg };
        }

        // 2. Check Auth service
        try {
            await admin.auth().listUsers(1);
            results.auth = { status: 'healthy' };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            results.auth = { status: 'unhealthy', error: msg };
        }

        // Determine overall status
        const allHealthy = Object.values(results).every(r => r.status === 'healthy');
        const overallStatus = allHealthy ? 'healthy' : 'degraded';

        // Log result
        const logEntry = {
            timestamp,
            overallStatus,
            checks: results,
            triggeredBy: context.eventType || 'schedule',
        };

        await db.collection('system/health_checks/logs').add(logEntry);

        if (!allHealthy) {
            functions.logger.warn('[ScheduledHealthCheck] Degraded infrastructure detected:', JSON.stringify(results));
        } else {
            functions.logger.info('[ScheduledHealthCheck] All systems healthy');
        }

        return null;
    });

/**
 * Callable: Manual Health Check
 *
 * On-demand health check for authenticated users.
 * Returns current infrastructure status without writing to Firestore logs.
 */
export const manualHealthCheck = functions.https.onCall(async (_data, context) => {
    // Verify caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }

    const db = admin.firestore();
    const results: Record<string, HealthCheckResult> = {};

    try {
        const start = Date.now();
        await db.doc('system/health').get();
        results.firestore = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.firestore = { status: 'unhealthy', error: msg };
    }

    try {
        await admin.auth().listUsers(1);
        results.auth = { status: 'healthy' };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.auth = { status: 'unhealthy', error: msg };
    }

    const allHealthy = Object.values(results).every(r => r.status === 'healthy');

    return {
        overallStatus: allHealthy ? 'healthy' : 'degraded',
        checks: results,
        timestamp: new Date().toISOString(),
    };
});
