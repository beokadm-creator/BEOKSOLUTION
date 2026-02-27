const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin (adjust the credential path as necessary, or rely on application default credentials if authenticated via gcloud)
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

if (serviceAccountPath) {
    admin.initializeApp({
        credential: admin.credential.cert(require(path.resolve(serviceAccountPath)))
    });
} else {
    // Try default initialization if env var is missing but running via npx firebase-admin or similar
    admin.initializeApp();
}

const db = admin.firestore();

async function extendTokenExpiry() {
    console.log('Starting token expiry extension script...');

    try {
        // 1. Get all conferences that are not yet completely past the expiration window
        // For simplicity and safety, we can process all active tokens across all conferences

        // As a more robust query, let's find all active/issued tokens that expire within the next few days or recently expired
        // We'll just iterate over conferences and their badge_tokens

        const conferencesSnap = await db.collection('conferences').get();

        let totalUpdated = 0;

        for (const confDoc of conferencesSnap.docs) {
            const confId = confDoc.id;
            const confData = confDoc.data();

            console.log(`Processing conference: ${confId}`);

            // Calculate the new expiry based on the conference end date (48 hours later)
            let newExpiresAtMillis = 0;
            if (confData.dates && confData.dates.end) {
                newExpiresAtMillis = confData.dates.end.toMillis() + (48 * 60 * 60 * 1000);
            } else {
                console.log(`  Skipping ${confId}: No end date found in conference data.`);
                continue;
            }

            const newExpiresAt = admin.firestore.Timestamp.fromMillis(newExpiresAtMillis);

            // Get all tokens for this conference
            const tokensRef = db.collection(`conferences/${confId}/badge_tokens`);
            // We process ACTIVE and ISSUED tokens
            // We avoid touching EXPIRED ones unless they just expired within the 24->48h gap

            const nowMillis = admin.firestore.Timestamp.now().toMillis();
            const tokensSnap = await tokensRef.get();

            let confUpdateCount = 0;

            // Batch updates
            let batch = db.batch();
            let operations = 0;

            for (const tokenDoc of tokensSnap.docs) {
                const tokenData = tokenDoc.data();

                // Only update if current expiresAt is less than the new 48h expiresAt
                // And don't resurrect tokens that were explicitly revoked or manually expired way before
                // Basically we want to target tokens expiring roughly around the 24h mark (the old buggy logic)

                if (tokenData.expiresAt && tokenData.expiresAt.toMillis() < newExpiresAtMillis) {

                    // If token status is EXPIRED but it was expired because of the 24h rule
                    // we should resurrect it back to ACTIVE if it's within the new 48h limit.
                    let newStatus = tokenData.status;

                    if (newStatus === 'EXPIRED') {
                        // If the current time is still within the new 48h limit, bring it back to ACTIVE
                        if (nowMillis < newExpiresAtMillis) {
                            newStatus = 'ACTIVE';
                        }
                    }

                    batch.update(tokenDoc.ref, {
                        expiresAt: newExpiresAt,
                        status: newStatus,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    operations++;
                    confUpdateCount++;

                    // Commit batch every 400 operations
                    if (operations >= 400) {
                        await batch.commit();
                        console.log(`  Committed ${operations} updates for ${confId}...`);
                        batch = db.batch();
                        operations = 0;
                    }
                }
            }

            if (operations > 0) {
                await batch.commit();
                console.log(`  Committed final ${operations} updates for ${confId}...`);
            }

            console.log(`  Updated ${confUpdateCount} tokens for conference ${confId}`);
            totalUpdated += confUpdateCount;
        }

        console.log(`\nSuccess! Updated a total of ${totalUpdated} badge tokens.`);

    } catch (error) {
        console.error('Error in script:', error);
    } finally {
        process.exit(0);
    }
}

extendTokenExpiry();
