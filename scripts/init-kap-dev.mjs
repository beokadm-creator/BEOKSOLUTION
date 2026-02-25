/**
 * KAP Society & Admin Initialization Script for eregi-dev
 *
 * This script creates:
 * 1. KAP society document in Firestore
 * 2. Super admin document for aaron@beoksolution.com
 *
 * Prerequisites:
 * - Set GOOGLE_APPLICATION_CREDENTIALS environment variable to service account key
 * - Run with: node scripts/init-kap-dev.mjs
 *
 * Service Account Setup:
 * 1. Go to Firebase Console → eregi-dev → Project Settings → Service Accounts
 * 2. Click "Generate New Private Key"
 * 3. Save as service-account.json
 * 4. Set env: export GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, doc, setDoc, getDoc } from 'firebase-admin/firestore';

// Configuration
const SOCIETY_ID = 'kap';
const ADMIN_EMAIL = 'aaron@beoksolution.com';
const ADMIN_UID = 'fhA74HNo90fGppk2wNK63cO3gcz1';

// Society Data (matching schema.ts Society interface)
const SOCIETY_DATA = {
  id: SOCIETY_ID,
  name: {
    ko: '대한치주조치과학회',
    en: 'Korean Academy of Periodontology'
  },
  description: {
    ko: '치주조치과학 관련 학술 및 연구 활동',
    en: 'Academic and research activities in periodontology'
  },
  adminEmails: [ADMIN_EMAIL],
  settings: {
    abstractEnabled: true
  },
  createdAt: Timestamp.now()
};

// Super Admin Data (matching schema.ts SuperAdmin interface)
const SUPER_ADMIN_DATA = {
  email: ADMIN_EMAIL,
  role: 'SUPER_ADMIN',
  createdAt: Timestamp.now()
};

async function initializeKAPSociety() {
  console.log('🚀 Initializing KAP Society for eregi-dev...\n');

  // Initialize Firebase Admin
  const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccount) {
    console.error('❌ ERROR: GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
    console.log('\n📖 Setup Instructions:');
    console.log('1. Go to Firebase Console → eregi-dev → Project Settings → Service Accounts');
    console.log('2. Click "Generate New Private Key"');
    console.log('3. Save as service-account.json');
    console.log('4. Set env: export GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"');
    process.exit(1);
  }

  try {
    // Initialize Firebase Admin SDK
    const app = initializeApp({
      credential: cert(serviceAccount)
    });

    const db = getFirestore(app);

    // 1. Check if society already exists
    console.log(`📋 Checking if society "${SOCIETY_ID}" exists...`);
    const societyRef = doc(db, 'societies', SOCIETY_ID);
    const societySnap = await getDoc(societyRef);

    if (societySnap.exists()) {
      console.log(`⚠️  Society "${SOCIETY_ID}" already exists. Skipping creation.`);
    } else {
      // Create society
      console.log(`✨ Creating society: ${SOCIETY_DATA.name.ko} (${SOCIETY_ID})`);
      await setDoc(societyRef, SOCIETY_DATA);
      console.log(`✅ Society created successfully!`);
    }

    // 2. Check if super admin already exists
    console.log(`\n📋 Checking if super admin "${ADMIN_EMAIL}" exists...`);
    const adminRef = doc(db, 'super_admins', ADMIN_EMAIL);
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists()) {
      console.log(`⚠️  Super admin "${ADMIN_EMAIL}" already exists. Skipping creation.`);
    } else {
      // Create super admin
      console.log(`✨ Creating super admin: ${ADMIN_EMAIL}`);
      await setDoc(adminRef, SUPER_ADMIN_DATA);
      console.log(`✅ Super admin created successfully!`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ INITIALIZATION COMPLETE');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`  Society ID:    ${SOCIETY_ID}`);
    console.log(`  Society Name:  ${SOCIETY_DATA.name.ko}`);
    console.log(`  Admin Email:   ${ADMIN_EMAIL}`);
    console.log(`  Admin UID:     ${ADMIN_UID}`);
    console.log('\n🔗 Access URLs:');
    console.log(`  Super Admin:   https://eregi-dev.web.app?admin=true`);
    console.log(`  Society Admin: https://eregi-dev.web.app?society=kap`);
    console.log('\n📝 Next Steps:');
    console.log('  1. Login at: https://eregi-dev.web.app');
    console.log(`  2. Use email: ${ADMIN_EMAIL}`);
    console.log('  3. Create conferences via Super Admin dashboard');
    console.log('  4. Set up member verification codes for KAP');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Initialization failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Verify service account key path is correct');
    console.error('2. Check service account has Firestore Admin role');
    console.error('3. Confirm eregi-dev project exists');
    process.exit(1);
  }
}

// Run initialization
initializeKAPSociety();
