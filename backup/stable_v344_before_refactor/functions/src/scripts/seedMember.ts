
import * as admin from 'firebase-admin';

// NOTE: This script assumes you have GOOGLE_APPLICATION_CREDENTIALS set or are running in an environment with access.
// If running locally, ensure you are logged in via 'firebase login' and have appropriate permissions, 
// or export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"

if (admin.apps.length === 0) {
    // Attempt to initialize with default credentials
    admin.initializeApp();
}

const db = admin.firestore();

async function seed() {
    console.log("Seeding test member to 'societies/kadd/members'...");
    try {
        const res = await db.collection('societies').doc('kadd').collection('members').add({
            name: "테스트",
            code: "9999",
            grade: "Military Doctor",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Success! Test Member added.");
        console.log(`   - ID: ${res.id}`);
        console.log(`   - Name: 테스트`);
        console.log(`   - Code: 9999`);
    } catch (e) {
        console.error("❌ Error adding member:", e);
        console.log("Hint: If you see 'Could not load the default credentials', you need to set up a Service Account key.");
        console.log("1. Go to Firebase Console > Project Settings > Service accounts");
        console.log("2. Generate new private key");
        console.log("3. Save as 'service-account.json' in functions/ directory");
        console.log("4. Run: export GOOGLE_APPLICATION_CREDENTIALS=\"./service-account.json\" && npx ts-node src/scripts/seedMember.ts");
    }
}

seed();
