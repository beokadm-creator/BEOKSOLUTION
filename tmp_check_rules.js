
import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

async function checkRules() {
    const confId = 'kadd_2026spring';
    const rulesRef = db.doc(`conferences/${confId}/settings/attendance`);
    const snap = await rulesRef.get();

    if (!snap.exists) {
        console.log('Rules document not found');
        return;
    }

    const rules = snap.data();
    console.log('--- Attendance Rules ---');
    console.log(JSON.stringify(rules, null, 2));

    // Also check badge config
    const badgeRef = db.doc(`conferences/${confId}/settings/badge_config`);
    const badgeSnap = await badgeRef.get();
    if (badgeSnap.exists) {
        console.log('\n--- Badge Config ---');
        console.log(JSON.stringify(badgeSnap.data(), null, 2));
    }
}

checkRules().catch(console.error);
