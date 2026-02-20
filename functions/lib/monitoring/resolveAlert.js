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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDataIntegrityAlert = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Resolve Data Integrity Alert
 *
 * Marks a data integrity alert as resolved
 * Admin can manually resolve alerts after fixing issues
 */
exports.resolveDataIntegrityAlert = functions
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
    }
    catch (error) {
        functions.logger.error('[resolveDataIntegrityAlert] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        throw new functions.https.HttpsError('internal', errorMessage);
    }
});
//# sourceMappingURL=resolveAlert.js.map