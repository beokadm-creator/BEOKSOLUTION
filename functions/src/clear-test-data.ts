import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const db = admin.firestore();

/**
 * 테스트 데이터 일괄 삭제
 *
 * 사용법:
 * 1. Firebase Console → Functions → 이 함수 호출
 * 2. 또는 callable function으로 실행
 */
export const clearTestData = functions.https.onCall(async (data: unknown, context: functions.https.CallableContext) => {
    // 인증 체크 (Super Admin만 실행 가능)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '인증이 필요합니다');
    }

    const token = context.auth.token as Record<string, unknown>;
    const email = typeof token.email === "string" ? token.email : "";
    const isSuper = token.admin === true || token.super === true || email === "aaron@beoksolution.com" || email === "test@eregi.co.kr";
    if (!isSuper) {
        throw new functions.https.HttpsError("permission-denied", "권한이 없습니다");
    }

    const requestData = data as { conferenceSlug?: string };
    const { conferenceSlug } = requestData;
    const targetConfId = conferenceSlug || 'kadd_2026spring';

    const result = {
        registrationsDeleted: 0,
        participationsDeleted: 0,
        errors: [] as string[]
    };

    try {
        // 1. Registrations 삭제
        const registrationsRef = db.collection(`conferences/${targetConfId}/registrations`);
        const registrationsSnap = await registrationsRef.get();

        if (!registrationsSnap.empty) {
            const batch = db.batch();
            registrationsSnap.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            result.registrationsDeleted = registrationsSnap.size;
        }

        // 2. Participations 삭제
        const participationsRef = db.collectionGroup('participations');
        const participationsQuery = participationsRef.where('conferenceId', '==', targetConfId);
        const participationsSnap = await participationsQuery.get();

        if (!participationsSnap.empty) {
            // Firestore는 한 번에 500개까지 batch 가능
            const batchSize = 500;
            const batches: admin.firestore.WriteBatch[] = [];
            let currentBatch = db.batch();
            let operations = 0;

            for (const doc of participationsSnap.docs) {
                currentBatch.delete(doc.ref);
                operations++;

                if (operations === batchSize) {
                    batches.push(currentBatch);
                    currentBatch = db.batch();
                    operations = 0;
                }
            }

            // 마지막 batch 추가
            if (operations > 0) {
                batches.push(currentBatch);
            }

            // 모든 batch 실행
            for (let i = 0; i < batches.length; i++) {
                await batches[i].commit();
            }

            result.participationsDeleted = participationsSnap.size;
        }

        // 3. Member 코드 사용 기록 복구 (선택사항)
        const membersRef = db.collectionGroup('members');
        const membersQuery = membersRef.where('used', '==', true);
        const membersSnap = await membersQuery.get();

        if (!membersSnap.empty) {
            // 테스트 데이터니까 전부 해제
            const batch = db.batch();
            membersSnap.docs.forEach(doc => {
                const data = doc.data();
                // 최근 24시간 내에 사용된 코드만 해제 (안전장치)
                if (data.usedAt) {
                    const hoursSinceUsed = (Date.now() - data.usedAt.toDate().getTime()) / (1000 * 60 * 60);
                    if (hoursSinceUsed < 24) {
                        batch.update(doc.ref, {
                            used: false,
                            usedBy: admin.firestore.FieldValue.delete(),
                            usedAt: admin.firestore.FieldValue.delete()
                        });
                    }
                }
            });
            await batch.commit();
        }

        return {
            success: true,
            message: '테스트 데이터 삭제 완료',
            result
        };

    } catch (error: unknown) {
        console.error('[TestData Cleanup] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        throw new functions.https.HttpsError('internal', errorMessage);
    }
});
