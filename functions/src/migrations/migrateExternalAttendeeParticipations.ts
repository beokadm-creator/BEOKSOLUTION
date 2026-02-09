import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/**
 * Migration Script: Fix External Attendee Participation Records
 *
 * This script updates existing external attendee participation records
 * to include all fields required by UserHubPage for proper display.
 *
 * Run this ONCE after deploying the updated generateFirebaseAuthUserForExternalAttendee function.
 */

export const migrateExternalAttendeeParticipations = functions
    .runWith({
        timeoutSeconds: 540,
        memory: '1GB'
    })
    .https.onCall(async (data, context) => {
        // Admin-only function
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
        }

        const { confId, dryRun = true } = data;

        if (!confId) {
            throw new functions.https.HttpsError('invalid-argument', 'confId is required');
        }

        const db = admin.firestore();
        const results = {
            total: 0,
            updated: 0,
            skipped: 0,
            errors: [] as string[]
        };

        try {
            // 1. Fetch conference data
            const confDoc = await db.collection('conferences').doc(confId).get();
            if (!confDoc.exists) {
                throw new functions.https.HttpsError('not-found', `Conference ${confId} not found`);
            }
            const confData = confDoc.data();

            // 2. Fetch all external attendees for this conference
            const externalAttendeesSnap = await db
                .collection(`conferences/${confId}/external_attendees`)
                .where('deleted', '==', false)
                .get();

            results.total = externalAttendeesSnap.size;
            functions.logger.info(`Found ${results.total} external attendees for ${confId}`);

            // 3. Process each external attendee
            for (const attendeeDoc of externalAttendeesSnap.docs) {
                const attendee = attendeeDoc.data();

                // Skip if no userId (account not created yet)
                if (!attendee.userId || attendee.userId.startsWith('EXT-')) {
                    results.skipped++;
                    continue;
                }

                try {
                    // Check if participation record exists
                    const participationRef = db
                        .collection('users')
                        .doc(attendee.userId)
                        .collection('participations')
                        .doc(attendee.id);

                    await participationRef.get();

                    // Prepare complete participation data
                    const participationData = {
                        // Core identification
                        conferenceId: confId,
                        registrationId: attendee.id,
                        slug: confData?.slug || confId,
                        conferenceSlug: confData?.slug || confId,

                        // Society information
                        societyId: confData?.societyId || 'kadd',
                        societyName: confData?.societyName || '',

                        // Conference details for display
                        conferenceName: confData?.title?.ko || confData?.title?.en || confData?.title || confId,

                        // User information
                        userName: attendee.name,
                        userId: attendee.userId,

                        // Registration metadata
                        role: 'ATTENDEE',
                        type: 'EXTERNAL',
                        registeredAt: attendee.createdAt || admin.firestore.FieldValue.serverTimestamp(),
                        createdAt: attendee.createdAt || admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),

                        // Payment status
                        status: 'PAID',
                        paymentStatus: 'PAID',

                        // Additional metadata
                        earnedPoints: 0,
                        amount: attendee.amount || 0
                    };

                    if (!dryRun) {
                        await participationRef.set(participationData, { merge: true });
                        functions.logger.info(`Updated participation for ${attendee.name} (${attendee.userId})`);
                    } else {
                        functions.logger.info(`[DRY RUN] Would update participation for ${attendee.name} (${attendee.userId})`);
                    }

                    results.updated++;
                } catch (error) {
                    const errorMsg = `Error processing ${attendee.name}: ${error instanceof Error ? error.message : String(error)}`;
                    functions.logger.error(errorMsg);
                    results.errors.push(errorMsg);
                }
            }

            return {
                success: true,
                dryRun,
                results,
                message: dryRun
                    ? `DRY RUN: Would update ${results.updated} participation records`
                    : `Successfully updated ${results.updated} participation records`
            };

        } catch (error) {
            functions.logger.error('Migration failed:', error);
            throw new functions.https.HttpsError(
                'internal',
                `Migration failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    });
