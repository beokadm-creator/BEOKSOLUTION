import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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
export const monitorRegistrationIntegrity = functions.firestore
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

        const issues: Array<{
            field: string;
            expected: any;
            actual: any;
            rule: string;
            severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        }> = [];

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

        // Rule 4: Status must be valid
        const validStatuses = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'];
        if (!validStatuses.includes(newData.paymentStatus)) {
            issues.push({
                field: 'paymentStatus',
                expected: validStatuses.join(', '),
                actual: newData.paymentStatus,
                rule: 'paymentStatus must be valid',
                severity: 'HIGH',
            });
        }

        // Rule 5: If badgeIssured is true, isCheckedIn must also be true
        if (newData.badgeIssued === true && !newData.isCheckedIn) {
            issues.push({
                field: 'isCheckedIn',
                expected: 'true when badgeIssured is true',
                actual: newData.isCheckedIn,
                rule: 'badgeIssured requires isCheckedIn',
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
        const alertId = `integrity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create alert for each issue
        const promises = issues.map((issue) => {
            return db.doc(`logs/data_integrity/${today}/${alertId}_${issue.field}`).set({
                id: `${alertId}_${issue.field}`,
                timestamp: admin.firestore.Timestamp.now(),
                severity: issue.severity,
                collection: `conferences/${confId}/registrations`,
                documentId: regId,
                field: issue.field,
                expectedValue: issue.expected,
                actualValue: issue.actual,
                rule: issue.rule,
                detectedBy: 'TRIGGER',
                resolved: false,
                alertSent: false,
                metadata: {
                    confId,
                    regId,
                    newData: { ...newData },
                    oldData: oldData ? { ...oldData } : null,
                },
            });
        });

        await Promise.all(promises);

        functions.logger.warn(`Data integrity issues detected in registration ${regId}:`, issues);
        return null;
    });

/**
 * Monitor member code usage integrity
 * Checks for:
 * - Duplicate usage of same member code
 * - Member code used without proper locking
 */
export const monitorMemberCodeIntegrity = functions.firestore
    .document('societies/{societyId}/members/{memberCode}')
    .onWrite(async (change, context) => {
        const { params } = context;
        const { societyId, memberCode } = params;

        const newData = change.after.data();
        const oldData = change.before.data();

        // Skip if document was deleted
        if (!newData) {
            return null;
        }

        const issues: Array<{
            field: string;
            expected: any;
            actual: any;
            rule: string;
            severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        }> = [];

        // Rule 1: If used is true, usedBy must be set
        if (newData.used === true && !newData.usedBy) {
            issues.push({
                field: 'usedBy',
                expected: 'userId when used is true',
                actual: newData.usedBy,
                rule: 'used member code must have usedBy',
                severity: 'HIGH',
            });
        }

        // Rule 2: If used is false, usedBy should be null
        if (newData.used === false && newData.usedBy) {
            issues.push({
                field: 'usedBy',
                expected: 'null when used is false',
                actual: newData.usedBy,
                rule: 'unused member code should not have usedBy',
                severity: 'MEDIUM',
            });
        }

        // Rule 3: Check for suspicious reuse (used changed from true to false with different usedBy)
        if (oldData && oldData.used === true && newData.used === false) {
            // This is OK if explicitly reset by admin
            // But log it for awareness
            issues.push({
                field: 'used',
                expected: 'no change from true to false without admin action',
                actual: 'true -> false',
                rule: 'member code reset',
                severity: 'LOW',
            });
        }

        // If no issues, return
        if (issues.length === 0) {
            return null;
        }

        // Log issues
        const db = admin.firestore();
        const today = new Date().toISOString().split('T')[0];
        const alertId = `integrity_member_${Date.now()}`;

        const promises = issues.map((issue) => {
            return db.doc(`logs/data_integrity/${today}/${alertId}_${issue.field}`).set({
                id: `${alertId}_${issue.field}`,
                timestamp: admin.firestore.Timestamp.now(),
                severity: issue.severity,
                collection: `societies/${societyId}/members`,
                documentId: memberCode,
                field: issue.field,
                expectedValue: issue.expected,
                actualValue: issue.actual,
                rule: issue.rule,
                detectedBy: 'TRIGGER',
                resolved: false,
                alertSent: false,
                metadata: {
                    societyId,
                    memberCode,
                    newData: { ...newData },
                    oldData: oldData ? { ...oldData } : null,
                },
            });
        });

        await Promise.all(promises);

        functions.logger.warn(`Member code integrity issues detected in ${memberCode}:`, issues);
        return null;
    });
