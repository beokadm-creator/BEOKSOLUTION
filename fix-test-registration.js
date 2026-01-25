// 이 스크립트는 Firebase Console의 Firestore에서 실행하여
// test@test.com 등록 문서를 생성합니다.

const confId = 'kadd_2026spring';
const uid = 'i0de4emAUcSpeEybAiQBaadH5DT2';
const email = 'test@test.com';
const password = '테스트한비밀번호입력하세요';

// registrations 컬렉션에 문서 생성
const regRef = db.collection(`conferences/${confId}/registrations`).doc(uid);

await regRef.set({
    id: uid,
    userId: uid,
    userInfo: {
        name: '테스트',
        email: email,
        phone: '010-0000-0000',
        affiliation: '테스트 소속'
    },
    email: email,
    phone: '010-0000-0000',
    name: '테스트',
    password: password,
    conferenceId: confId,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    amount: 0,
    tier: 'NON_MEMBER',
    categoryName: '비회원',
    orderId: 'TEST-' + Date.now(),
    memberVerificationData: null,
    isAnonymous: false,
    agreements: {},
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
});

console.log('Registration document created:', uid);
