
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

async function run() {
    // Attempt to use default application credentials first
    try {
        initializeApp({ projectId: 'eregi-8fc1e' });
    } catch (e) {
        console.error("Failed to initialize:", e);
        return;
    }

    const db = getFirestore();
    const cid = 'kadd_2026spring';

    console.log(`Searching for 홍동희...`);
    const nameSearch = await db.collection(`conferences/${cid}/registrations`).where('userName', '==', '홍동희').get();
    nameSearch.forEach(d => console.log('Found by name (userName):', d.id, JSON.stringify(d.data(), null, 2)));

    const nameSearch2 = await db.collection(`conferences/${cid}/registrations`).where('userInfo.name', '==', '홍동희').get();
    nameSearch2.forEach(d => console.log('Found by name (userInfo.name):', d.id, JSON.stringify(d.data(), null, 2)));
}

run().catch(console.error);
