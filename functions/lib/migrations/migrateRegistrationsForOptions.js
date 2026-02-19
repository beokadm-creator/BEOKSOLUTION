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
exports.migrateRegistrationsForOptionsCallable = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Migration Script: Add baseAmount and optionsTotal fields to existing registrations
 *
 * This script migrates existing registration documents to support the new optional add-ons feature.
 * For existing registrations (which had no options):
 * - baseAmount = amount (the current total, which was all base fee)
 * - optionsTotal = 0 (no options were selected)
 *
 * Usage:
 * 1. Deploy this function: firebase deploy --only functions:migrateRegistrationsForOptionsCallable
 * 2. Call from client: httpsCallable(functions, 'migrateRegistrationsForOptionsCallable')({})
 */
exports.migrateRegistrationsForOptionsCallable = functions
    .runWith({
    memory: '1GB',
    timeoutSeconds: 540,
})
    .https.onCall(async (data, context) => {
    // Only allow super admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const adminEmail = context.auth.token.email;
    if (adminEmail !== 'aaron@beoksolution.com') {
        throw new functions.https.HttpsError('permission-denied', 'Must be super admin');
    }
    const db = admin.firestore();
    const BATCH_SIZE = 500;
    let totalProcessed = 0;
    let totalSkipped = 0;
    try {
        const registrationsSnapshot = await db.collectionGroup('registrations').get();
        console.log(`Found ${registrationsSnapshot.size} registrations to migrate`);
        for (let i = 0; i < registrationsSnapshot.docs.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = registrationsSnapshot.docs.slice(i, i + BATCH_SIZE);
            for (const doc of chunk) {
                const docData = doc.data();
                // Skip if already migrated
                if (docData.baseAmount !== undefined && docData.optionsTotal !== undefined) {
                    totalSkipped++;
                    continue;
                }
                const currentAmount = docData.amount || 0;
                batch.update(doc.ref, {
                    baseAmount: currentAmount,
                    optionsTotal: 0,
                    options: docData.options || [],
                    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                totalProcessed++;
            }
            await batch.commit();
            console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
        }
        return {
            success: true,
            totalFound: registrationsSnapshot.size,
            totalProcessed,
            totalSkipped,
            timestamp: new Date().toISOString(),
        };
    }
    catch (error) {
        console.error('Migration failed:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Migration failed');
    }
});
//# sourceMappingURL=migrateRegistrationsForOptions.js.map