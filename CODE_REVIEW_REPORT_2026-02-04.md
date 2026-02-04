# eRegi 시스템 종합 코드 리뷰 보고서

**작성일:** 2026-02-04  
**리뷰 범위:** 전체 코드베이스 (프론트엔드, 백엔드, 아키텍처)  
**목적:** 취약점 분석, 컴포넌트 구조 검토, 프로세스 연결성 확인

---

## 📋 목차

1. [전체 시스템 개요](#1-전체-시스템-개요)
2. [아키텍처 분석](#2-아키텍처-분석)
3. [취약점 분석](#3-취약점-분석)
4. [컴포넌트 구조 분석](#4-컴포넌트-구조-분석)
5. [프로세스 연결성 검증](#5-프로세스-연결성-검증)
6. [보안 및 성능 이슈](#6-보안-및-성능-이슈)
7. [개선 권장사항](#7-개선-권장사항)
8. [빌드 안정성 체크리스트](#8-빌드-안정성-체크리스트)

---

## 1. 전체 시스템 개요

### 1.1 기술 스택
```yaml
Frontend:
  - React 19.2.0
  - TypeScript 5.9.3
  - Vite (rolldown-vite 7.2.5)
  - React Router DOM 7.12.0
  - Zustand 5.0.10 (상태관리)
  - TailwindCSS 4.1.18
  - Radix UI (컴포넌트)

Backend:
  - Firebase (Firestore, Auth, Functions, Storage)
  - Cloud Functions (Node.js)

Payment:
  - Toss Payments SDK
  - NicePay (Legacy)

Testing:
  - Playwright 1.58.0
  - Jest 30.2.0
```

### 1.2 프로젝트 구조
```
src/
├── components/      # 77개 컴포넌트
│   ├── admin/       # 관리자 UI
│   ├── auth/        # 인증 관련
│   ├── common/      # 공통 컴포넌트
│   ├── conference/  # 학술대회 관련
│   ├── payment/     # 결제 관련
│   └── ui/          # shadcn/ui 기반
├── hooks/           # 28개 커스텀 훅
├── pages/           # 59개 페이지
├── contexts/        # 5개 Context
├── layouts/         # 6개 레이아웃
├── utils/           # 20개 유틸리티
├── types/           # 5개 타입 정의
└── store/           # 2개 Zustand 스토어
```

---

## 2. 아키텍처 분석

### 2.1 멀티테넌트 구조 ✅ 양호

**강점:**
- 도메인 기반 테넌트 분리 (subdomain 활용)
- Firestore 경로 격리: `conferences/{societyId}_{slug}`
- Security Rules로 데이터 격리 보장

**구조:**
```typescript
// App.tsx - 도메인별 라우팅
if (subdomain === 'kadd' || subdomain === 'kap') {
  // Society-specific routing
}
```

**Firestore 계층:**
```
societies/{societyId}/
  ├── settings/
  ├── members/
  └── notification-templates/

conferences/{societyId}_{slug}/
  ├── registrations/
  ├── submissions/
  ├── sessions/
  └── badge_tokens/

users/{userId}/
  └── participations/{confId}
```

### 2.2 라우팅 구조 ✅ 체계적

**3단계 도메인 분리:**
1. **Admin Domain** (`admin.eregi.co.kr`)
   - SuperLayout → Society/Conf/Vendor Layouts
2. **Society Subdomain** (`kadd.eregi.co.kr`)
   - Society + Conference 통합 라우팅
3. **Main Domain** (`eregi.co.kr`)
   - 범용 접근

**우선순위 기반 라우팅:**
```typescript
// App.tsx lines 98-201
Routes:
  0. Admin Routes (AdminGuard)
  1. Global Auth (/auth, /portal)
  2. MyPage (/mypage)
  3. Badge (/:slug/badge)
  4. Conference Routes (/:slug/*)
  5. Conference Landing (/:slug)
  6. Society Landing (/)
```

### 2.3 상태 관리 ⚠️ 개선 필요

**현재 상태:**
- Zustand: `userStore` (언어, 사용자 정보)
- Context: 5개 (Global, Society, Conf, Vendor, ConfContext)
- Local State: 각 컴포넌트별 useState

**문제점:**
1. **상태 분산**: Zustand + Context + Local State 혼재
2. **중복 데이터**: 동일 데이터를 여러 곳에서 관리
3. **동기화 이슈**: useAuth와 userStore 간 불일치 가능성

**예시:**
```typescript
// useAuth.ts - Firebase Auth 상태
const [auth, setAuth] = useState<AuthState>({
  user: null,
  loading: true,
  step: 'IDLE',
  error: null,
});

// userStore.ts - Zustand 상태
interface UserState {
  user: ConferenceUser | null;
  language: 'ko' | 'en';
  setUser: (user: ConferenceUser | null) => void;
  setLanguage: (lang: 'ko' | 'en') => void;
}
```

---

## 3. 취약점 분석

### 3.1 🔴 보안 취약점

#### 3.1.1 Firestore Rules - 과도한 권한

**파일:** `firestore.rules`

**문제:**
```javascript
// Line 9: Super Admin God Mode
match /{document=**} {
  allow read, write: if request.auth != null && 
    request.auth.token.email == 'aaron@beoksolution.com';
}

// Line 17: Society - 모든 쓰기 허용
match /societies/{societyId} {
  allow read: if true;
  allow write: if true; // ⚠️ 위험!
}

// Line 34: Conference - 모든 쓰기 허용
match /conferences/{confId} {
  allow read: if true;
  allow write: if true; // ⚠️ 위험!
}
```

**위험도:** 🔴 높음

**영향:**
- 인증되지 않은 사용자도 society/conference 데이터 수정 가능
- 데이터 무결성 위협
- 악의적 공격에 취약

**권장 수정:**
```javascript
match /societies/{societyId} {
  allow read: if true;
  allow write: if request.auth != null && (
    request.auth.token.email == 'aaron@beoksolution.com' ||
    request.auth.token.societyAdmin == societyId
  );
}

match /conferences/{confId} {
  allow read: if true;
  allow write: if request.auth != null && (
    request.auth.token.email == 'aaron@beoksolution.com' ||
    request.auth.token.confAdmin == confId
  );
}
```

#### 3.1.2 비밀번호 평문 저장

**파일:** `src/pages/RegistrationPage.tsx` (line 438)

**문제:**
```typescript
await setDoc(doc(db, 'users', uid), {
  simplePassword: formData.simplePassword ? 
    btoa(formData.simplePassword) : null, // ⚠️ Base64는 암호화가 아님!
}, { merge: true });
```

**위험도:** 🔴 높음

**영향:**
- Base64는 인코딩일 뿐, 쉽게 디코딩 가능
- 사용자 비밀번호 노출 위험

**권장 수정:**
```typescript
// 비밀번호를 Firestore에 저장하지 말 것
// Firebase Auth가 이미 비밀번호를 안전하게 관리함
// 필요시 Cloud Functions에서 bcrypt 사용

// 삭제 권장:
// simplePassword: formData.simplePassword ? btoa(...) : null
```

#### 3.1.3 환경 변수 노출

**파일:** `src/firebase.ts`

**문제:**
```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // ... 모든 설정이 클라이언트에 노출됨
};
```

**위험도:** 🟡 중간

**참고:**
- Firebase API Key는 공개되어도 괜찮음 (공식 문서 참조)
- 하지만 Firestore Rules로 보안 강화 필수
- `.env` 파일이 `.gitignore`에 포함되어 있는지 확인 필요

### 3.2 🟡 데이터 무결성 이슈

#### 3.2.1 Registration ID 불일치

**파일:** `src/hooks/useRegistrationsPagination.ts`

**문제:**
```typescript
// Line 109-116: ID 중복 처리
const flattened = {
  id: d.id,  // Firestore document ID
  ...docData
} as RootRegistration;

if (!flattened.orderId) {
  flattened.orderId = flattened.id;  // Fallback
}
```

**위험도:** 🟡 중간

**영향:**
- `orderId`와 `id`가 다를 수 있음
- 결제 추적 시 혼란 가능

**권장:**
- 등록 생성 시 `orderId`를 필수로 설정
- `id`와 `orderId`를 명확히 구분

#### 3.2.2 중복 등록 방지 부재

**파일:** `src/pages/RegistrationPage.tsx`

**문제:**
```typescript
// Line 472: 등록 생성 시 중복 체크 없음
const regRef = doc(collection(db, `conferences/${confId}/registrations`));
await setDoc(regRef, regData);
```

**위험도:** 🟡 중간

**영향:**
- 동일 사용자가 여러 번 등록 가능
- 중복 결제 발생 가능

**권장 수정:**
```typescript
// 등록 전 기존 등록 확인
const existingReg = await getDocs(
  query(
    collection(db, `conferences/${confId}/registrations`),
    where('userId', '==', userId),
    where('status', '==', 'PAID')
  )
);

if (!existingReg.empty) {
  throw new Error('이미 등록된 사용자입니다.');
}
```

### 3.3 🟢 인증 관련 (양호)

**강점:**
- Firebase Auth 활용
- Custom Token 기반 크로스 도메인 인증
- Session 관리 (`sessionManager.ts`)

**개선 가능:**
```typescript
// useAuth.ts - 무한 루프 방지 로직 존재
// Line 116-131: Value Comparison으로 리렌더링 최소화
const prevUserStr = JSON.stringify(prev.user);
const newUserStr = JSON.stringify(userWithId);

if (prevUserStr === newUserStr && prev.step === 'LOGGED_IN' && !prev.loading) {
  return prev;
}
```

---

## 4. 컴포넌트 구조 분석

### 4.1 컴포넌트 분리 ✅ 양호

**계층 구조:**
```
Pages (59개)
  ↓ 사용
Layouts (6개)
  ↓ 사용
Components (77개)
  ├── admin/      # 관리자 전용
  ├── conference/ # 학술대회 UI
  ├── common/     # 공통 (Header, Footer, Loading)
  └── ui/         # shadcn/ui 기반 재사용 컴포넌트
```

**강점:**
- 명확한 책임 분리
- 재사용 가능한 UI 컴포넌트
- shadcn/ui 기반 일관성

### 4.2 Hooks 구조 ✅ 우수

**28개 커스텀 훅:**
```typescript
// 데이터 관리
useAuth.ts              // 인증 상태
useConference.ts        // 학술대회 정보
useRegistration.ts      // 등록 로직
useAbstracts.ts         // 초록 제출

// UI 로직
useLanguage.ts          // 다국어
useExcel.ts             // 엑셀 다운로드
useBixolon.ts           // 프린터 연동

// 관리자
useAdmin.ts
useSuperAdmin.ts
useConferenceAdmin.ts
```

**강점:**
- 비즈니스 로직과 UI 분리
- 재사용성 높음
- 테스트 용이

**개선 가능:**
```typescript
// useRegistrationsPagination.ts
// 페이지네이션 로직이 복잡함 (196줄)
// → 더 작은 단위로 분리 고려
```

### 4.3 ⚠️ 컴포넌트 크기 이슈

**대형 컴포넌트:**
```
RegistrationPage.tsx        - 884줄  🔴
RegistrationListPage.tsx    - 538줄  🟡
App.tsx                     - 336줄  🟡
```

**문제:**
- 유지보수 어려움
- 테스트 복잡도 증가
- 재사용성 저하

**권장 리팩토링 (RegistrationPage.tsx):**
```typescript
// 현재: 단일 파일 884줄
RegistrationPage.tsx

// 제안: 컴포넌트 분리
RegistrationPage.tsx (메인 로직)
  ├── BasicInfoForm.tsx       (기본 정보 입력)
  ├── MemberVerificationForm.tsx (회원 인증)
  ├── PaymentSection.tsx      (결제)
  └── RegistrationSummary.tsx (요약)
```

---

## 5. 프로세스 연결성 검증

### 5.1 등록 → 결제 → 명찰 발급 ✅ 정상

**플로우:**
```
1. RegistrationPage
   ↓ 기본 정보 입력
2. Payment (Toss/Nice)
   ↓ 결제 성공
3. PaymentSuccessHandler
   ↓ Firestore 업데이트
4. Cloud Function (onPaymentSuccess)
   ↓ 등록 완료 처리
5. BadgePrepPage (바우처)
   ↓ 이메일 링크 접속
6. InfodeskPage
   ↓ QR 스캔
7. StandAloneBadgePage (디지털 명찰)
```

**검증 결과:**
- ✅ 각 단계 연결 정상
- ✅ 에러 핸들링 존재
- ✅ 실시간 동기화 (onSnapshot)

### 5.2 회원 인증 → 할인 적용 ✅ 정상

**플로우:**
```
1. useMemberVerification.verifyMember()
   ↓ societies/{sid}/members 쿼리
2. memberVerificationData 저장
   ↓ state 업데이트
3. Price Calculation (useEffect)
   ↓ activePeriod.prices[gradeCode]
4. Payment
   ↓ memberVerificationData 포함
5. Cloud Function
   ↓ 회원 코드 잠금 (used: true)
```

**검증 결과:**
- ✅ 회원 인증 로직 정상
- ✅ 할인 가격 적용 정상
- ⚠️ 등급 매칭 로직 복잡 (RegistrationPage.tsx lines 236-330)

### 5.3 초록 제출 → 심사 ✅ 정상

**플로우:**
```
1. AbstractSubmissionPage
   ↓ 등록 상태 확인 (PAID)
2. useAbstracts.submitAbstract()
   ↓ conferences/{confId}/submissions
3. AbstractManagerPage (관리자)
   ↓ 심사 상태 업데이트
4. AbstractSubmissionPage
   ↓ 실시간 상태 표시
```

**검증 결과:**
- ✅ 회원/비회원 모두 지원
- ✅ 파일 업로드 정상 (Firebase Storage)
- ✅ 마감 기한 체크

### 5.4 출결 관리 ✅ 정상

**플로우:**
```
1. GatePage (키오스크)
   ↓ badgeQr 스캔
2. Firestore 업데이트
   ↓ attendanceStatus: 'INSIDE'
   ↓ logs 추가
3. StandAloneBadgePage
   ↓ 실시간 상태 표시
4. AttendanceLivePage (관리자)
   ↓ 실시간 모니터링
```

**검증 결과:**
- ✅ 입장/퇴장 로직 정상
- ✅ 시간 계산 정확
- ✅ Zone 별 관리 가능

### 5.5 ⚠️ 데이터 동기화 이슈

**문제:**
```typescript
// useAuth.ts - users/{uid} 실시간 리스너
onSnapshot(userDocRef, (docSnap) => {
  // 사용자 정보 업데이트
});

// RegistrationPage.tsx - 사용자 정보 pre-fill
if (auth.user) {
  setFormData(prev => ({
    ...prev,
    name: prev.name || uData.name || uData.userName || '',
    phone: uData.phone || uData.phoneNumber || '',
    // ⚠️ 필드명 불일치 (phone vs phoneNumber)
  }));
}
```

**영향:**
- 필드명 불일치로 데이터 누락 가능
- `phone` vs `phoneNumber`
- `affiliation` vs `organization`

**권장:**
```typescript
// types/schema.ts - 통일된 타입 정의
export interface ConferenceUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone: string;  // ✅ 단일 필드명
  organization: string;  // ✅ 단일 필드명
  // ...
}

// 모든 곳에서 동일한 필드명 사용
```

---

## 6. 보안 및 성능 이슈

### 6.1 🔴 보안 이슈 요약

| 항목 | 위험도 | 설명 | 우선순위 |
|------|--------|------|----------|
| Firestore Rules 과도한 권한 | 🔴 높음 | society/conference write: true | P0 |
| 비밀번호 평문 저장 | 🔴 높음 | Base64 인코딩만 사용 | P0 |
| 중복 등록 방지 부재 | 🟡 중간 | 동일 사용자 중복 결제 가능 | P1 |
| XSS 방지 | 🟢 양호 | React 기본 보호 | - |
| CSRF 방지 | 🟢 양호 | Firebase Auth 토큰 | - |

### 6.2 🟡 성능 이슈

#### 6.2.1 Pagination 구현

**파일:** `src/hooks/useRegistrationsPagination.ts`

**현재:**
```typescript
// Firestore cursor-based pagination
const q = query(
  regRef,
  orderBy('createdAt', 'desc'),
  startAfter(lastVisible),
  limit(itemsPerPage)
);
```

**문제:**
- "이전 페이지" 기능 제한적 (line 176-180)
- 전체 개수 파악 불가

**개선 가능:**
```typescript
// 전체 개수 캐싱
const [totalCount, setTotalCount] = useState(0);

useEffect(() => {
  const countRef = doc(db, `conferences/${confId}/stats/registrations`);
  onSnapshot(countRef, (snap) => {
    setTotalCount(snap.data()?.count || 0);
  });
}, [confId]);
```

#### 6.2.2 실시간 리스너 과다

**문제:**
```typescript
// useAuth.ts - 모든 사용자마다 리스너
onSnapshot(userDocRef, ...);

// StandAloneBadgePage.tsx - 등록 리스너
onSnapshot(q, ...);

// BadgePrepPage.tsx - 2초마다 폴링
setInterval(() => validateToken(), 2000);
```

**영향:**
- Firestore 읽기 비용 증가
- 불필요한 리렌더링

**권장:**
```typescript
// 폴링 대신 리스너 사용
// 리스너 정리 (cleanup) 철저히
useEffect(() => {
  const unsubscribe = onSnapshot(...);
  return () => unsubscribe();
}, []);
```

### 6.3 🟢 성능 최적화 (양호)

**강점:**
- React.memo 사용 (일부 컴포넌트)
- useCallback, useMemo 활용
- Code Splitting (React Router)

---

## 7. 개선 권장사항

### 7.1 🔴 긴급 (P0)

#### 1. Firestore Rules 강화
```javascript
// firestore.rules
match /societies/{societyId} {
  allow read: if true;
  allow write: if request.auth != null && (
    request.auth.token.email == 'aaron@beoksolution.com' ||
    request.auth.token.societyAdmin == societyId
  );
}

match /conferences/{confId} {
  allow read: if true;
  allow write: if request.auth != null && (
    request.auth.token.email == 'aaron@beoksolution.com' ||
    request.auth.token.confAdmin == confId
  );
}
```

#### 2. 비밀번호 저장 제거
```typescript
// RegistrationPage.tsx
// 삭제:
// simplePassword: formData.simplePassword ? btoa(...) : null

// Firebase Auth가 비밀번호를 안전하게 관리함
```

#### 3. 중복 등록 방지
```typescript
// RegistrationPage.tsx - handlePayment() 시작 부분
const existingReg = await getDocs(
  query(
    collection(db, `conferences/${confId}/registrations`),
    where('userId', '==', userId),
    where('status', 'in', ['PAID', 'PENDING'])
  )
);

if (!existingReg.empty) {
  toast.error('이미 등록된 사용자입니다.');
  return;
}
```

### 7.2 🟡 중요 (P1)

#### 1. 컴포넌트 분리
```typescript
// RegistrationPage.tsx 리팩토링
src/pages/registration/
  ├── RegistrationPage.tsx (메인)
  ├── components/
  │   ├── BasicInfoForm.tsx
  │   ├── MemberVerificationForm.tsx
  │   ├── PaymentSection.tsx
  │   └── RegistrationSummary.tsx
  └── hooks/
      └── useRegistrationForm.ts
```

#### 2. 타입 정의 통일
```typescript
// types/schema.ts
export interface ConferenceUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone: string;  // ✅ 통일
  organization: string;  // ✅ 통일
  licenseNumber?: string;
  tier: 'MEMBER' | 'NON_MEMBER';
  authStatus: {
    emailVerified: boolean;
    phoneVerified: boolean;
  };
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// 모든 파일에서 동일한 필드명 사용
```

#### 3. 에러 핸들링 강화
```typescript
// utils/errorHandler.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
  }
}

export const handleFirestoreError = (error: unknown) => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return new AppError('PERMISSION_DENIED', '권한이 없습니다.', 403);
      case 'not-found':
        return new AppError('NOT_FOUND', '데이터를 찾을 수 없습니다.', 404);
      default:
        return new AppError('UNKNOWN', error.message);
    }
  }
  return new AppError('UNKNOWN', 'Unknown error');
};
```

### 7.3 🟢 개선 (P2)

#### 1. 상태 관리 통합
```typescript
// store/appStore.ts - Zustand 통합
interface AppState {
  // Auth
  user: ConferenceUser | null;
  authLoading: boolean;
  
  // Conference
  currentConference: Conference | null;
  
  // UI
  language: 'ko' | 'en';
  theme: 'light' | 'dark';
  
  // Actions
  setUser: (user: ConferenceUser | null) => void;
  setConference: (conf: Conference | null) => void;
  setLanguage: (lang: 'ko' | 'en') => void;
}

// Context 제거 또는 최소화
```

#### 2. 테스트 커버리지 확대
```typescript
// tests/integration/registration.spec.ts
describe('Registration Flow', () => {
  it('should complete registration for member', async () => {
    // 1. 회원 인증
    // 2. 정보 입력
    // 3. 결제
    // 4. 완료 확인
  });
  
  it('should prevent duplicate registration', async () => {
    // 중복 등록 시도
    // 에러 확인
  });
});
```

#### 3. 성능 모니터링
```typescript
// utils/performance.ts
export const measurePerformance = (name: string) => {
  const start = performance.now();
  
  return () => {
    const end = performance.now();
    console.log(`[Performance] ${name}: ${end - start}ms`);
    
    // Firebase Analytics 전송
    logEvent(analytics, 'performance', {
      name,
      duration: end - start
    });
  };
};

// 사용 예시
const measure = measurePerformance('registration_submit');
await submitRegistration();
measure();
```

---

## 8. 빌드 안정성 체크리스트

### 8.1 빌드 전 확인사항

```bash
# 1. 타입 체크
npm run lint

# 2. 빌드 테스트
npm run build

# 3. 프리뷰 확인
npm run preview
```

### 8.2 컴포넌트 분리 시 주의사항

**이전 실패 사례 참고:**
- 컴포넌트 분리 후 빌드 오류 발생 경험 있음
- 신중한 접근 필요

**안전한 리팩토링 절차:**

1. **브랜치 생성**
```bash
git checkout -b refactor/component-separation
```

2. **단계별 분리**
```typescript
// Step 1: 작은 컴포넌트부터 분리
// BasicInfoForm.tsx 분리

// Step 2: 빌드 확인
npm run build

// Step 3: 테스트
npm run test

// Step 4: 다음 컴포넌트 분리
// MemberVerificationForm.tsx 분리

// 반복...
```

3. **Import 경로 확인**
```typescript
// ❌ 상대 경로 혼란
import { Button } from '../../../components/ui/button';

// ✅ 절대 경로 사용 (tsconfig.json paths 설정)
import { Button } from '@/components/ui/button';
```

4. **타입 정의 확인**
```typescript
// 분리된 컴포넌트의 Props 타입 명시
interface BasicInfoFormProps {
  formData: FormData;
  onChange: (data: FormData) => void;
  onSave: () => Promise<void>;
  isLoading: boolean;
}

export const BasicInfoForm: React.FC<BasicInfoFormProps> = ({ ... }) => {
  // ...
};
```

5. **의존성 확인**
```typescript
// 순환 참조 방지
// A → B → C → A (❌)

// 단방향 의존성
// Page → Components → UI (✅)
```

### 8.3 빌드 오류 디버깅

**자주 발생하는 오류:**

1. **타입 오류**
```typescript
// 오류: Property 'xxx' does not exist on type 'yyy'
// 해결: 타입 정의 확인 및 수정
```

2. **Import 오류**
```typescript
// 오류: Module not found
// 해결: 경로 확인, tsconfig.json paths 확인
```

3. **Circular Dependency**
```typescript
// 오류: Circular dependency detected
// 해결: 의존성 구조 재설계
```

### 8.4 배포 전 체크리스트

- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] `npm run preview` 정상 작동
- [ ] 주요 플로우 수동 테스트
  - [ ] 회원 등록
  - [ ] 비회원 등록
  - [ ] 초록 제출
  - [ ] 명찰 발급
  - [ ] 출결 체크
- [ ] Firestore Rules 배포
- [ ] Cloud Functions 배포
- [ ] 환경 변수 확인

---

## 9. 결론 및 종합 평가

### 9.1 전체 평가

| 항목 | 점수 | 평가 |
|------|------|------|
| **아키텍처** | 8/10 | 멀티테넌트 구조 우수, 라우팅 체계적 |
| **보안** | 5/10 | Firestore Rules 취약, 비밀번호 관리 문제 |
| **코드 품질** | 7/10 | 컴포넌트 분리 양호, 일부 대형 파일 존재 |
| **성능** | 7/10 | 최적화 양호, 리스너 관리 개선 필요 |
| **유지보수성** | 6/10 | 타입 정의 불일치, 상태 관리 분산 |
| **테스트** | 4/10 | 테스트 커버리지 낮음 |

**종합 점수: 6.2/10**

### 9.2 강점

1. ✅ **체계적인 멀티테넌트 아키텍처**
   - 도메인 기반 격리
   - Firestore 경로 설계 우수

2. ✅ **우수한 Hooks 구조**
   - 비즈니스 로직 분리
   - 재사용성 높음

3. ✅ **완성도 높은 프로세스**
   - 등록 → 결제 → 명찰 발급 플로우 완벽
   - 실시간 동기화 구현

4. ✅ **현대적인 기술 스택**
   - React 19, TypeScript, Vite
   - Firebase 완전 활용

### 9.3 개선 필요 사항

1. 🔴 **보안 강화 (긴급)**
   - Firestore Rules 권한 제한
   - 비밀번호 저장 방식 개선
   - 중복 등록 방지

2. 🟡 **코드 품질 개선**
   - 대형 컴포넌트 분리
   - 타입 정의 통일
   - 상태 관리 통합

3. 🟢 **성능 최적화**
   - 리스너 최적화
   - 캐싱 전략
   - 번들 사이즈 최적화

### 9.4 다음 단계 권장사항

**즉시 실행 (이번 주):**
1. Firestore Rules 수정 및 배포
2. 비밀번호 저장 로직 제거
3. 중복 등록 방지 로직 추가

**단기 목표 (1-2주):**
1. RegistrationPage 컴포넌트 분리
2. 타입 정의 통일 (ConferenceUser 등)
3. 에러 핸들링 강화

**중기 목표 (1개월):**
1. 테스트 커버리지 50% 이상
2. 성능 모니터링 도입
3. 상태 관리 통합

**장기 목표 (3개월):**
1. 전체 리팩토링 (필요 시)
2. CI/CD 파이프라인 강화
3. 문서화 완성

---

## 부록

### A. 주요 파일 목록

**핵심 파일 (수정 시 주의):**
```
src/App.tsx                          # 라우팅 메인
src/hooks/useAuth.ts                 # 인증 핵심
src/pages/RegistrationPage.tsx      # 등록 메인
src/hooks/useRegistrationsPagination.ts  # 등록 목록
firestore.rules                      # 보안 규칙
```

### B. 환경 변수 목록

```env
# .env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

### C. 참고 문서

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [SCENARIO_TEST_GUIDE.md](./SCENARIO_TEST_GUIDE.md)

---

**작성자:** Antigravity AI  
**검토 필요:** 개발팀 전체  
**다음 리뷰:** 2026-03-04 (1개월 후)
