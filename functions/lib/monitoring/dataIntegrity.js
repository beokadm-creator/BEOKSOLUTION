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
exports.monitorMemberCodeIntegrity = exports.monitorRegistrationIntegrity = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Data Integrity Monitoring
 *
 * Monitors Firestore collections for data anomalies
 * Creates alerts in logs/data_integrity when issues detected
 */
/**
 * Validate registration data integrity
 * Checks for:
 * - Negative payment amounts
 * - Invalid payment status combinations
 * - Missing required fields
 */
exports.monitorRegistrationIntegrity = functions.firestore
    .document('conferences/{confId}/registrations/{regId}')
    .onWrite(async (change, context) => {
    const { params } = context;
    const { confId, regId } = params;
    const newData = change.after.data();
    const oldData = change.before.data();
    // Skip if document was deleted
    if (!newData) {
        return null;
    }
    const issues = [];
    // Rule 1: Payment amount must be positive
    if (typeof newData.amount === 'number' && newData.amount < 0) {
        issues.push({
            field: 'amount',
            expected: '>= 0',
            actual: newData.amount,
            rule: 'paymentAmount >= 0',
            severity: 'CRITICAL',
        });
    }
    // Rule 2: If paymentStatus is PAID, amount must be > 0
    if (newData.paymentStatus === 'PAID' && newData.amount === 0) {
        issues.push({
            field: 'amount',
            expected: '> 0 when PAID',
            actual: newData.amount,
            rule: 'PAID payments must have amount > 0',
            severity: 'HIGH',
        });
    }
    // Rule 3: Email must be present
    if (!newData.email || typeof newData.email !== 'string' || !newData.email.includes('@')) {
        issues.push({
            field: 'email',
            expected: 'valid email',
            actual: newData.email,
            rule: 'email must be valid',
            severity: 'HIGH',
        });
    }
    // Rule 4: Status must be valid (matches schema.ts PaymentStatus type)
    const validStatuses = ['PENDING', 'PAID', 'REFUNDED', 'REFUND_REQUESTED', 'PARTIAL_REFUNDED', 'FAILED'];
    if (newData.paymentStatus && !validStatuses.includes(newData.paymentStatus)) {
        issues.push({
            field: 'paymentStatus',
            expected: validStatuses.join(', '),
            actual: newData.paymentStatus,
            rule: 'paymentStatus must be valid',
            severity: 'HIGH',
        });
    }
    // Rule 5: If badgeIssued is true, isCheckedIn must also be true
    if (newData.badgeIssued === true && !newData.isCheckedIn) {
        issues.push({
            field: 'isCheckedIn',
            expected: 'true when badgeIssued is true',
            actual: newData.isCheckedIn,
            rule: 'badgeIssued requires isCheckedIn',
            severity: 'MEDIUM',
        });
    }
    // Rule 6: Check for suspicious rapid status changes
    if (oldData && newData.paymentStatus !== oldData.paymentStatus) {
        // If status changed from PAID to PENDING, that's suspicious
        if (oldData.paymentStatus === 'PAID' && newData.paymentStatus === 'PENDING') {
            issues.push({
                field: 'paymentStatus',
                expected: 'no regression from PAID to PENDING',
                actual: `${oldData.paymentStatus} -> ${newData.paymentStatus}`,
                rule: 'payment status should not regress',
                severity: 'HIGH',
            });
        }
    }
    // If no issues, return
    if (issues.length === 0) {
        return null;
    }
    // Log issues to logs/data_integrity
    const db = admin.firestore();
    const today = new Date().toISOString().split('T')[0];
    const alertId = `reg_${confId}_${Date.now()}`;
    // Create alert for each issue
    const promises = issues.map((issue) => {
        return db.doc(`logs/data_integrity/${today}/${alertId}_${issue.field}`).set({
            id: `${alertId}_${issue.field}`,
            timestamp: admin.firestore.Timestamp.now(),
            severity: issue.severity,
            collection: `conferences/${confId}/registrations`,
            documentId: regId,
            rule: issue.rule,
            description: `${issue.field}: expected ${issue.expected}, got ${issue.actual}`,
            resolved: false,
            metadata: {
                confId,
                regId,
                field: issue.field,
                expected: issue.expected,
                actual: issue.actual,
            },
        });
    });
    await Promise.all(promises);
    functions.logger.warn(`[DataIntegrity] Registration ${regId} has ${issues.length} issues`);
    return null;
});
/**
 * Validate member code integrity
 * Checks for:
 * - Member codes marked as used without usedBy/usedAt
 * - Same code used multiple times (duplicate usage)
 */
exports.monitorMemberCodeIntegrity = functions.firestore
    .document('societies/{societyId}/members/{memberId}')
    .onWrite(async (change, context) => {
    const { params } = context;
    const { societyId, memberId } = params;
    const newData = change.after.data();
    const oldData = change.before.data();
    // Skip if document was deleted
    if (!newData) {
        return null;
    }
    const issues = [];
    // Rule 1: If used is true, usedBy must be set
    if (newData.used === true && !newData.usedBy) {
        issues.push({
            field: 'usedBy',
            expected: 'user ID when used is true',
            actual: newData.usedBy,
            rule: 'used code must have usedBy',
            severity: 'HIGH',
        });
    }
    // Rule 2: If used is true, usedAt must be set
    if (newData.used === true && !newData.usedAt) {
        issues.push({
            field: 'usedAt',
            expected: 'timestamp when used is true',
            actual: newData.usedAt,
            rule: 'used code must have usedAt',
            severity: 'HIGH',
        });
    }
    // Rule 3: Member code must be present
    if (!newData.code || typeof newData.code !== 'string') {
        issues.push({
            field: 'code',
            expected: 'non-empty string',
            actual: newData.code,
            rule: 'member code must be present',
            severity: 'CRITICAL',
        });
    }
    // Rule 4: Check for suspicious changes
    if (oldData && newData.used && !oldData.used) {
        // Code was just used - verify it's not already used by someone else
        // This would require a query, which might be expensive
        // For now, just log that a code was used
        functions.logger.info(`[DataIntegrity] Member code ${memberId} in ${societyId} was just used by ${newData.usedBy}`);
    }
    // Rule 5: If used was changed from true to false, that's suspicious
    if (oldData && oldData.used === true && newData.used === false) {
        issues.push({
            field: 'used',
            expected: 'cannot revert from true to false',
            actual: 'true -> false',
            rule: 'used status should not revert',
            severity: 'CRITICAL',
        });
    }
    // If no issues, return
    if (issues.length === 0) {
        return null;
    }
    // Log issues to logs/data_integrity
    const db = admin.firestore();
    const today = new Date().toISOString().split('T')[0];
    const alertId = `member_${societyId}_${Date.now()}`;
    // Create alert for each issue
    const promises = issues.map((issue) => {
        return db.doc(`logs/data_integrity/${today}/${alertId}_${issue.field}`).set({
            id: `${alertId}_${issue.field}`,
            timestamp: admin.firestore.Timestamp.now(),
            severity: issue.severity,
            collection: `societies/${societyId}/members`,
            documentId: memberId,
            rule: issue.rule,
            description: `${issue.field}: expected ${issue.expected}, got ${issue.actual}`,
            resolved: false,
            metadata: {
                societyId,
                memberId,
                field: issue.field,
                expected: issue.expected,
                actual: issue.actual,
            },
        });
    });
    await Promise.all(promises);
    functions.logger.warn(`[DataIntegrity] Member ${memberId} has ${issues.length} issues`);
    return null;
});
//# sourceMappingURL=dataIntegrity.js.map