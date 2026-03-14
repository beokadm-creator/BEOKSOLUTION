
const admin = require('firebase-admin');

// Using the project ID found in .env
admin.initializeApp({
    projectId: 'eregi-8fc1e'
});

const db = admin.firestore();

async function updateRegistration() {
    const cid = 'kadd_2026spring';
    const targetUid = '26CSwlTJDTPUVctcAyvYXJpem733';

    console.log(`Searching for registration with userId: ${targetUid}...`);

    try {
        const snapshot = await db.collection('conferences')
            .doc(cid)
            .collection('registrations')
            .where('userId', '==', targetUid)
            .get();

        if (snapshot.empty) {
            console.log(`No registrations found for user ${targetUid}.`);
            return;
        }

        for (const doc of snapshot.docs) {
            console.log(`Found registration ${doc.id} for ${targetUid}.`);
            console.log(`Current data:`, JSON.stringify(doc.data(), null, 2));

            await doc.ref.update({
                paymentStatus: 'PAID'
            });

            console.log(`Successfully updated paymentStatus to 'PAID' for registration ID: ${doc.id}`);
        }
    } catch (error) {
        console.error("Error during update:", error);
    }
}

updateRegistration().then(() => console.log("Done."));
