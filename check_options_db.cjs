const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'eregi-8fc1e'
    });
}

const db = admin.firestore();

async function checkOptions() {
    const confId = 'kadd_2026spring';
    console.log(`Checking options for ${confId}...`);
    const optionsRef = db.collection(`conferences/${confId}/conference_options`);
    const snap = await optionsRef.get();

    if (snap.empty) {
        console.log('❌ No options found in conference_options subcollection.');
    } else {
        console.log(`✅ Found ${snap.size} options:`);
        snap.forEach(doc => {
            console.log(`- ${doc.id}:`, JSON.stringify(doc.data(), null, 2));
        });
    }
}

checkOptions().catch(console.error);
