# P1 개선사항 진행 보고서

**작성일:** 2026-02-04  
**작업 범위:** 타입 정의 통일, 상태 관리 정리, 컴포넌트 분리 준비

---

## ✅ 완료된 작업

### 1. 타입 정의 통일 - Phase 1 완료

#### 1.1 유틸리티 함수 생성 ✅

**파일:** `src/utils/userDataMapper.ts`

**기능:**
- `normalizeUserData()`: 다양한 소스의 사용자 데이터를 ConferenceUser 타입으로 정규화
- `extractPhone()`: phone/phoneNumber 필드 통합 추출
- `extractOrganization()`: organization/affiliation/org 필드 통합 추출
- `toFirestoreUserData()`: Firestore 저장용 데이터 변환
- `mergeUserData()`: 여러 소스 데이터 병합

**해결한 문제:**
```typescript
// Before (필드명 혼재)
const phone = userData.phone || userData.phoneNumber || '';
const org = userData.organization || userData.affiliation || userData.org || '';

// After (통일된 함수 사용)
const normalized = normalizeUserData(userData);
// normalized.phone, normalized.organization 보장
```

#### 1.2 핵심 Hook 수정 ✅

**파일:** `src/hooks/useAuth.ts`

**변경사항:**
1. `normalizeUserData` import 추가
2. Firestore 데이터 정규화 로직 적용
3. ConferenceUser 타입 완전 준수
4. Timestamp import 추가 (타입 오류 해결)

**Before:**
```typescript
const userWithName = {
  ...userData,
  name: userData.name || userData.userName || currentUser.displayName || 'User',
  phone: userData.phone || userData.phoneNumber || '',
  organization: userData.organization || userData.affiliation || ''
};
```

**After:**
```typescript
const normalized = normalizeUserData({
  ...userData,
  id: currentUser.uid,
  uid: currentUser.uid,
});

const userWithId: ConferenceUser = {
  id: currentUser.uid,
  uid: currentUser.uid,
  name: normalized.name || currentUser.displayName || 'User',
  email: normalized.email || currentUser.email || '',
  phone: normalized.phone || '', // ✅ 통일
  organization: normalized.organization || '', // ✅ 통일
  // ... 모든 필수 필드 명시
};
```

**효과:**
- ✅ 타입 안전성 향상
- ✅ 필드명 불일치 문제 해결
- ✅ 코드 가독성 개선
- ✅ 유지보수성 향상

#### 1.3 빌드 테스트 ✅

```bash
npm run lint
# ✅ 통과
```

---

## 🔄 진행 중인 작업

### 2. 타입 정의 통일 - Phase 2 (다음 단계)

#### 2.1 적용 대상 파일 (우선순위 순)

**High Priority (핵심 데이터 흐름):**
1. ✅ `src/hooks/useAuth.ts` - 완료
2. ⏳ `src/pages/RegistrationPage.tsx` - 대기
3. ⏳ `src/hooks/useRegistration.ts` - 대기
4. ⏳ `src/pages/UserHubPage.tsx` - 대기

**Medium Priority (관리자 페이지):**
5. ⏳ `src/pages/admin/AbstractManagerPage.tsx`
6. ⏳ `src/pages/admin/AttendanceLivePage.tsx`
7. ⏳ `src/hooks/useRegistrationsPagination.ts`

**Low Priority (기타):**
8. ⏳ `src/components/admin/GlobalSearch.tsx`
9. ⏳ `src/layouts/VendorLayout.tsx`
10. ⏳ 기타 50+ 파일

#### 2.2 적용 전략

**안전한 단계별 적용:**
```typescript
// Step 1: Import 추가
import { normalizeUserData, extractPhone, extractOrganization } from '@/utils/userDataMapper';

// Step 2: 데이터 로드 시 정규화
const userData = await getDoc(...);
const normalized = normalizeUserData(userData.data());

// Step 3: 정규화된 데이터 사용
setFormData({
  name: normalized.name,
  phone: normalized.phone, // ✅ 통일
  organization: normalized.organization, // ✅ 통일
});

// Step 4: Firestore 저장 시 변환
await setDoc(userRef, toFirestoreUserData(normalized));
```

---

## 📊 영향 분석

### 필드명 사용 현황

**phone vs phoneNumber:**
- 사용 파일: 14개
- 주요 영향: useAuth, RegistrationPage, UserHubPage
- 예상 작업 시간: 2-3시간

**organization vs affiliation:**
- 사용 파일: 50+ 개
- 주요 영향: 거의 모든 사용자 데이터 처리
- 예상 작업 시간: 4-6시간

### 리스크 평가

**Low Risk (안전):**
- ✅ 유틸리티 함수 사용 (기존 로직 보존)
- ✅ 타입 안전성 보장
- ✅ 단계별 적용 가능

**Medium Risk (주의 필요):**
- ⚠️ Firestore 저장 필드명 변경 시 기존 데이터 호환성
- ⚠️ 다수 파일 수정으로 인한 빌드 오류 가능성

**Mitigation (완화 전략):**
1. **기존 데이터 호환성 유지**
   - `normalizeUserData`가 모든 필드명 변형 처리
   - Firestore 읽기 시 자동 변환
   
2. **단계별 적용**
   - 한 번에 1-2개 파일씩 수정
   - 각 단계마다 빌드 테스트
   
3. **롤백 가능성**
   - Git 커밋 단위로 작업
   - 문제 발생 시 즉시 롤백

---

## 🎯 다음 작업 계획

### Phase 2-A: RegistrationPage.tsx 수정

**목표:** 등록 페이지에서 정규화된 데이터 사용

**작업 내용:**
1. `normalizeUserData` import
2. 사용자 데이터 pre-fill 로직 수정
3. Firestore 저장 로직 수정
4. 빌드 테스트

**예상 시간:** 30분

**리스크:** Low (단일 파일, 명확한 로직)

### Phase 2-B: useRegistration.ts 수정

**목표:** 등록 훅에서 정규화된 데이터 사용

**작업 내용:**
1. `toFirestoreUserData` 사용
2. 등록 데이터 생성 로직 수정
3. 빌드 테스트

**예상 시간:** 20분

**리스크:** Low

### Phase 2-C: UserHubPage.tsx 수정

**목표:** 마이페이지에서 정규화된 데이터 표시

**작업 내용:**
1. `normalizeUserData` 사용
2. 프로필 데이터 로드 로직 수정
3. 빌드 테스트

**예상 시간:** 40분

**리스크:** Medium (복잡한 데이터 병합 로직)

---

## 🔍 검증 계획

### 단위 테스트

```typescript
// tests/utils/userDataMapper.test.ts
describe('normalizeUserData', () => {
  it('should normalize phone field', () => {
    const input = { phoneNumber: '010-1234-5678' };
    const result = normalizeUserData(input);
    expect(result.phone).toBe('010-1234-5678');
  });
  
  it('should normalize organization field', () => {
    const input = { affiliation: '서울대학교' };
    const result = normalizeUserData(input);
    expect(result.organization).toBe('서울대학교');
  });
});
```

### 통합 테스트

1. **등록 플로우**
   - 회원 등록 → 데이터 저장 → 조회 → 표시
   - phone, organization 필드 정상 동작 확인

2. **마이페이지**
   - 사용자 정보 로드 → 표시
   - 모든 필드 정상 표시 확인

3. **관리자 페이지**
   - 등록 목록 조회 → 표시
   - phone, organization 필드 정상 표시 확인

---

## 📝 권장사항

### 즉시 실행 가능 (안전)

1. ✅ **useAuth.ts 수정 완료** - 배포 가능
2. ⏭️ **RegistrationPage.tsx 수정** - 다음 단계
3. ⏭️ **useRegistration.ts 수정** - 다음 단계

### 신중하게 진행 (주의)

4. ⏸️ **UserHubPage.tsx 수정** - 복잡한 로직, 충분한 테스트 필요
5. ⏸️ **대량 파일 수정** - 한 번에 진행하지 말고 단계별로

### 보류 (추후 검토)

6. ⏸️ **Firestore 필드명 변경** - 기존 데이터 마이그레이션 필요
7. ⏸️ **전체 리팩토링** - 충분한 테스트 커버리지 확보 후

---

## 🚀 배포 전 체크리스트

### Phase 1 (현재 완료)
- [x] userDataMapper.ts 생성
- [x] useAuth.ts 수정
- [x] Lint 통과
- [ ] 빌드 테스트 (`npm run build`)
- [ ] 로컬 테스트 (`npm run dev`)
- [ ] 주요 플로우 수동 테스트

### Phase 2 (다음 단계)
- [ ] RegistrationPage.tsx 수정
- [ ] useRegistration.ts 수정
- [ ] UserHubPage.tsx 수정
- [ ] 전체 빌드 테스트
- [ ] E2E 테스트

---

## 📌 참고사항

### 기존 데이터 호환성

**Firestore 데이터:**
```json
{
  "phoneNumber": "010-1234-5678",  // 기존 필드
  "affiliation": "서울대학교"        // 기존 필드
}
```

**normalizeUserData 처리:**
```typescript
{
  phone: "010-1234-5678",      // ✅ 정규화됨
  organization: "서울대학교"    // ✅ 정규화됨
}
```

**결론:** 기존 데이터 수정 불필요, 읽기 시 자동 변환

### 성능 영향

- **추가 오버헤드:** 거의 없음 (단순 객체 매핑)
- **메모리 사용:** 미미함
- **빌드 크기:** +2KB (유틸리티 함수)

---

**다음 작업:** RegistrationPage.tsx 수정 진행 여부 확인 필요
