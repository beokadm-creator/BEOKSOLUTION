const admin = require('firebase-admin');
const fs = require('fs');

try {
    admin.initializeApp();
} catch (e) {}

const db = admin.firestore();

async function findRecentPayments() {
    const logFile = 'recent_payments_log.txt';
    fs.writeFileSync(logFile, "Checking registrations paid after: 2026-03-12T00:00:00\n");

    const today = new Date('2026-03-12T00:00:00');

    try {
        const conferencesSnap = await db.collection('conferences').get();
        let totalFound = 0;

        for (const confDoc of conferencesSnap.docs) {
            fs.appendFileSync(logFile, `Checking conference: ${confDoc.id}\n`);
            const regsSnap = await confDoc.ref.collection('registrations')
                .where('paidAt', '>=', today)
                .get();

            if (!regsSnap.empty) {
                regsSnap.forEach(doc => {
                    const data = doc.data();
                    const line = `[PAID] RegID: ${doc.id}, Name: ${data.name}, Time: ${data.paidAt.toDate().toLocaleString()}, Method: ${data.paymentMethod}\n`;
                    fs.appendFileSync(logFile, line);
                    totalFound++;
                });
            }
        }
        fs.appendFileSync(logFile, `\nDone. Total found: ${totalFound}\n`);
    } catch (err) {
        fs.appendFileSync(logFile, `Error: ${err.message}\n`);
    }
}

findRecentPayments();
