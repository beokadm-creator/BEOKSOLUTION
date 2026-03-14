const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json'); // Make sure this path applies

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function check() {
    const cid = 'kadd_2026spring';
    const regRef = db.collection(`conferences/${cid}/registrations`);
    const q1 = await regRef.where('paymentStatus', '==', 'PAID').limit(5).get();

    console.log(`Found ${q1.docs.length} paid regs`);
    for (const doc of q1.docs) {
        const data = doc.data();
        console.log(`\nID: ${doc.id}`);
        console.log(`lastCheckIn:`, data.lastCheckIn ? "Exists" : "Null");
        console.log(`lastCheckOut:`, data.lastCheckOut ? "Exists" : "Null");
        if (data.lastCheckIn) console.log(`lastCheckIn raw:`, {
            _seconds: data.lastCheckIn._seconds,
            _nanoseconds: data.lastCheckIn._nanoseconds,
            toDate: typeof data.lastCheckIn.toDate === 'function' ? 'Yes' : 'No',
            isObject: typeof data.lastCheckIn === 'object'
        });
    }

    const tRef = db.collection(`conferences/${cid}/access_logs`);
    const tq = await tRef.limit(2).get();
    console.log("\nSample access_logs timestamp:");
    for (const doc of tq.docs) {
        const data = doc.data();
        console.log(`\nLog ID: ${doc.id}`);
        console.log("timestamp:", data.timestamp);
    }
}
check().catch(console.error).finally(() => process.exit(0));
