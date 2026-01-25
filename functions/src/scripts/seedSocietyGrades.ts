
import * as admin from 'firebase-admin';

// NOTE: This script assumes you have GOOGLE_APPLICATION_CREDENTIALS set or are running in an environment with access.
// Usage: export GOOGLE_APPLICATION_CREDENTIALS="./service-account.json" && npx ts-node src/scripts/seedSocietyGrades.ts

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

const GRADES_DATA = {
    "list": [
        { "code": "member", "name": { "ko": "정회원", "en": "Member" } },
        { "code": "non_member", "name": { "ko": "비회원", "en": "Non-member" } },
        { "code": "Dental hygienist", "name": { "ko": "치과위생사", "en": "Dental hygienist" } }
    ]
};

async function seed() {
    const societyId = 'kadd';
    console.log(`Seeding society grades to 'societies/${societyId}/settings/grades'...`);
    
    try {
        await db.doc(`societies/${societyId}/settings/grades`).set(GRADES_DATA);
        console.log("✅ Success! Society grades added.");
        console.log(JSON.stringify(GRADES_DATA, null, 2));
    } catch (e) {
        console.error("❌ Error adding society grades:", e);
        console.log("Hint: Check your credentials and permissions.");
    }
}

seed();
