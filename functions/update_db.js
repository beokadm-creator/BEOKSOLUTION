
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function run() {
    try {
        initializeApp({ projectId: 'eregi-8fc1e' });
    } catch (e) {
        console.error("Failed to initialize:", e);
        return;
    }

    const db = getFirestore();
    const cid = 'kadd_2026spring';
    const targetUid = '26CSwlTJDTPUVctcAyvYXJpem733';

    console.log(`Searching for registration with userId: ${targetUid}...`);

    const snapshot = await db.collection(`conferences/${cid}/registrations`)
        .where('userId', '==', targetUid)
        .get();

    if (snapshot.empty) {
        console.log(`No registrations found for user ${targetUid}.`);
        return;
    }

    snapshot.forEach(async (doc) => {
        console.log(`Found registration ${doc.id} for ${targetUid}. Current paymentStatus: ${doc.data().paymentStatus}`);

        await db.collection(`conferences/${cid}/registrations`).doc(doc.id).update({
            paymentStatus: 'PAID'
        });

        console.log(`Successfully updated paymentStatus to 'PAID' for registration ID: ${doc.id}`);
    });
}

run().catch(console.error);
