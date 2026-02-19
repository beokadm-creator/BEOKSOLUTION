import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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

export const migrateRegistrationsForOptionsCallable = functions
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

    } catch (error) {
      console.error('Migration failed:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Migration failed'
      );
    }
  });
