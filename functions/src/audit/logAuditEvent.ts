import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Types (duplicated for Cloud Functions environment)
export type AuditAction =
  | 'LEAD_CREATED'
  | 'LEAD_VIEWED'
  | 'LEAD_EXPORTED'
  | 'LEAD_DELETED'
  | 'STAMP_CREATED'
  | 'ALIMTALK_SENT'
  | 'ALIMTALK_FAILED'
  | 'CONSENT_GIVEN'
  | 'CONSENT_WITHDRAWN'
  | 'GUESTBOOK_SIGN'
  | 'VENDOR_LOGIN'
  | 'VENDOR_SETTINGS_CHANGED';

export type AuditActorType = 'VENDOR_ADMIN' | 'SYSTEM' | 'PARTICIPANT' | 'SUPER_ADMIN';

export type AuditEntityType = 'LEAD' | 'STAMP' | 'ALIMTALK' | 'CONSENT' | 'VENDOR' | 'GUESTBOOK';

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail?: string;
  actorType: AuditActorType;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  vendorId?: string;
  conferenceId?: string;
  details: Record<string, unknown>;
  result: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
  timestamp: admin.firestore.Timestamp;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Cloud Function: logAuditEvent
 *
 * Creates audit log entries for vendor operations.
 * Stores logs in both global audit_logs collection and vendor-scoped subcollection.
 *
 * Parameters:
 * - action: AuditAction - The action being logged
 * - entityType: AuditEntityType - Type of entity involved
 * - entityId: string - ID of the entity
 * - vendorId?: string - Vendor ID (for vendor-scoped operations)
 * - conferenceId?: string - Conference ID context
 * - details: Record<string, unknown> - Additional details (PII should be masked)
 * - result: 'SUCCESS' | 'FAILURE' - Result of the action
 * - errorMessage?: string - Error message if failed
 */
export const logAuditEvent = functions.https.onCall(async (data, context) => {
    const db = admin.firestore();
    // Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to log audit events'
        );
    }

    const {
        action,
        entityType,
        entityId,
        vendorId,
        conferenceId,
        details,
        result,
        errorMessage
    } = data as {
        action: AuditAction;
        entityType: AuditEntityType;
        entityId: string;
        vendorId?: string;
        conferenceId?: string;
        details: Record<string, unknown>;
        result: 'SUCCESS' | 'FAILURE';
        errorMessage?: string;
    };

    // Validation
    if (!action || !entityType || !entityId || !result) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Missing required parameters: action, entityType, entityId, result'
        );
    }

    try {
        const timestamp = admin.firestore.Timestamp.now();

        // Determine actor type
        let actorType: AuditActorType = 'PARTICIPANT';
        const actorEmail = context.auth.token?.email;

        // Check if super admin
        if (actorEmail === 'aaron@beoksolution.com' ||
            actorEmail === 'test@eregi.co.kr' ||
            context.auth.token?.admin === true) {
            actorType = 'SUPER_ADMIN';
        } else if (vendorId) {
            // Check if vendor admin
            const vendorSnap = await db.collection('vendors').doc(vendorId).get();
            if (vendorSnap.exists && vendorSnap.data()?.adminEmail === actorEmail) {
                actorType = 'VENDOR_ADMIN';
            }
        }

        const logEntry: Omit<AuditLog, 'id'> = {
            actorId: context.auth.uid,
            actorEmail: actorEmail || undefined,
            actorType,
            action,
            entityType,
            entityId,
            vendorId,
            conferenceId,
            details: maskPII(details),
            result,
            errorMessage,
            timestamp,
        };

        const batch = db.batch();

        // 1. Store in global audit_logs (for super admin)
        const globalLogRef = db.collection('audit_logs').doc();
        batch.set(globalLogRef, { ...logEntry, id: globalLogRef.id });

        // 2. Store in vendor-scoped audit_logs (if vendorId provided)
        if (vendorId) {
            const vendorLogRef = db
                .collection('vendors')
                .doc(vendorId)
                .collection('audit_logs')
                .doc();
            batch.set(vendorLogRef, { ...logEntry, id: vendorLogRef.id });
        }

        await batch.commit();

        functions.logger.info(`[AuditLog] ${action} by ${actorType} (${context.auth.uid}) on ${entityType}/${entityId}`);

        return {
            success: true,
            logId: globalLogRef.id,
        };

    } catch (error: any) {
        functions.logger.error('[AuditLog] Failed to create audit log:', error);
        // Don't throw - audit logging should not block operations
        return {
            success: false,
            error: error.message || 'Failed to create audit log',
        };
    }
});

/**
 * Helper function to mask PII in details
 */
function maskPII(details: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...details };

    // Mask phone numbers
    if (masked.phone && typeof masked.phone === 'string') {
        masked.phone = (masked.phone as string).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }

    // Mask email addresses (keep first 2 chars and domain)
    if (masked.email && typeof masked.email === 'string') {
        const email = masked.email as string;
        const [local, domain] = email.split('@');
        if (local && domain) {
            const maskedLocal = local.length > 2
                ? local.substring(0, 2) + '***'
                : '***';
            masked.email = `${maskedLocal}@${domain}`;
        }
    }

    // Mask visitor phone
    if (masked.visitorPhone && typeof masked.visitorPhone === 'string') {
        masked.visitorPhone = (masked.visitorPhone as string).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }

    // Mask visitor email
    if (masked.visitorEmail && typeof masked.visitorEmail === 'string') {
        const email = masked.visitorEmail as string;
        const [local, domain] = email.split('@');
        if (local && domain) {
            const maskedLocal = local.length > 2
                ? local.substring(0, 2) + '***'
                : '***';
            masked.visitorEmail = `${maskedLocal}@${domain}`;
        }
    }

    return masked;
}

/**
 * Utility function to create audit logs from other Cloud Functions
 * (for internal use without HTTPS call)
 */
export async function createAuditLogEntry(params: {
    action: AuditAction;
    entityType: AuditEntityType;
    entityId: string;
    vendorId?: string;
    conferenceId?: string;
    details: Record<string, unknown>;
    result: 'SUCCESS' | 'FAILURE';
    errorMessage?: string;
    actorId?: string;
    actorEmail?: string;
    actorType?: AuditActorType;
}): Promise<void> {
    const db = admin.firestore();
    const {
        action,
        entityType,
        entityId,
        vendorId,
        conferenceId,
        details,
        result,
        errorMessage,
        actorId = 'system',
        actorEmail,
        actorType = 'SYSTEM',
    } = params;

    const timestamp = admin.firestore.Timestamp.now();

    const logEntry: Omit<AuditLog, 'id'> = {
        actorId,
        actorEmail,
        actorType,
        action,
        entityType,
        entityId,
        vendorId,
        conferenceId,
        details: maskPII(details),
        result,
        errorMessage,
        timestamp,
    };

    const batch = db.batch();

    // Store in global audit_logs
    const globalLogRef = db.collection('audit_logs').doc();
    batch.set(globalLogRef, { ...logEntry, id: globalLogRef.id });

    // Store in vendor-scoped audit_logs
    if (vendorId) {
        const vendorLogRef = db
            .collection('vendors')
            .doc(vendorId)
            .collection('audit_logs')
            .doc();
        batch.set(vendorLogRef, { ...logEntry, id: vendorLogRef.id });
    }

    await batch.commit();
    functions.logger.info(`[AuditLog] ${action} by ${actorType} on ${entityType}/${entityId}`);
}
