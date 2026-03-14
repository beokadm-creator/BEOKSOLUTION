const admin = require('firebase-admin');

// Try to initialize without explicit credentials (for local shell with ADC)
// or check if there's a local service account key
try {
    admin.initializeApp();
} catch (e) {
    console.error("Initialization failed, trying with default settings...", e);
}

const db = admin.firestore();

async function findRecentPayments() {
    const today = new Date('2026-03-12T00:00:00');
    console.log("Checking registrations paid after:", today.toISOString());

    const conferencesSnap = await db.collection('conferences').get();
    let totalFound = 0;

    for (const confDoc of conferencesSnap.docs) {
        const regsSnap = await confDoc.ref.collection('registrations')
            .where('paidAt', '>=', today)
            .get();

        if (!regsSnap.empty) {
            console.log(`\n--- Conference: ${confDoc.id} ---`);
            regsSnap.forEach(doc => {
                const data = doc.data();
                console.log(`[PAID] RegID: ${doc.id}, Name: ${data.name}, Time: ${data.paidAt.toDate().toLocaleString()}, Method: ${data.paymentMethod}`);
                totalFound++;
            });
        }
    }
    console.log(`\nDone. Total found: ${totalFound}`);
}

findRecentPayments().catch(console.error);
