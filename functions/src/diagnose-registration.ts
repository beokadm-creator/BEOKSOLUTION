/**
 * 진단 스크립트: 등록 데이터 불일치 문제 확인
 *
 * 사용법:
 * 1. Firebase Console의 Functions 탭에서 이 코드를 복사하여 테스트 함수로 실행
 * 2. 또는 로컬에서 node diagnose.mjs <userId>로 실행
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();

/**
 * 특정 사용자의 등록 데이터 상태 진단
 */
async function diagnoseUserRegistration(userId: string, conferenceSlug: string = 'kadd_2026spring') {
    console.log('='.repeat(60));
    console.log(`진단 시작: 사용자 ${userId}, 컨퍼런스 ${conferenceSlug}`);
    console.log('='.repeat(60));

    // 1. Participations 데이터 확인
    console.log('\n[1] Participations 데이터 확인:');
    console.log(`   경로: users/${userId}/participations`);
    try {
        const participationsRef = db.collection(`users/${userId}/participations`);
        const participationsSnap = await participationsRef.get();

        console.log(`   총 ${participationsSnap.size}개의 참여 기록 발견`);

        let foundTarget = false;
        for (const docSnap of participationsSnap.docs) {
            const data = docSnap.data();
            console.log(`   - ID: ${docSnap.id}`);
            console.log(`     conferenceId: ${data.conferenceId}`);
            console.log(`     conferenceName: ${data.conferenceName}`);
            console.log(`     slug: ${data.slug || 'N/A'}`);
            console.log(`     societyId: ${data.societyId}`);
            console.log(`     status: ${data.status}`);
            console.log(`     paymentStatus: ${data.paymentStatus}`);
            console.log(`     amount: ${data.amount}`);
            console.log(`     registeredAt: ${data.registeredAt}`);
            console.log(`     paidAt: ${data.paidAt}`);

            if (data.conferenceId === conferenceSlug || data.slug === conferenceSlug) {
                foundTarget = true;
                console.log(`     >>> 타겟 컨퍼런스와 일치!`);
            }
        }

        if (!foundTarget) {
            console.log(`   ⚠️  ${conferenceSlug}에 대한 참여 기록을 찾을 수 없음`);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ 오류: ${message}`);
    }

    // 2. Registrations 데이터 확인
    console.log('\n[2] Registrations 데이터 확인:');
    console.log(`   경로: conferences/${conferenceSlug}/registrations`);
    try {
        const registrationsRef = db.collection(`conferences/${conferenceSlug}/registrations`);
        const q = registrationsRef.where('userId', '==', userId);
        const registrationsSnap = await q.get();

        console.log(`   총 ${registrationsSnap.size}개의 등록 기록 발견`);

        for (const doc of registrationsSnap.docs) {
            const data = doc.data();
            console.log(`   - ID: ${doc.id}`);
            console.log(`     userId: ${data.userId}`);
            console.log(`     userName: ${data.userName}`);
            console.log(`     userEmail: ${data.userEmail}`);
            console.log(`     status: ${data.status}`);
            console.log(`     paymentStatus: ${data.paymentStatus}`);
            console.log(`     amount: ${data.amount}`);
            console.log(`     createdAt: ${data.createdAt}`);
            console.log(`     updatedAt: ${data.updatedAt}`);
            console.log(`     paymentMethod: ${data.paymentMethod}`);
            console.log(`     receiptNumber: ${data.receiptNumber}`);
        }

        if (registrationsSnap.empty) {
            console.log(`   ⚠️  ${conferenceSlug}에서 ${userId}에 대한 등록 기록을 찾을 수 없음`);
            console.log(`   >>> 이것이 문제의 원인! registrations 데이터가 없음`);
        } else {
            const firstReg = registrationsSnap.docs[0].data();
            if (firstReg.paymentStatus !== 'PAID') {
                console.log(`   ⚠️  paymentStatus가 'PAID'가 아님: ${firstReg.paymentStatus}`);
                console.log(`   >>> Badge 페이지가 이 레코드를 표시하지 않음`);
            }
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ 오류: ${message}`);
    }

    // 3. Conference 문서 확인
    console.log('\n[3] Conference 문서 확인:');
    console.log(`   경로: conferences/${conferenceSlug}`);
    try {
        const confRef = db.doc(`conferences/${conferenceSlug}`);
        const confSnap = await confRef.get();

        if (confSnap.exists) {
            const data = confSnap.data();
            console.log(`   ✅ 컨퍼런스 문서 존재`);
            console.log(`     title: ${JSON.stringify(data?.title)}`);
            console.log(`     societyId: ${data?.societyId}`);
            console.log(`     dates: ${JSON.stringify(data?.dates)}`);
        } else {
            console.log(`   ⚠️  컨퍼런스 문서를 찾을 수 없음: ${conferenceSlug}`);
            console.log(`   >>> slug가 올바르지 않을 수 있음`);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ 오류: ${message}`);
    }

    // 4. User 문서 확인
    console.log('\n[4] User 문서 확인:');
    console.log(`   경로: users/${userId}`);
    try {
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
            const data = userSnap.data();
            console.log(`   ✅ User 문서 존재`);
            console.log(`     name: ${data?.name}`);
            console.log(`     email: ${data?.email}`);
            console.log(`     phone: ${data?.phoneNumber}`);
            console.log(`     isAnonymous: ${data?.isAnonymous || false}`);
        } else {
            console.log(`   ℹ️  User 문서가 없음 (비회원일 수 있음)`);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ 오류: ${message}`);
    }

    // 5. 진단 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('[진단 결과 요약]');
    console.log('='.repeat(60));
    console.log('가능한 원인:');
    console.log('1. Cloud Function이 배포되지 않았거나 오래된 버전 실행 중');
    console.log('2. 결제 확인 시 confId 또는 regId가 잘못 전달됨');
    console.log('3. 원본 registrations 문서가 존재하지 않음 (결제 전 생성 실패)');
    console.log('4. paymentStatus가 "PAID"로 업데이트되지 않음');
    console.log('');
    console.log('해결 방법:');
    console.log('1. Cloud Function 재배포: firebase deploy --only functions');
    console.log('2. Firebase Functions 로그에서 결제 처리 흔적 확인');
    console.log('3. 필요한 경우 수동으로 registrations 문서 생성/업데이트');
    console.log('='.repeat(60));
}

/**
 * Cloud Function으로 실행할 때
 */
interface DiagnoseRegistrationParams {
    userId: string;
    conferenceSlug?: string;
}

export const diagnoseRegistration = functions.https.onCall(async (data: DiagnoseRegistrationParams, context: functions.https.CallableContext) => {
    const { userId, conferenceSlug } = data;

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '인증이 필요합니다');
    }

    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'userId가 필요합니다');
    }

    const result = await diagnoseUserRegistration(userId, conferenceSlug);
    return { success: true, result };
});

// 로컬 실행용
 
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.log('사용법: node diagnose.js <userId> [conferenceSlug]');
        console.log('예시: node diagnose.js abc123xyz kadd_2026spring');
        process.exit(1);
    }

    const userId = args[0];
    const conferenceSlug = args[1] || 'kadd_2026spring';

    // Firebase Admin 초기화
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require('./service-account-key.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    diagnoseUserRegistration(userId, conferenceSlug).catch(console.error);
}
