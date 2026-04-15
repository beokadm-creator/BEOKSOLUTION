/**
 * 데이터베이스의 badgeLayout height를 280에서 240으로 수정
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

// Firebase 설정 - 실제 config로 변경 필요
const firebaseConfig = {
  // 실제 firebase config 필요
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixBadgeHeight(conferenceId) {
  try {
    console.log(`🔧 Fixing badge height for conference: ${conferenceId}`);

    // 1. info/general 업데이트
    const infoRef = doc(db, `conferences/${conferenceId}/info/general`);
    const infoSnap = await getDoc(infoRef);

    if (infoSnap.exists() && infoSnap.data().badgeLayout) {
      const badgeLayout = infoSnap.data().badgeLayout;
      if (badgeLayout.height === 280) {
        await updateDoc(infoRef, {
          'badgeLayout.height': 240
        });
        console.log('✅ Updated info/general badgeLayout.height: 280 → 240');
      }
    }

    // 2. settings/badge_config 업데이트
    const settingsRef = doc(db, `conferences/${conferenceId}/settings/badge_config`);
    const settingsSnap = await getDoc(settingsRef);

    if (settingsSnap.exists() && settingsSnap.data().badgeLayout) {
      const badgeLayout = settingsSnap.data().badgeLayout;
      if (badgeLayout.height === 280) {
        await updateDoc(settingsRef, {
          'badgeLayout.height': 240
        });
        console.log('✅ Updated settings/badge_config badgeLayout.height: 280 → 240');
      }
    }

    console.log('🎉 Badge height fix completed!');

  } catch (error) {
    console.error('❌ Error fixing badge height:', error);
  }
}

// 사용법: node fix-badge-height.js CONFERENCE_ID
const conferenceId = process.argv[2];
if (!conferenceId) {
  console.error('Usage: node fix-badge-height.js CONFERENCE_ID');
  process.exit(1);
}

fixBadgeHeight(conferenceId);