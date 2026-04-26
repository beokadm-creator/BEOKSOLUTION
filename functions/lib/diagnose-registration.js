"use strict";
/**
 * 진단 스크립트: 등록 데이터 불일치 문제 확인
 *
 * 사용법:
 * 1. Firebase Console의 Functions 탭에서 이 코드를 복사하여 테스트 함수로 실행
 * 2. 또는 로컬에서 node diagnose.mjs <userId>로 실행
 */
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
exports.diagnoseRegistration = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
/**
 * 특정 사용자의 등록 데이터 상태 진단
 */
async function diagnoseUserRegistration(userId, conferenceSlug = 'kadd_2026spring') {
    // 1. Participations 데이터 확인
    try {
        const participationsRef = db.collection(`users/${userId}/participations`);
        const participationsSnap = await participationsRef.get();
        for (const docSnap of participationsSnap.docs) {
            const data = docSnap.data();
            if (data.conferenceId === conferenceSlug || data.slug === conferenceSlug) {
                // Target conference found
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ 오류: ${errorMessage}`);
    }
    // 2. Registrations 데이터 확인
    try {
        const registrationsRef = db.collection(`conferences/${conferenceSlug}/registrations`);
        const q = registrationsRef.where('userId', '==', userId);
        const registrationsSnap = await q.get();
        if (!registrationsSnap.empty) {
            const firstReg = registrationsSnap.docs[0].data();
            if (firstReg.paymentStatus !== 'PAID') {
                // paymentStatus not PAID
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ 오류: ${errorMessage}`);
    }
    // 3. Conference 문서 확인
    try {
        const confRef = db.doc(`conferences/${conferenceSlug}`);
        const confSnap = await confRef.get();
        if (confSnap.exists) {
            // Conference document exists
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ 오류: ${errorMessage}`);
    }
    // 4. User 문서 확인
    try {
        const userRef = db.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            // User document exists
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ 오류: ${errorMessage}`);
    }
}
/**
 * Cloud Function으로 실행할 때
 */
exports.diagnoseRegistration = functions.https.onCall(async (data, context) => {
    const requestData = data;
    const { userId, conferenceSlug } = requestData;
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
        console.error('사용법: node diagnose.js <userId> [conferenceSlug]');
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
//# sourceMappingURL=diagnose-registration.js.map