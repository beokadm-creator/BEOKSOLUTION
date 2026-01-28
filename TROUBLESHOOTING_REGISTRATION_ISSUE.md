# 등록 데이터 불일치 문제 해결 가이드

## 문제 현상

1. 마이페이지에서 등록 정보가 보임 (users/{uid}/participations에 있음)
2. Badge 페이지에서 "등록 정보가 없습니다" 오류 (conferences/{confId}/registrations에 없음)
3. 2026spring 페이지에서 "등록하기" 버튼 표시 (등록 완료인데도)

## 근본 원인

Cloud Function이 결제 완료 후 두 경로 모두 업데이트해야 하는데,
`conferences/{confId}/registrations` 업데이트가 실패했거나 실행되지 않음

---

## 해결 절차

### 1. Cloud Functions 재배포

```bash
# 1. Cloud Functions 빌드
cd functions
npm run build

# 2. Cloud Functions 배포
cd ..
firebase deploy --only functions

# 또는 특정 함수만 배포
firebase deploy --only functions:confirmNicePayment,confirmTossPayment
```

### 2. Firebase Console에서 로그 확인

1. Firebase Console → Functions → 로그 탭
2. 최근 `confirmNicePayment` 또는 `confirmTossPayment` 실행 로그 확인
3. 에러 메시지 확인:
   - `[Member Locked]` 메시지가 있는지 (성공 표시)
   - `[History Logged]` 메시지가 있는지 (participations 저장 성공 표시)
   - 에러가 있는지 확인

### 3. Firestore 데이터 직접 확인

#### A. Participations 데이터 확인 (마이페이지에 보이는 데이터)

```
경로: users/{userId}/participations
```

확인할 필드:
- `conferenceId`: 컨퍼런스 ID (예: `kadd_2026spring`)
- `slug`: 슬러그 (예: `kadd_2026spring`)
- `societyId`: 학회 ID (예: `kadd`)
- `status`: 상태 (예: `COMPLETED`)
- `paymentStatus`: 결제 상태 (예: `PAID`)

#### B. Registrations 데이터 확인 (Badge 페이지에서 찾는 데이터)

```
경로: conferences/kadd_2026spring/registrations
```

필터:
- `userId` == 현재 사용자의 UID
- `paymentStatus` == 'PAID'

이 데이터가 없는 것이 문제의 원인!

### 4. 문제 해결 방법

#### 방법 A: Cloud Functions 재배포로 자동 해결

결제 후에도 registrations가 업데이트되지 않는다면:
1. Cloud Functions 최신 버전 배포
2. 새로운 결제 테스트
3. 배포된 함수가 제대로 작동하는지 확인

#### 방법 B: 기존 데이터 수동 복구

이미 결제 완료된 사용자들의 registrations 데이터가 누락된 경우:

**스크립트로 복구:**
```javascript
// Firebase Console → Functions → 새 함수 추가
// 또는 로컬에서 실행

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function fixMissingRegistrations() {
  const participations = await db.collectionGroup('participations')
    .where('status', '==', 'COMPLETED')
    .where('paymentStatus', '==', 'PAID')
    .get();

  console.log(`Found ${participations.size} completed registrations`);

  for (const doc of participations.docs) {
    const data = doc.data();
    const userId = doc.ref.parent.parent?.id;
    const confId = data.conferenceId || data.slug;

    if (!userId || !confId) continue;

    // Check if registration exists
    const existingReg = await db.collection(`conferences/${confId}/registrations`)
      .where('userId', '==', userId)
      .get();

    if (!existingReg.empty) {
      console.log(`Registration exists for ${userId} in ${confId}`);
      continue;
    }

    // Create missing registration
    const newRegRef = await db.collection(`conferences/${confId}/registrations`).add({
      userId: userId,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      userName: data.userName,
      userEmail: data.userEmail,
      userPhone: data.userPhone,
      affiliation: data.userAffiliation,
      amount: data.amount,
      createdAt: data.registeredAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Created registration for ${userId} in ${confId}: ${newRegRef.id}`);
  }
}

fixMissingRegistrations().then(() => console.log('Done')).catch(console.error);
```

#### 방법 C: 진단 함수 사용 (추천)

배포된 `diagnose-registration` 함수 사용:

```javascript
// Firebase Console에서 실행하거나 callable function으로 호출
const functions = firebase.functions();
const diagnoseRegistration = functions.httpsCallable('diagnoseRegistration');

// 진단
await diagnoseRegistration({
  userId: 'USER_UID_HERE',
  conferenceSlug: 'kadd_2026spring'
});
```

결과로 어떤 데이터가 있고 없는지 확인 가능.

---

## 예방 방법

1. **Cloud Functions 항상 최신 버전 유지**
   - 코드 변경 후 즉시 배포
   - 배포 전 로컬 테스트

2. **결제 완료 로직의 트랜잭션 처리**
   - 두 경로 모두 업데이트되거나 둘 다 실패하도록 atomic transaction 사용
   - 현재 코드는 participations 저장은 성공, registrations 업데이트는 실패할 수 있음

3. **데이터 정기 검사**
   - 주기적으로 participations와 registrations 데이터 일치 여부 확인
   - 일치하지 않는 데이터 복구 스크립트 실행

4. **모니터링 알림**
   - 결제 완료 후 registrations 업데이트 실패 시 알림 설정
   - Firebase Error Reporting 활용

---

## 긴급 대응 (프로덕션)

사용자가 즉시 Badge를 받아야 하는 경우:

1. Firestore Console에서 직접 registrations 문서 생성
2. 다음 정보 복사:
   - userId: 사용자 UID
   - status: 'COMPLETED'
   - paymentStatus: 'PAID'
   - userName, userEmail, userPhone, affiliation: participations에서 복사
   - amount: 결제 금액
   - createdAt: 등록 날짜

3. 문서 ID는 자동 생성 (Firestore가 할당)

---

## 참고

- Cloud Functions 소스: `functions/src/index.ts`
- 결제 확인 함수:
  - `confirmNicePayment` (Line 70-127)
  - `confirmTossPayment` (Line 129-214)
- 진단 함수: `functions/src/diagnose-registration.ts`
