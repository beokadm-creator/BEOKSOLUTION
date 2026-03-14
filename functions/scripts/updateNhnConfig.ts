/**
 * Firestore NHN AlimTalk 설정 업데이트 스크립트
 * 
 * 사용법:
 * 1. export GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
 * 2. npx ts-node functions/scripts/updateNhnConfig.ts
 * 
 * 또는 Firebase Console에서 직접 펴집:
 * societies/kadd/settings/infrastructure 문서에 notification.nhnAlimTalk 필드 추가
 */

import * as admin from 'firebase-admin';

// 서비스 계정 초기화
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

// KADD 학회용 NHN Cloud 설정
const KADD_NHN_CONFIG = {
    enabled: true,
    appKey: 'Ik6GEBC22p5Qliqk',
    secretKey: 'ajFUrusk8I7tgBQdrztuQvcf6jgWWcme',
    senderKey: '', // TODO: 기존 senderKey 값을 입력하세요
    resendSendNo: ''
};

async function updateSocietyNhnConfig(societyId: string, config: typeof KADD_NHN_CONFIG) {
    console.log(`Updating NHN config for society: ${societyId}`);
    
    try {
        const infraRef = db.collection('societies').doc(societyId).collection('settings').doc('infrastructure');
        
        // 현재 설정 확인
        const currentDoc = await infraRef.get();
        const currentData = currentDoc.exists ? currentDoc.data() : {};
        
        // notification 필드 병합
        const updatedData = {
            ...currentData,
            notification: {
                ...currentData.notification,
                nhnAlimTalk: config
            }
        };
        
        await infraRef.set(updatedData, { merge: true });
        
        console.log(`✅ Successfully updated NHN config for ${societyId}`);
        console.log('Updated data:', JSON.stringify(updatedData.notification, null, 2));
        
        return true;
    } catch (error) {
        console.error(`❌ Failed to update NHN config for ${societyId}:`, error);
        return false;
    }
}

async function main() {
    const societyId = 'kadd';
    
    console.log('========================================');
    console.log('NHN AlimTalk Configuration Update Script');
    console.log('========================================');
    console.log('');
    console.log('Target society:', societyId);
    console.log('Config to apply:', JSON.stringify(KADD_NHN_CONFIG, null, 2));
    console.log('');
    
    // senderKey가 비어있으면 경고
    if (!KADD_NHN_CONFIG.senderKey) {
        console.log('⚠️  WARNING: senderKey is empty!');
        console.log('   Please update KADD_NHN_CONFIG.senderKey before running this script.');
        console.log('   You can find senderKey in NHN Cloud Console.');
        console.log('');
    }
    
    const success = await updateSocietyNhnConfig(societyId, KADD_NHN_CONFIG);
    
    if (success) {
        console.log('');
        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Verify settings in Firebase Console');
        console.log('2. Test AlimTalk sending from Admin UI');
    } else {
        console.log('');
        console.log('❌ Migration failed. Check the error above.');
        process.exit(1);
    }
    
    process.exit(0);
}

main();
