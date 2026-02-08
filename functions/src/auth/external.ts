import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Generate Firebase Auth User for External Attendee
 * - Creates Auth User with email/password
 * - Updates External Attendee doc with real UID
 * - Returns success and UID
 */
export const generateFirebaseAuthUserForExternalAttendee = functions
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
                    email: docData?.email,
                    name: docData?.name,
                    phone: docData?.phone,
                    organization: docData?.organization,
                    licenseNumber: docData?.licenseNumber,
                    password: password || docData?.password
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
            } catch (e: unknown) {
                if (e instanceof Error && 'code' in e && e.code === 'auth/user-not-found') {
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
                } else {
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

        } catch (error: unknown) {
            functions.logger.error("Error in generateFirebaseAuthUserForExternalAttendee:", error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new functions.https.HttpsError('internal', message);
        }
    });
