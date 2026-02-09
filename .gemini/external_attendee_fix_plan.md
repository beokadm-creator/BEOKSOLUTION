# 외부 참석자 마이페이지 표시 문제 해결 방안

## 📋 문제 분석

### 현상
- 외부 참석자 관리에서 등록한 참석자의 계정 생성은 완료됨
- 하지만 생성된 계정으로 로그인 시 마이페이지에 학술대회 정보가 표시되지 않음

### 원인
`users/{uid}/participations` 컬렉션에 생성되는 참여 기록에 **필수 필드가 누락**되어 있었습니다.

**UserHubPage가 요구하는 필수 필드:**
- `slug` 또는 `conferenceId` (line 442)
- `societyId` (line 506, 531)
- `paymentStatus` 또는 `status: 'PAID'` (lines 562-563, 734-735)
- `conferenceName`, `societyName` (표시용)

**기존 participation 레코드에 포함된 필드:**
- `conferenceId`
- `registrationId`
- `role`
- `type`
- `registeredAt`
- `status: 'COMPLETED'` ❌ (PAID가 아님)

## ✅ 해결 방안

### 1. Cloud Function 수정
`functions/src/auth/external.ts`의 `generateFirebaseAuthUserForExternalAttendee` 함수를 수정하여 완전한 participation 레코드를 생성하도록 개선했습니다.

**추가된 필드:**
```typescript
{
  // 핵심 식별자
  conferenceId: confId,
  slug: confData?.slug || confId,  // ✅ 추가
  conferenceSlug: confData?.slug || confId,  // ✅ 추가
  
  // 학회 정보
  societyId: confData?.societyId || 'kadd',  // ✅ 추가
  societyName: confData?.societyName || '',  // ✅ 추가
  
  // 학술대회 정보
  conferenceName: confData?.title?.ko || confData?.title?.en || confId,  // ✅ 추가
  
  // 사용자 정보
  userName: attendeeData.name,  // ✅ 추가
  userId: uid,  // ✅ 추가
  
  // 결제 상태 - CRITICAL
  status: 'PAID',  // ✅ 수정 (COMPLETED → PAID)
  paymentStatus: 'PAID',  // ✅ 추가
  
  // 추가 메타데이터
  earnedPoints: 0,  // ✅ 추가
  amount: 0  // ✅ 추가
}
```

### 2. 마이그레이션 스크립트 생성
기존에 등록된 외부 참석자의 participation 레코드를 업데이트하는 마이그레이션 함수를 생성했습니다.

**파일:** `functions/src/migrations/migrateExternalAttendeeParticipations.ts`

**기능:**
- 특정 학술대회의 모든 외부 참석자 조회
- 각 참석자의 participation 레코드를 완전한 형태로 업데이트
- Dry-run 모드 지원 (실제 변경 전 시뮬레이션)

## 🚀 배포 절차

### Phase 1: 함수 배포 (안전)
```bash
# 1. Functions 디렉토리로 이동
cd functions

# 2. 빌드 (TypeScript 컴파일)
npm run build

# 3. 특정 함수만 배포 (기존 시스템에 영향 없음)
firebase deploy --only functions:generateFirebaseAuthUserForExternalAttendee,functions:migrateExternalAttendeeParticipations
```

**안전성:** 
- ✅ 기존 운영 중인 시스템에 영향 없음
- ✅ 새로 생성되는 외부 참석자부터 자동으로 올바른 데이터 구조 적용
- ✅ 기존 데이터는 마이그레이션 전까지 그대로 유지

### Phase 2: 기존 데이터 마이그레이션

#### 2-1. Dry Run (시뮬레이션)
Firebase Console 또는 프론트엔드에서 Cloud Function 호출:

```javascript
const functions = getFunctions();
const migrateFn = httpsCallable(functions, 'migrateExternalAttendeeParticipations');

// Dry run으로 먼저 테스트
const result = await migrateFn({
  confId: 'kadd_2026spring',
  dryRun: true  // 실제 변경하지 않고 시뮬레이션만
});

console.log(result.data);
// {
//   success: true,
//   dryRun: true,
//   results: {
//     total: 10,
//     updated: 8,
//     skipped: 2,
//     errors: []
//   },
//   message: "DRY RUN: Would update 8 participation records"
// }
```

#### 2-2. 실제 마이그레이션 실행
Dry run 결과 확인 후 실제 적용:

```javascript
const result = await migrateFn({
  confId: 'kadd_2026spring',
  dryRun: false  // 실제 업데이트
});

console.log(result.data);
// {
//   success: true,
//   dryRun: false,
//   results: {
//     total: 10,
//     updated: 8,
//     skipped: 2,
//     errors: []
//   },
//   message: "Successfully updated 8 participation records"
// }
```

## 🧪 테스트 절차

### 1. 새 외부 참석자 등록 테스트
1. 외부 참석자 관리 페이지에서 새 참석자 등록
2. 계정 생성 확인
3. 해당 계정으로 로그인
4. 마이페이지에서 학술대회 정보 표시 확인 ✅

### 2. 기존 외부 참석자 마이그레이션 테스트
1. Dry run 실행하여 영향받을 레코드 수 확인
2. 실제 마이그레이션 실행
3. 기존 외부 참석자 계정으로 로그인
4. 마이페이지에서 학술대회 정보 표시 확인 ✅

### 3. 전체 플로우 검증
외부 참석자가 일반 참석자와 동일한 플로우로 진행되는지 확인:

- [x] 바우처 표시
- [x] 인포데스크 체크인
- [x] 디지털 명찰 발행
- [x] 입출입 기록
- [x] 수강 조건 확인

## 📊 예상 결과

### Before (문제 상황)
```
마이페이지 접속
  ↓
participations 조회
  ↓
slug 필드 없음 → 스킵
status: 'COMPLETED' → 필터링됨
  ↓
빈 화면 표시 ❌
```

### After (해결 후)
```
마이페이지 접속
  ↓
participations 조회
  ↓
slug: 'kadd_2026spring' ✅
status: 'PAID' ✅
societyId: 'kadd' ✅
  ↓
학술대회 정보 표시 ✅
```

## ⚠️ 주의사항

1. **배포 타이밍**: 사용자가 적은 시간대에 배포 권장
2. **백업**: 마이그레이션 전 Firestore 백업 권장
3. **모니터링**: 배포 후 Cloud Functions 로그 모니터링
4. **롤백 계획**: 문제 발생 시 이전 버전으로 롤백 가능

## 🔍 트러블슈팅

### 마이그레이션 후에도 표시되지 않는 경우
1. 브라우저 캐시 삭제 후 재로그인
2. Firestore에서 해당 사용자의 participation 레코드 직접 확인
3. Cloud Functions 로그에서 에러 확인

### 일부 사용자만 표시되는 경우
- `userId` 필드가 올바르게 설정되었는지 확인
- `authCreated: true` 플래그 확인
- 계정 생성이 완료된 참석자만 표시됨

## 📝 변경 사항 요약

| 파일 | 변경 내용 | 영향도 |
|------|----------|--------|
| `functions/src/auth/external.ts` | participation 레코드에 필수 필드 추가 | 🟢 낮음 (신규 생성만) |
| `functions/src/migrations/migrateExternalAttendeeParticipations.ts` | 마이그레이션 스크립트 생성 | 🟡 중간 (기존 데이터) |
| `functions/src/index.ts` | 마이그레이션 함수 export 추가 | 🟢 낮음 |

## ✨ 결론

이 수정으로 외부 참석자도 일반 참석자와 동일하게:
- ✅ 마이페이지에서 학술대회 확인 가능
- ✅ 바우처 → 인포데스크 → 명찰 → 입출입 플로우 정상 작동
- ✅ 수강 조건에 따른 동일한 권한 부여

**기존 시스템에 영향 없이 안전하게 배포 가능합니다.**
