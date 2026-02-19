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
exports.generateFirebaseAuthUserForExternalAttendee = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Generate Firebase Auth User for External Attendee
 * - Creates Auth User with email/password
 * - Updates External Attendee doc with real UID
 * - Returns success and UID
 */
exports.generateFirebaseAuthUserForExternalAttendee = functions
    .runWith({
    enforceAppCheck: false,
    ingressSettings: 'ALLOW_ALL'
})
    .https.onCall(async (data, context) => {
    // 1. Guard: Check if requester is Authenticated (Admin)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { confId, externalId, password, email, name, phone, organization, licenseNumber } = data;
    if (!confId || !externalId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing confId or externalId');
    }
    try {
        const db = admin.firestore();
        const auth = admin.auth();
        // Fetch External Attendee Doc if details not provided
        let attendeeData = { email, name, phone, organization, licenseNumber, password };
        const attendeeRef = db.collection(`conferences/${confId}/external_attendees`).doc(externalId);
        if (!email) {
            const snap = await attendeeRef.get();
            if (!snap.exists) {
                throw new functions.https.HttpsError('not-found', 'Attendee not found');
            }
            const docData = snap.data();
            attendeeData = {
                email: docData === null || docData === void 0 ? void 0 : docData.email,
                name: docData === null || docData === void 0 ? void 0 : docData.name,
                phone: docData === null || docData === void 0 ? void 0 : docData.phone,
                organization: docData === null || docData === void 0 ? void 0 : docData.organization,
                licenseNumber: docData === null || docData === void 0 ? void 0 : docData.licenseNumber,
                password: password || (docData === null || docData === void 0 ? void 0 : docData.password)
            };
        }
        if (!attendeeData.email || !attendeeData.password) {
            throw new functions.https.HttpsError('invalid-argument', 'Email and Password are required for Account Creation');
        }
        // 1. Create or Get Auth User
        let uid = '';
        let isNew = false;
        try {
            const userRecord = await auth.getUserByEmail(attendeeData.email);
            uid = userRecord.uid;
            functions.logger.info(`[ExternalAuth] User already exists: ${uid}`);
        }
        catch (e) {
            if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'auth/user-not-found') {
                // Create new user
                const userRecord = await auth.createUser({
                    email: attendeeData.email,
                    password: attendeeData.password,
                    displayName: attendeeData.name,
                    emailVerified: true // Auto-verify external attendees? Maybe.
                });
                uid = userRecord.uid;
                isNew = true;
                functions.logger.info(`[ExternalAuth] Created new user: ${uid}`);
            }
            else {
                throw e;
            }
        }
        // 2. Create User Document in /users/{uid} (For User Hub access)
        const userRef = db.collection('users').doc(uid);
        await userRef.set({
            uid,
            email: attendeeData.email,
            name: attendeeData.name,
            phone: attendeeData.phone,
            affiliation: attendeeData.organization,
            organization: attendeeData.organization,
            licenseNumber: attendeeData.licenseNumber || '',
            tier: 'EXTERNAL', // Special Tier
            isAnonymous: false,
            country: 'KR',
            authStatus: {
                emailVerified: true,
                phoneVerified: false
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // 3. Update External Attendee Doc with Real UID
        await attendeeRef.update({
            userId: uid,
            authCreated: true,
            authCreatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // 4. Create Participation Record (For accessing the conference)
        // This is CRITICAL for "Normal Course Taking System"
        await db.collection('users').doc(uid).collection('participations').doc(externalId).set({
            conferenceId: confId,
            registrationId: externalId,
            role: 'ATTENDEE',
            type: 'EXTERNAL',
            registeredAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'COMPLETED'
        }, { merge: true });
        return { success: true, uid, message: isNew ? 'Created new account' : 'Linked existing account' };
    }
    catch (error) {
        functions.logger.error("Error in generateFirebaseAuthUserForExternalAttendee:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        throw new functions.https.HttpsError('internal', errorMessage);
    }
});
//# sourceMappingURL=external.js.map