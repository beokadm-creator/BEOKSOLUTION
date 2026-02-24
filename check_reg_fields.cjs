const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'eregi-8fc1e'
    });
}

const db = admin.firestore();

async function checkLatestRegistration() {
    const confId = 'kadd_2026spring';
    console.log(`Checking latest registration for ${confId}...`);
    const regRef = db.collection(`conferences/${confId}/registrations`);
    const snap = await regRef.orderBy('createdAt', 'desc').limit(1).get();

    if (snap.empty) {
        console.log('❌ No registrations found.');
    } else {
        const doc = snap.docs[0];
        console.log(`✅ Latest Reg ID: ${doc.id}`);
        const data = doc.data();
        console.log('Data keys:', Object.keys(data));
        console.log('options:', JSON.stringify(data.options, null, 2));
        console.log('selectedOptions:', JSON.stringify(data.selectedOptions, null, 2));
    }
}

checkLatestRegistration().catch(console.error);
