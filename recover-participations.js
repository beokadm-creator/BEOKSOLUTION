// ========================================
// Participations 복구 스크립트
// ========================================
// Firebase Console > Firestore > Functions > Run Function 에서 실행하거나
// 브라우저 개발자 콘솔에서 실행 (firebase-compat 로드 필요)
// ========================================

// [Option 1] 브라우저 콘솔에서 직접 실행
(async function recoverParticipations() {
    // Firebase SDK 로드 (콘솔에서 이미 로드된 경우 생략 가능)
    if (!window.firebase) {
        await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js');
    }
    
    const firebaseConfig = {
        apiKey: "AIzaSyC7xR1tF3nY2qW5zX6vK7aB8cD9eF0gH1",
        authDomain: "eregi-8fc1e.firebaseapp.com",
        projectId: "eregi-8fc1e"
    };
    
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    const db = firebase.firestore();
    
    // ========================================
    // [설정] 복구할 사용자 정보
    // ========================================
    const TARGET_USER_ID = 'K2ufvNWpJsNc0KbyrGdZLf4PdU32';  // 복구할 User UID
    const CONFERENCE_ID = 'kadd_2026spring';  // 특정 컨퍼런스 (비워두면 전체 검색)
    
    console.log('🚀 Participations 복구 시작...');
    console.log(`Target User ID: ${TARGET_USER_ID}`);
    console.log(`Conference ID: ${CONFERENCE_ID || 'ALL'}`);
    
    try {
        // ========================================
        // Step 1: 결제 완료된 등록 찾기
        // ========================================
        console.log('\n🔍 Step 1: 결제 완료된 등록 검색 중...');
        
        let registrationSnap;
        
        if (CONFERENCE_ID) {
            // 특정 컨퍼런스 검색
            const q = db.collection(`conferences/${CONFERENCE_ID}/registrations`)
                .where('userId', '==', TARGET_USER_ID)
                .where('status', '==', 'PAID');
            registrationSnap = await q.get();
        } else {
            // 전체 검색 (collectionGroup 사용)
            const q = db.collectionGroup('registrations')
                .where('userId', '==', TARGET_USER_ID)
                .where('status', '==', 'PAID');
            registrationSnap = await q.get();
        }
        
        if (registrationSnap.empty) {
            console.error('❌ 결제 완료된 등록을 찾지 못했습니다.');
            return;
        }
        
        console.log(`✅ ${registrationSnap.size}개의 결제 완료된 등록을 찾았습니다.`);
        
        // 각 등록의 기본 정보 출력
        registrationSnap.forEach(doc => {
            const data = doc.data();
            console.log(`   - ID: ${doc.id}, Slug: ${data.slug}, Status: ${data.status}, Amount: ${data.amount}`);
        });
        
        // ========================================
        // Step 2: Participations 복구
        // ========================================
        console.log('\n🔧 Step 2: Participations 복구 중...');
        
        const participationRef = db.collection(`users/${TARGET_USER_ID}/participations`);
        let recoveredCount = 0;
        let skippedCount = 0;
        
        // Firestore batch는 최대 500개 작업
        const batch = db.batch();
        
        for (const doc of registrationSnap.docs) {
            const regData = doc.data();
            const regId = doc.id;
            
            // 이미 존재하는지 확인
            const existingParticipation = await participationRef.doc(regId).get();
            
            if (existingParticipation.exists) {
                console.log(`   ℹ️  ${regId} - 이미 존재함, 건너뜀`);
                skippedCount++;
                continue;
            }
            
            // 컨퍼런스 정보 추출
            let confId = regData.conferenceId;
            if (!confId) {
                // 문서 경로에서 추출
                const pathParts = doc.ref.path.split('/');
                confId = pathParts[1]; // conferences/{conferenceId}/registrations/...
            }
            
            // Participation 데이터 생성
            const participationData = {
                conferenceId: confId || CONFERENCE_ID || 'unknown',
                societyId: regData.societyId || 'kadd',
                slug: regData.slug || CONFERENCE_ID || 'kadd_2026spring',
                userName: regData.userName || regData.userInfo?.name || 'Unknown',
                userEmail: regData.userEmail || regData.userInfo?.email || '',
                userPhone: regData.userPhone || regData.userInfo?.phone || '',
                userOrg: regData.userOrg || regData.userInfo?.org || regData.affiliation || '',
                licenseNumber: regData.licenseNumber || '',
                tier: regData.tier || regData.grade || 'UNKNOWN',
                paymentStatus: 'PAID',
                amount: regData.amount || 0,
                paymentKey: regData.paymentKey || '',
                paymentType: regData.paymentType || '카드',
                createdAt: regData.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
                paidAt: regData.paidAt || firebase.firestore.FieldValue.serverTimestamp(),
                earnedPoints: 0
            };
            
            // Batch에 추가
            batch.set(participationRef.doc(regId), participationData);
            recoveredCount++;
            
            console.log(`   ✅ ${regId} - ${participationData.slug} (${participationData.amount}원)`);
        }
        
        // ========================================
        // Step 3: Batch Commit
        // ========================================
        if (recoveredCount > 0) {
            console.log('\n💾 Step 3: 저장 중...');
            await batch.commit();
            console.log('✅ 저장 완료!');
        }
        
        // ========================================
        // 결과 요약
        // ========================================
        console.log('\n========================================');
        console.log('🎉 복구 완료!');
        console.log('========================================');
        console.log(`✅ 복구된 참여 기록: ${recoveredCount}개`);
        console.log(`ℹ️  이미 존재하여 건너뜀: ${skippedCount}개`);
        console.log(`📋 총 검색된 등록: ${registrationSnap.size}개`);
        console.log('\n이제 https://kadd.eregi.co.kr/mypage 에서 확인하실 수 있습니다!');
        
    } catch (error) {
        console.error('\n❌ 오류 발생:', error);
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            console.error('\n⚠️ Firestore 인덱스가 필요합니다.');
            console.error('Firebase Console에서 인덱스를 생성해 주세요:');
            console.error('https://console.firebase.google.com/project/eregi-8fc1e/firestore/indexes');
        }
    }
    
    // Helper: 동적 스크립트 로드
    async function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
})();

// ========================================
// [Option 2] Firebase Functions으로 배포된 함수 호출
// ========================================
// 먼저 functions/src/index.ts에 recoverParticipationHistory 함수를 추가한 후 배포해야 합니다.
/*
await firebase.functions().httpsCallable('recoverParticipationHistory')({
    userId: 'K2ufvNWpJsNc0KbyrGdZLf4PdU32',
    conferenceId: 'kadd_2026spring'
});
*/
