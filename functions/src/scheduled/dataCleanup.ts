import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createAuditLogEntry } from '../audit/logAuditEvent';

/**
 * Cloud Function: scheduledDataCleanup
 *
 * Scheduled function that runs daily to delete old leads/stamps based on retention policy.
 * - Leads with PII (consent agreed): 3 years (1095 days)
 * - Leads without PII (consent denied): 5 years (1825 days)
 * - Stamps: 2 years (730 days)
 * - Audit logs: 5 years (1825 days)
 *
 * Schedule: Daily at 3 AM KST
 */
export const scheduledDataCleanup = functions.pubsub
    .schedule('0 3 * * *')
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();
        const threeYearsAgo = admin.firestore.Timestamp.fromDate(new Date(now.toDate().getTime() - 1095 * 24 * 60 * 60 * 1000));
        const twoYearsAgo = admin.firestore.Timestamp.fromDate(new Date(now.toDate().getTime() - 730 * 24 * 60 * 60 * 1000));
        const fiveYearsAgo = admin.firestore.Timestamp.fromDate(new Date(now.toDate().getTime() - 1825 * 24 * 60 * 60 * 1000));

        let totalDeleted = 0;
        const deletedCounts = {
            leadsPII: 0,
            leadsAnonymous: 0,
            stamps: 0,
            auditLogs: 0,
        };

        try {
            // 1. Delete leads with consentStatus = 'ACTIVE' and older than 3 years (PII data)
            const leadsPIIQuery = db.collectionGroup('leads')
                .where('consentStatus', '==', 'ACTIVE')
                .where('timestamp', '<', threeYearsAgo)
                .limit(500);

            const leadsPIISnapshot = await leadsPIIQuery.get();
            for (const doc of leadsPIISnapshot.docs) {
                await doc.ref.delete();
                deletedCounts.leadsPII++;
                totalDeleted++;
            }

            // 2. Delete leads with consentStatus = 'WITHDRAWN' and older than 5 years (anonymous)
            const leadsAnonQuery = db.collectionGroup('leads')
                .where('consentStatus', '==', 'WITHDRAWN')
                .where('timestamp', '<', fiveYearsAgo)
                .limit(500);

            const leadsAnonSnapshot = await leadsAnonQuery.get();
            for (const doc of leadsAnonSnapshot.docs) {
                await doc.ref.delete();
                deletedCounts.leadsAnonymous++;
                totalDeleted++;
            }

            // 3. Delete stamps older than 2 years
            const stampsQuery = db.collectionGroup('stamps')
                .where('timestamp', '<', twoYearsAgo)
                .limit(500);

            const stampsSnapshot = await stampsQuery.get();
            for (const doc of stampsSnapshot.docs) {
                await doc.ref.delete();
                deletedCounts.stamps++;
                totalDeleted++;
            }

            // 4. Delete audit logs older than 5 years (except critical logs)
            const auditLogsQuery = db.collectionGroup('audit_logs')
                .where('timestamp', '<', fiveYearsAgo)
                .where('action', 'not-in', ['CONSENT_WITHDRAWN', 'LEAD_DELETED'])
                .limit(500);

            const auditLogsSnapshot = await auditLogsQuery.get();
            for (const doc of auditLogsSnapshot.docs) {
                await doc.ref.delete();
                deletedCounts.auditLogs++;
                totalDeleted++;
            }

            // Create audit log for this cleanup run
            await createAuditLogEntry({
                action: 'LEAD_DELETED',
                entityType: 'LEAD',
                entityId: 'scheduled-cleanup',
                details: {
                    deletedCounts: deletedCounts,
                    totalDeleted: totalDeleted,
                    timestamp: now.toDate(),
                },
                result: 'SUCCESS',
                actorId: 'system',
                actorType: 'SYSTEM',
            });

            functions.logger.info(`[Data Cleanup] Deleted ${totalDeleted} documents:`, deletedCounts);

            return {
                success: true,
                deletedCounts: deletedCounts,
                totalDeleted: totalDeleted,
            };

        } catch (error: any) {
            functions.logger.error('[Data Cleanup] Failed:', error);

            // Create audit log for failure
            await createAuditLogEntry({
                action: 'LEAD_DELETED',
                entityType: 'LEAD',
                entityId: 'scheduled-cleanup-failed',
                details: {
                    error: error.message,
                },
                result: 'FAILURE',
                errorMessage: error.message,
                actorId: 'system',
                actorType: 'SYSTEM',
            }).catch(logError => {
                functions.logger.error('[Audit Log] Failed to create audit log:', logError);
            });

            throw error;
        }
    });

/**
 * Manual trigger for data cleanup (for testing or immediate cleanup)
 */
export const manualDataCleanup = functions.https.onCall(async (data, context) => {
    const db = admin.firestore();
    // Only super admin can trigger manual cleanup
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const email = context.auth.token?.email;
    if (email !== 'aaron@beoksolution.com' && email !== 'test@eregi.co.kr' && context.auth.token?.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Only super admin can trigger manual cleanup');
    }

    try {
        const { dryRun = false } = data as { dryRun?: boolean };

        const now = admin.firestore.Timestamp.now();
        const threeYearsAgo = admin.firestore.Timestamp.fromDate(new Date(now.toDate().getTime() - 1095 * 24 * 60 * 60 * 1000));
        const twoYearsAgo = admin.firestore.Timestamp.fromDate(new Date(now.toDate().getTime() - 730 * 24 * 60 * 60 * 1000));
        const fiveYearsAgo = admin.firestore.Timestamp.fromDate(new Date(now.toDate().getTime() - 1825 * 24 * 60 * 60 * 1000));

        const counts = {
            leadsPII: 0,
            leadsAnonymous: 0,
            stamps: 0,
            auditLogs: 0,
        };

        // Count documents to be deleted (without actually deleting)
        const leadsPIISnapshot = await db.collectionGroup('leads')
            .where('consentStatus', '==', 'ACTIVE')
            .where('timestamp', '<', threeYearsAgo)
            .limit(500)
            .get();
        counts.leadsPII = leadsPIISnapshot.size;

        const leadsAnonSnapshot = await db.collectionGroup('leads')
            .where('consentStatus', '==', 'WITHDRAWN')
            .where('timestamp', '<', fiveYearsAgo)
            .limit(500)
            .get();
        counts.leadsAnonymous = leadsAnonSnapshot.size;

        const stampsSnapshot = await db.collectionGroup('stamps')
            .where('timestamp', '<', twoYearsAgo)
            .limit(500)
            .get();
        counts.stamps = stampsSnapshot.size;

        const auditLogsSnapshot = await db.collectionGroup('audit_logs')
            .where('timestamp', '<', fiveYearsAgo)
            .limit(500)
            .get();
        counts.auditLogs = auditLogsSnapshot.size;

        if (!dryRun) {
            // Actually delete the documents
            for (const doc of leadsPIISnapshot.docs) {
                await doc.ref.delete();
            }
            for (const doc of leadsAnonSnapshot.docs) {
                await doc.ref.delete();
            }
            for (const doc of stampsSnapshot.docs) {
                await doc.ref.delete();
            }
            for (const doc of auditLogsSnapshot.docs) {
                await doc.ref.delete();
            }
        }

        return {
            success: true,
            dryRun: dryRun,
            counts: counts,
            total: counts.leadsPII + counts.leadsAnonymous + counts.stamps + counts.auditLogs,
        };

    } catch (error: any) {
        functions.logger.error('[Manual Data Cleanup] Failed:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to run data cleanup');
    }
});
