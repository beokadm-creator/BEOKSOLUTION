import * as functions from 'firebase-functions';
import { NotificationService } from '../services/notificationService';

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
            return {
                success: true,
                messageId: result.messageId,
                provider: result.provider,
            };
        } else {
            throw new functions.https.HttpsError(
                'internal',
                result.error || 'Failed to send AlimTalk'
            );
        }
    } catch (error: any) {
        functions.logger.error('Error sending vendor AlimTalk:', error);
        throw new functions.https.HttpsError(
            'internal',
            error.message || 'Failed to send AlimTalk'
        );
    }
});
