import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { NotificationService } from '../services/notificationService';
import { createAuditLogEntry } from '../audit/logAuditEvent';
import { assertVendorActor } from './shared';

/**
 * Cloud Function: sendVendorAlimTalk
 *
 * Description: Sends AlimTalk notification for vendor booth visits
 *
 * Parameters:
 * - vendorId: string - Vendor ID
 * - phone: string - Recipient phone number
 * - templateCode: string - AlimTalk template code
 * - variables: Record<string, string> - Template variables
 *
 * Returns:
 * - success: boolean
 * - messageId?: string
 * - error?: string
 */
export const sendVendorAlimTalk = functions.https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to send AlimTalk'
        );
    }

    const { vendorId, phone, templateCode, variables } = data;

    // Validation
    if (!vendorId || !phone || !templateCode || !variables) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Missing required parameters: vendorId, phone, templateCode, variables'
        );
    }

    try {
        const db = admin.firestore();
        await assertVendorActor(db, vendorId, context.auth);

        const notificationService = NotificationService.getInstance();

        const result = await notificationService.sendAlimTalk(
            {
                phone,
                templateCode,
                variables,
            },
            vendorId,
            'vendor' // entityType
        );

        if (result.success) {
            // Create audit log for successful AlimTalk
            await createAuditLogEntry({
                action: 'ALIMTALK_SENT',
                entityType: 'ALIMTALK',
                entityId: result.messageId || 'unknown',
                vendorId: vendorId,
                conferenceId: variables.eventName || undefined,
                details: {
                    phone: phone,
                    templateCode: templateCode,
                    visitorName: variables.visitorName,
                },
                result: 'SUCCESS',
                actorId: context.auth.uid,
                actorEmail: context.auth.token?.email,
                actorType: 'VENDOR_ADMIN',
            });

            return {
                success: true,
                messageId: result.messageId,
                provider: result.provider,
            };
        } else {
            // Create audit log for failed AlimTalk
            await createAuditLogEntry({
                action: 'ALIMTALK_FAILED',
                entityType: 'ALIMTALK',
                entityId: 'failed',
                vendorId: vendorId,
                conferenceId: variables.eventName || undefined,
                details: {
                    phone: phone,
                    templateCode: templateCode,
                    visitorName: variables.visitorName,
                },
                result: 'FAILURE',
                errorMessage: result.error || 'Failed to send AlimTalk',
                actorId: context.auth.uid,
                actorEmail: context.auth.token?.email,
                actorType: 'VENDOR_ADMIN',
            });

            throw new functions.https.HttpsError(
                'internal',
                result.error || 'Failed to send AlimTalk'
            );
        }
    } catch (error: unknown) {
        functions.logger.error('Error sending vendor AlimTalk:', error);
        throw new functions.https.HttpsError(
            'internal',
            error instanceof Error ? error.message : 'Failed to send AlimTalk'
        );
    }
});
