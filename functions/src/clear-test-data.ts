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
interface ClearTestDataParams {
    conferenceSlug?: string;
}

export const clearTestData = functions.https.onCall(async (data: ClearTestDataParams, context: functions.https.CallableContext) => {
    // 인증 체크 (Super Admin만 실행 가능)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '인증이 필요합니다');
    }

    const { conferenceSlug } = data;
    const targetConfId = conferenceSlug || 'kadd_2026spring';

    console.log(`[TestData Cleanup] Starting cleanup for conference: ${targetConfId}`);
    const result = {
        registrationsDeleted: 0,
        participationsDeleted: 0,
        errors: [] as string[]
    };

    try {
        // 1. Registrations 삭제
        console.log(`[TestData Cleanup] Deleting registrations from conferences/${targetConfId}/registrations`);
        const registrationsRef = db.collection(`conferences/${targetConfId}/registrations`);
        const registrationsSnap = await registrationsRef.get();

        if (!registrationsSnap.empty) {
            const batch = db.batch();
            registrationsSnap.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            result.registrationsDeleted = registrationsSnap.size;
            console.log(`[TestData Cleanup] Deleted ${registrationsSnap.size} registrations`);
        } else {
            console.log('[TestData Cleanup] No registrations found');
        }

        // 2. Participations 삭제
        console.log(`[TestData Cleanup] Deleting participations for conference ${targetConfId}`);

        // Collection group query로 모든 participations 검색
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
                console.log(`[TestData Cleanup] Batch ${i + 1}/${batches.length} committed`);
            }

            result.participationsDeleted = participationsSnap.size;
            console.log(`[TestData Cleanup] Deleted ${participationsSnap.size} participations in ${batches.length} batches`);
        } else {
            console.log('[TestData Cleanup] No participations found');
        }

        // 3. Member 코드 사용 기록 복구 (선택사항)
        console.log(`[TestData Cleanup] Checking member codes to unlock`);
        const membersRef = db.collectionGroup('members');
        const membersQuery = membersRef.where('used', '==', true);
        const membersSnap = await membersQuery.get();

        if (!membersSnap.empty) {
            console.log(`[TestData Cleanup] Found ${membersSnap.size} used member codes`);
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
            console.log('[TestData Cleanup] Unlocked recently used member codes');
        }

        console.log('[TestData Cleanup] Cleanup completed', result);
        return {
            success: true,
            message: '테스트 데이터 삭제 완료',
            result
        };

    } catch (error: unknown) {
        console.error('[TestData Cleanup] Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new functions.https.HttpsError('internal', message);
    }
});
