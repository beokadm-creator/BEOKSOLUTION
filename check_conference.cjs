const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'eregi-8fc1e'
    });
}

const db = admin.firestore();

async function check() {
    console.log('=== Checking kadd_2026spring conference document ===\n');
    const docRef = db.doc('conferences/kadd_2026spring');
    const snap = await docRef.get();

    if (!snap.exists) {
        console.log('❌ Document does not exist!');
    } else {
        const data = snap.data();
        console.log('✅ Document exists!');
        console.log('  - Document ID:', snap.id);
        console.log('  - slug field:', data.slug || '⚠️ MISSING slug field!');
        console.log('  - societyId field:', data.societyId || '⚠️ MISSING societyId field!');
        console.log('  - title:', JSON.stringify(data.title));
        console.log('  - status:', data.status);
        console.log('\n--- Full document data ---');
        const { agendas, speakers, sponsors, ...rest } = data;
        console.log(JSON.stringify(rest, null, 2));
    }

    console.log('\n=== Checking slug query (where slug == 2026spring) ===');
    const q = db.collection('conferences').where('slug', '==', '2026spring');
    const querySnap = await q.get();
    console.log('Query results count:', querySnap.size);
    querySnap.forEach(doc => {
        const d = doc.data();
        console.log('  Found:', doc.id, '| societyId:', d.societyId, '| slug:', d.slug);
    });
}

check().catch(console.error);
