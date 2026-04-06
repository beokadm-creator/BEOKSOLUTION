/**
 * One-time setup script: Create super_admins documents in Firestore
 * 
 * Run: node scripts/setup-super-admins.cjs
 * 
 * Uses Application Default Credentials via Firebase CLI login.
 * Make sure you've run: firebase login
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Try to get credentials from Firebase CLI
function getFirebaseCLICredentials() {
    const credPath = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(credPath)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
        return true;
    }
    // Windows path
    const winPath = path.join(os.homedir(), 'AppData', 'Roaming', 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(winPath)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = winPath;
        return true;
    }
    return false;
}

async function setup() {
    console.log('🚀 Starting super_admins collection setup...\n');

    // Find credentials
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        if (!getFirebaseCLICredentials()) {
            console.error('❌ No credentials found.');
            console.error('   Run: firebase login');
            console.error('   Or set: GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json');
            process.exit(1);
        }
    }
    console.log(`   Credentials: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}\n`);

    // Read .firebaserc for project ID
    let projectId = process.env.FIREBASE_PROJECT;
    try {
        const firebaserc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.firebaserc'), 'utf8'));
        projectId = firebaserc.projects?.default || projectId;
    } catch {}

    admin.initializeApp({ projectId });
    const db = admin.firestore();

    // Admin emails to migrate from hardcoded array
    const SUPER_ADMIN_EMAILS = [
        { email: 'aaron@beoksolution.com', uid: 'ykiqki032RXDGoS50sTcDlFx4nO2' },
        { email: 'test@eregi.co.kr', uid: null },
        { email: 'any@eregi.co.kr', uid: null }
    ];

    let created = 0, skipped = 0, failed = 0;

    for (const { email, uid } of SUPER_ADMIN_EMAILS) {
        try {
            const docRef = db.collection('super_admins').doc(email.toLowerCase());
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                const data = docSnap.data();
                console.log(`   ⏭️  ${email} — already exists (role: ${data.role})`);
                skipped++;
            } else {
                const docData = {
                    email: email.toLowerCase(),
                    role: 'SUPER_ADMIN',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                };
                if (uid) {
                    docData.uid = uid;
                }
                await docRef.set(docData);
                console.log(`   ✅ ${email} — created successfully${uid ? ` (uid: ${uid})` : ''}`);
                created++;
            }
        } catch (error) {
            console.error(`   ❌ ${email} — failed: ${error.message}`);
            failed++;
        }
    }

    // Verify all documents
    console.log('\n📋 Verification:');
    try {
        const snapshot = await db.collection('super_admins').get();
        console.log(`   Total super_admins documents: ${snapshot.size}`);
        
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`   - ${doc.id} → role: ${data.role}${data.uid ? `, uid: ${data.uid}` : ''}`);
        });
    } catch (err) {
        console.error('   Verification failed:', err.message);
    }

    console.log(`\n📊 Results: ${created} created, ${skipped} skipped, ${failed} failed`);
    
    if (created > 0) {
        console.log('\n✅ Setup complete! Super admins are now managed via Firestore.');
        console.log('   The hardcoded SUPER_ADMINS array in defaults.ts serves as a fallback.');
    }

    process.exit(failed > 0 ? 1 : 0);
}

setup().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
