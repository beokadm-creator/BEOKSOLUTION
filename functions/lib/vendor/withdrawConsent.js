"use strict";
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
exports.withdrawConsentHttp = exports.withdrawConsent = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const logAuditEvent_1 = require("../audit/logAuditEvent");
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
exports.withdrawConsent = functions.https.onCall(async (data, context) => {
    var _a, _b;
    // Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to withdraw consent');
    }
    const { visitorId, conferenceId } = data;
    // Validation
    if (!visitorId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameter: visitorId');
    }
    // Verify the user can only withdraw their own consent
    if (context.auth.uid !== visitorId) {
        throw new functions.https.HttpsError('permission-denied', 'You can only withdraw your own consent');
    }
    try {
        const timestamp = admin.firestore.Timestamp.now();
        const db = admin.firestore();
        let withdrawnCount = 0;
        const maxBatchSize = 500;
        // Query all leads for this visitor
        let leadsQuery = db.collectionGroup('leads').where('visitorId', '==', visitorId);
        // Optionally filter by conference
        if (conferenceId) {
            leadsQuery = leadsQuery.where('conferenceId', '==', conferenceId);
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
        await (0, logAuditEvent_1.createAuditLogEntry)({
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
            actorEmail: (_a = context.auth.token) === null || _a === void 0 ? void 0 : _a.email,
            actorType: 'PARTICIPANT',
        });
        functions.logger.info(`[Consent Withdrawn] User ${visitorId} withdrew consent from ${withdrawnCount} leads`);
        return {
            success: true,
            withdrawnCount: withdrawnCount,
            message: `Successfully withdrew consent from ${withdrawnCount} lead(s)`
        };
    }
    catch (error) {
        functions.logger.error('[Consent Withdrawal] Failed:', error);
        // Create audit log for failure
        await (0, logAuditEvent_1.createAuditLogEntry)({
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
            actorEmail: (_b = context.auth.token) === null || _b === void 0 ? void 0 : _b.email,
            actorType: 'PARTICIPANT',
        }).catch(logError => {
            functions.logger.error('[Audit Log] Failed to create audit log:', logError);
        });
        throw new functions.https.HttpsError('internal', error.message || 'Failed to withdraw consent');
    }
});
/**
 * HTTP Endpoint for consent withdrawal (for email links)
 * Uses a token-based system for security
 */
exports.withdrawConsentHttp = functions.https.onRequest(async (req, res) => {
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
    }
    catch (error) {
        functions.logger.error('[HTTP Consent Withdrawal] Failed:', error);
        res.status(500).json({ error: error.message });
    }
});
//# sourceMappingURL=withdrawConsent.js.map