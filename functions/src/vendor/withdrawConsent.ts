import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createAuditLogEntry } from '../audit/logAuditEvent';

const db = admin.firestore();

/**
 * Cloud Function: withdrawConsent
 *
 * Allows a participant to withdraw their consent for PII storage.
 * Masks all PII data in leads for the given visitorId across all vendors.
 *
 * Parameters:
 * - visitorId: string - User ID or registration ID
 * - conferenceId: string (optional) - Limit withdrawal to specific conference
 *
 * Returns:
 * - success: boolean
 * - withdrawnCount: number - Number of leads updated
 * - error?: string
 */
export const withdrawConsent = functions.https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to withdraw consent'
        );
    }

    const { visitorId, conferenceId } = data as {
        visitorId: string;
        conferenceId?: string;
    };

    // Validation
    if (!visitorId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Missing required parameter: visitorId'
        );
    }

    // Verify the user can only withdraw their own consent
    if (context.auth.uid !== visitorId) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'You can only withdraw your own consent'
        );
    }

    try {
        const timestamp = admin.firestore.Timestamp.now();
        let withdrawnCount = 0;
        const maxBatchSize = 500;

        // Query all leads for this visitor
        let leadsQuery = db.collectionGroup('leads').where('visitorId', '==', visitorId);

        // Optionally filter by conference
        if (conferenceId) {
            leadsQuery = leadsQuery.where('conferenceId', '==', conferenceId) as any;
        }

        const leadsSnapshot = await leadsQuery.get();

        if (leadsSnapshot.empty) {
            return {
                success: true,
                withdrawnCount: 0,
                message: 'No leads found for this visitor'
            };
        }

        // Process leads in batches
        let batch = db.batch();
        let batchCount = 0;

        for (const leadDoc of leadsSnapshot.docs) {
            const leadData = leadDoc.data();

            // Skip if already withdrawn
            if (leadData.consentStatus === 'WITHDRAWN') {
                continue;
            }

            // Mask PII data
            batch.update(leadDoc.ref, {
                visitorName: 'Anonymous (동의 철회)',
                visitorOrg: admin.firestore.FieldValue.delete(),
                visitorPhone: admin.firestore.FieldValue.delete(),
                visitorEmail: admin.firestore.FieldValue.delete(),
                isConsentAgreed: false,
                consentStatus: 'WITHDRAWN',
                consentWithdrawnAt: timestamp,
                updatedAt: timestamp
            });

            withdrawnCount++;
            batchCount++;

            // Commit batch when reaching limit
            if (batchCount >= maxBatchSize) {
                await batch.commit();
                batch = db.batch(); // Start new batch
                batchCount = 0;
            }
        }

        // Commit any remaining updates
        if (batchCount > 0) {
            await batch.commit();
        }

        // Create audit log
        await createAuditLogEntry({
            action: 'CONSENT_WITHDRAWN',
            entityType: 'CONSENT',
            entityId: visitorId,
            conferenceId: conferenceId,
            details: {
                visitorId: visitorId,
                withdrawnCount: withdrawnCount,
                scope: conferenceId ? 'conference' : 'all'
            },
            result: 'SUCCESS',
            actorId: context.auth.uid,
            actorEmail: context.auth.token?.email,
            actorType: 'PARTICIPANT',
        });

        functions.logger.info(`[Consent Withdrawn] User ${visitorId} withdrew consent from ${withdrawnCount} leads`);

        return {
            success: true,
            withdrawnCount: withdrawnCount,
            message: `Successfully withdrew consent from ${withdrawnCount} lead(s)`
        };

    } catch (error: any) {
        functions.logger.error('[Consent Withdrawal] Failed:', error);

        // Create audit log for failure
        await createAuditLogEntry({
            action: 'CONSENT_WITHDRAWN',
            entityType: 'CONSENT',
            entityId: visitorId,
            details: {
                visitorId: visitorId,
                error: error.message
            },
            result: 'FAILURE',
            errorMessage: error.message,
            actorId: context.auth.uid,
            actorEmail: context.auth.token?.email,
            actorType: 'PARTICIPANT',
        }).catch(logError => {
            functions.logger.error('[Audit Log] Failed to create audit log:', logError);
        });

        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Failed to withdraw consent'
        );
    }
});

/**
 * HTTP Endpoint for consent withdrawal (for email links)
 * Uses a token-based system for security
 */
export const withdrawConsentHttp = functions.https.onRequest(async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { token, visitorId } = req.body;

    // Validate token (you should implement a proper token verification system)
    // For now, this is a placeholder - implement proper JWT verification
    if (!token || !visitorId) {
        res.status(400).json({ error: 'Missing token or visitorId' });
        return;
    }

    try {
        // TODO: Verify JWT token and extract visitorId
        // const decoded = await admin.auth().verifyIdToken(token);
        // if (decoded.uid !== visitorId) {
        //     res.status(403).json({ error: 'Invalid token' });
        //     return;
        // }

        // For now, return not implemented
        // In production, implement proper token verification
        res.status(501).json({ error: 'Not implemented - use callable function' });

    } catch (error: any) {
        functions.logger.error('[HTTP Consent Withdrawal] Failed:', error);
        res.status(500).json({ error: error.message });
    }
});
