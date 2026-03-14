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
exports.sendVendorAlimTalk = void 0;
const functions = __importStar(require("firebase-functions"));
const notificationService_1 = require("../services/notificationService");
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
exports.sendVendorAlimTalk = functions.https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send AlimTalk');
    }
    const { vendorId, phone, templateCode, variables } = data;
    // Validation
    if (!vendorId || !phone || !templateCode || !variables) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: vendorId, phone, templateCode, variables');
    }
    try {
        const notificationService = notificationService_1.NotificationService.getInstance();
        const result = await notificationService.sendAlimTalk({
            phone,
            templateCode,
            variables,
        }, vendorId, 'vendor' // entityType
        );
        if (result.success) {
            return {
                success: true,
                messageId: result.messageId,
                provider: result.provider,
            };
        }
        else {
            throw new functions.https.HttpsError('internal', result.error || 'Failed to send AlimTalk');
        }
    }
    catch (error) {
        functions.logger.error('Error sending vendor AlimTalk:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to send AlimTalk');
    }
});
//# sourceMappingURL=sendAlimTalk.js.map