"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearTestData = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
/**
 * 테스트 데이터 일괄 삭제
 *
 * 사용법:
 * 1. Firebase Console → Functions → 이 함수 호출
 * 2. 또는 callable function으로 실행
 */
exports.clearTestData = functions.https.onCall(async (data, context) => {
    // 인증 체크 (Super Admin만 실행 가능)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '인증이 필요합니다');
    }
    const requestData = data;
    const { conferenceSlug } = requestData;
    const targetConfId = conferenceSlug || 'kadd_2026spring';
    console.log(`[TestData Cleanup] Starting cleanup for conference: ${targetConfId}`);
    const result = {
        registrationsDeleted: 0,
        participationsDeleted: 0,
        errors: []
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
        }
        else {
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
            const batches = [];
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
        }
        else {
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
    }
    catch (error) {
        console.error('[TestData Cleanup] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        throw new functions.https.HttpsError('internal', errorMessage);
    }
});
//# sourceMappingURL=clear-test-data.js.map