import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Resolve Data Integrity Alert
 *
 * Marks a data integrity alert as resolved
 * Admin can manually resolve alerts after fixing issues
 */
export const resolveDataIntegrityAlert = functions
    .runWith({
        enforceAppCheck: false,
        ingressSettings: 'ALLOW_ALL'
    })
    .https.onCall(async (data, context) => {
        // Auth check
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
        }

        const { alertPath } = data;

        if (!alertPath) {
            throw new functions.https.HttpsError('invalid-argument', 'alertPath is required');
        }

        try {
            const db = admin.firestore();
            const alertRef = db.doc(`logs/data_integrity/${alertPath}`);

            // Check if alert exists
            const alertDoc = await alertRef.get();
            if (!alertDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Alert not found');
            }

            // Mark as resolved
            await alertRef.update({
                resolved: true,
                resolvedAt: admin.firestore.Timestamp.now(),
                resolvedBy: context.auth.uid
            });

            functions.logger.log(`[resolveDataIntegrityAlert] Alert resolved: ${alertPath}`);

            return {
                success: true,
                message: 'Alert marked as resolved'
            };
        } catch (error: unknown) {
            functions.logger.error('[resolveDataIntegrityAlert] Failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            throw new functions.https.HttpsError('internal', errorMessage);
        }
    });
