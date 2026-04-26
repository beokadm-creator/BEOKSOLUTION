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
exports.logAuditEvent = void 0;
exports.createAuditLogEntry = createAuditLogEntry;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
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
exports.logAuditEvent = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    const db = admin.firestore();
    // Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to log audit events');
    }
    const { action, entityType, entityId, vendorId, conferenceId, details, result, errorMessage } = data;
    // Validation
    if (!action || !entityType || !entityId || !result) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: action, entityType, entityId, result');
    }
    try {
        const timestamp = admin.firestore.Timestamp.now();
        // Determine actor type
        let actorType = 'PARTICIPANT';
        const actorEmail = (_a = context.auth.token) === null || _a === void 0 ? void 0 : _a.email;
        // Check if super admin
        if (actorEmail === 'aaron@beoksolution.com' ||
            actorEmail === 'test@eregi.co.kr' ||
            ((_b = context.auth.token) === null || _b === void 0 ? void 0 : _b.admin) === true) {
            actorType = 'SUPER_ADMIN';
        }
        else if (vendorId) {
            // Check if vendor admin
            const vendorSnap = await db.collection('vendors').doc(vendorId).get();
            if (vendorSnap.exists && ((_c = vendorSnap.data()) === null || _c === void 0 ? void 0 : _c.adminEmail) === actorEmail) {
                actorType = 'VENDOR_ADMIN';
            }
        }
        const logEntry = {
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
    }
    catch (error) {
        functions.logger.error('[AuditLog] Failed to create audit log:', error);
        // Don't throw - audit logging should not block operations
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create audit log',
        };
    }
});
/**
 * Helper function to mask PII in details
 */
function maskPII(details) {
    const masked = { ...details };
    // Mask phone numbers
    if (masked.phone && typeof masked.phone === 'string') {
        masked.phone = masked.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }
    // Mask email addresses (keep first 2 chars and domain)
    if (masked.email && typeof masked.email === 'string') {
        const email = masked.email;
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
        masked.visitorPhone = masked.visitorPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }
    // Mask visitor email
    if (masked.visitorEmail && typeof masked.visitorEmail === 'string') {
        const email = masked.visitorEmail;
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
async function createAuditLogEntry(params) {
    const db = admin.firestore();
    const { action, entityType, entityId, vendorId, conferenceId, details, result, errorMessage, actorId = 'system', actorEmail, actorType = 'SYSTEM', } = params;
    const timestamp = admin.firestore.Timestamp.now();
    const logEntry = {
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
//# sourceMappingURL=logAuditEvent.js.map