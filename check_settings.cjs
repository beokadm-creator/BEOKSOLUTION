const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'eregi-8fc1e'
    });
}

const db = admin.firestore();

async function check() {
    console.log('Checking settings/registration...');
    const docRef = db.doc('conferences/kadd_2026spring/settings/registration');
    const snap = await docRef.get();

    if (!snap.exists) {
        console.log('❌ Document does not exist!');
    } else {
        console.log('✅ Document exists.');
        const data = snap.data();
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
