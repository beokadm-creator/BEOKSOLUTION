---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 8134
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

# eRegi 시스템 전체 분석 및 테스트 시나리오 레포트

**작성일:** 2026-01-25
**분석 범위:** 전체 시스템 (정회원/비회원 플로우, 멀티테넌트, URL vs DB 불일치, 파일 매핑)

---

## 1. 시스템 아키텍처 개요

### 1.1 멀티테넌트 구조

#### 테넌트 ID 구성
- **형식**: `confId = ${societyId}_${slug}`
- **예시**:
  - KAP 학회, 2026 봄 학술대회 → `kap_2026spring`
  - KADD 학회, 2026 봄 학술대회 → `kadd_2026spring`

#### 도메인 라우팅 (App.tsx lines 69-85)
```javascript
const getConferenceIdByDomain = () => {
  const hostname = window.location.hostname;

  // 1. KAP 도메인 접속 시
  if (hostname.includes('kap.eregi')) {
    return 'kap_2026Spring';
  }

  // 2. KADD 도메인 접속 시 (기본값)
  if (hostname.includes('kadd.eregi')) {
    return 'kadd_2026spring';
  }

  // 3. 로컬 개발환경(localhost) 또는 알 수 없는 도메인
  return 'kadd_2026spring';
};
```

#### Firestore 컬렉션 계층 구조
```
Root Collections:
├── societies/                    # N개 학회 (각 societyId)
│   ├── {societyId}
│   ├── settings/
│   ├── members/                   # 회원 목록 (회원 인증용)
│   └── notification-templates/    # 알림 템플릿
│
├── super_admins/                # 슈퍼 어드민 목록
│
├── users/                       # 전역 사용자 (모든 학회)
│   ├── {userId}
│   │   ├── participations/        # 사용자의 모든 참여 기록
│   │   ├── society_guests/       # 비회원 게스트 정보
│   │   └── affiliations/        # 학회 회원 인증 상태
│
└── conferences/                  # N개 × N개 컨퍼런스
    ├── {societyId}_{slug}       # 컨퍼런스 ID (테넌트)
    │   ├── info/                  # 컨퍼런스 기본 정보
    │   ├── settings/              # 등록, 출결 설정 등
    │   ├── users/                 # 컨퍼런스 내 사용자
    │   ├── registrations/         # 등록 내역
    │   │   ├── {regId}
    │   │   │   └── logs/        # 출결 로그
    │   ├── submissions/            # 초록 제출
    │   ├── agenda/                # 세션 아젠다
    │   ├── speakers/              # 발표자
    │   ├── pages/                 # CMS 페이지
    │   ├── access_logs/           # 출결 로그 (컬렉션 그룹)
    │   ├── badge_tokens/           # 디지털 명찰 토큰
    │   └── vendors/               # 벤더/업체
```

#### 테넌트 격리 방식
1. **도메인 기반**: `kap.eregi.co.kr` → KAP 데이터만 접근
2. **confId 기반 쿼리**: 모든 Firestore 쿼리는 `confId`로 격리
3. **Security Rules**: Firestore 규칙에서 테넌트 ID 검증

---

## 2. 정회원 (MEMBER) 전체 플로우

### 2.1 학술대회 등록 절차

#### 관련 파일
- **메인 페이지**: `src/pages/RegistrationPage.tsx`
- **훅**: `src/hooks/useRegistration.ts`, `src/hooks/useAuth.ts`, `src/hooks/useMemberVerification.ts`
- **라우트**: `/:slug/register`

#### 단계별 플로우

**STEP 0: 약관 동의 (Terms)**
1. 사용자가 이용약관, 개인정보처리방침, 제3자 제공 동의
2. `agreements` 상태에 저장
3. `initializeGuest()` 호출 (비회원 모드일 경우 익명 사용자 생성)

**STEP 1: 기본 정보 입력 (Info)**
1. 회원 정보 자동 완성 (users/{uid}에서 이름, 연락처, 소속, 면허번호)
2. 비회원: 직접 입력
3. 폼 데이터 자동 저장 (autoSave)

**STEP 2: 회원 인증 (Verification)**
1. **회원 인증**: `useMemberVerification.verifyMember()` 호출
   - 매개변수: `societyId`, `name`, `licenseNumber`, `consent`, `email`, `phone`
   - 컬렉션 그룹 쿼리: `societies/{sid}/members`에서 회원 코드 검증
2. 인증 성공 시:
   - `memberVerificationData` 상태 저장
   - `selectedGradeId` 자동 선택 (회원 등급에 따라)
3. 인증 실패 시: 비회원 등급으로 자동 전환

**STEP 3: 결제 (Payment)**
1. 결제 방식 선택 (Toss 또는 Nice)
2. Toss 결제:
   - `paymentWidget.requestPayment()` 호출
   - 콜백 URL: `/payment/success?slug={slug}&regId={regId}&userData=...`
3. Nice 결제:
   - `confirmNicePayment` CloudFunction 호출
4. CloudFunction 처리 후:
   - 등록 문서 생성: `conferences/{confId}/registrations/{regId}`
   - 회원 코드 잠금: `used: true`, `usedBy: {userId}`
   - 참여 기록 저장: `users/{uid}/participations/{regId}`

**STEP 4: 완료 (Complete)**
1. 등록 성공 메시지
2. `/register/success` 페이지로 리다이렉트
3. 영수증 정보 표시

#### Firestore 경로
```
회원 인증:
  → collectionGroup: 'societies/{societyId}/members'
  → where('licenseNumber', '==', code)

등록 문서:
  → doc: 'conferences/{confId}/registrations/{userId}'
  → fields: {
      userId, userName, userEmail, userPhone,
      paymentStatus: 'PAID',
      confirmationQr, badgeQr: null,
      isCheckedIn: false
    }

참여 기록:
  → doc: 'users/{userId}/participations/{confId}'
  → fields: { conferenceId, status, earnedPoints, userName, userAffiliation }
```

---

### 2.2 초록 제출

#### 관련 파일
- **메인 페이지**: `src/pages/AbstractSubmissionPage.tsx`
- **훅**: `src/hooks/useAbstracts.ts`, `src/hooks/useAuth.ts`, `src/hooks/useNonMemberAuth.ts`
- **라우트**: `/:slug/abstracts`

#### 플로우

**1. 접근 권한 확인**
1. 로그인 사용자: Firebase Auth currentUser 확인
2. 비회원: `useNonMemberAuth`로 세션 확인
3. 미로그인: 로그인 페이지로 리다이렉트

**2. 등록 상태 확인**
1. 회원: `conferences/{confId}/registrations`에서 `userId`로 쿼리
2. 비회원: `conferences/{confId}/registrations/{registrationId}` 확인
3. `paymentStatus: 'PAID'` 확인

**3. 초록 제출 (신규)**
1. 기본 정보: 제목(국/영), 분야, 발표 형식
2. 저자 정보: 이름, 이메일, 소속, 발표자 여부, 제1저자 여부
3. 파일 업로드: PDF/DOC/DOCX (최대 10MB)
4. 제출:
   - `conferences/{confId}/submissions/{subId}` 생성
   - `userId` 또는 `registrationId` 저장 (비회원 지원)

**4. 초록 수정**
- 마감 기간 내 `abstractEditDeadline`까지 수정 가능
- 기존 초록 데이터 폼에 로드
- 파일 교체 또는 수정

**5. 심사 상태**
- `submitted` → `pending` → `accepted_oral`/`accepted_poster`/`rejected`
- 심사 의견 표시

#### Firestore 경로
```
초록 제출:
  → doc: 'conferences/{confId}/submissions/{subId}'
  → fields: {
      userId, registrationId, submitterId,
      title: { ko, en }, field, type, status,
      authors: [{ name, email, affiliation, isPresenter, isFirstAuthor }],
      fileUrl, reviewStatus, reviewerComment,
      submittedAt, updatedAt
    }

제한 사항:
  - 신규 제출 마감: conferenceInfo.abstractSubmissionDeadline
  - 수정 마감: conferenceInfo.abstractEditDeadline
  - 결제 완료 필수: registration.status === 'PAID'
```

---

### 2.3 바우처 발급/사용

#### 관련 파일
- **메인 페이지**: `src/pages/BadgePrepPage.tsx`
- **훅**: `src/hooks/useConference.ts`
- **라우트**: `/:slug/badge-prep/:token`

#### 플로우

**1. 토큰 생성 (등록 완료 후 자동)**
1. CloudFunction: `generateBadgePrepToken` (등록 시 호출)
2. 토큰 생성: `conferences/{confId}/badge_tokens/{token}`
3. 이메일 발송: 바우처 링크 포함
4. 토큰 유효기간: 24시간

**2. 바우처 페이지 접근**
1. URL: `/{slug}/badge-prep/{token}`
2. CloudFunction: `validateBadgePrepToken` 호출
3. 상태 확인:
   - `ACTIVE`: 바우처 표시
   - `ISSUED`: 디지털 명찰 표시
   - `EXPIRED`: 만료 메시지

**3. 바우처 표시 (ACTIVE 상태)**
- 이름, 소속
- 영수증 번호
- **QR 코드**: `confirmationQr` (인포데스크 스캔용)
- 면허번호
- 안내: "현장 인포데스크에서 QR코드를 제시해주세요."

**4. 실시간 새로고침**
- 2초마다 토큰 상태 확인
- 인포데스크에서 디지털 명찰 발급 시 자동 전환

#### Firestore 경로
```
바우처 토큰:
  → doc: 'conferences/{confId}/badge_tokens/{token}'
  → fields: {
      token, registrationId, conferenceId, userId,
      status: 'ACTIVE' | 'ISSUED' | 'EXPIRED',
      createdAt, issuedAt, expiresAt
    }

등록 문서 (QR 정보):
  → doc: 'conferences/{confId}/registrations/{regId}'
  → fields: {
      confirmationQr: 'REG-{userId}',
      badgeQr: null (발급 전)
    }
```

---

### 2.4 인포데스크 운영

#### 관련 파일
- **메인 페이지**: `src/pages/admin/conf/InfodeskPage.tsx`
- **훅**: Firebase Cloud Functions (`issueDigitalBadge`)
- **라우트**: `/admin/conf/{cid}/infodesk`

#### 플로우

**1. 인포데스크 설정**
- 발급 옵션:
  - `DIGITAL_ONLY`: 디지털 명찰만
  - `DIGITAL_PRINT`: 디지털 + 인쇄
  - `PRINT_ONLY`: 인쇄만
- 디자인: 배경 이미지, 텍스트 색상
- LocalStorage 저장: `eregi_conf_{cid}_settings`

**2. QR 스캔**
1. QR 스캐너 입력 (바코드 스캐너 또는 키보드)
2. 스캔 코드 처리: `processScan(code)`
3. 등록 문서 조회: `conferences/{confId}/registrations/{code}`
4. 유효성 확인:
   - 등록 존재?
   - `status === 'PAID'`?

**3. 디지털 명찰 발급**
1. CloudFunction: `issueDigitalBadge` 호출
   - 매개변수: `confId`, `regId`, `issueOption`
2. 명찰 QR 생성: `badgeQr = 'BADGE-{regId}'`
3. 등록 문서 업데이트:
   - `badgeQr`: 'BADGE-{regId}'
   - `badgeIssued`: true
   - `issuedAt`: Timestamp
4. 인쇄 요청 (인쇄 옵션 시)

**4. 화면 표시**
- 성공: 사용자 이름, 소속 표시 (초록색 배경)
- 실패: 오류 메시지 (빨간색 배경)
- 3초 후 대기 상태로 복귀

#### Firestore 경로
```
명찰 발급:
  → CloudFunction: issueDigitalBadge
  → update: doc('conferences/{confId}/registrations/{regId}')
  → fields: {
      badgeQr: 'BADGE-{regId}',
      badgeIssued: true,
      issuedAt: Timestamp.now()
    }
```

---

### 2.5 디지털명찰 생성/표시

#### 관련 파일
- **메인 페이지**: `src/pages/StandAloneBadgePage.tsx`
- **훅**: Firebase Auth, Firestore (실시간 리스너)
- **라우트**: `/:slug/badge`

#### 플로우

**1. 접근 권한 확인**
1. Firebase Auth: `onAuthStateChanged`
2. 회원: `userId`로 등록 조회
3. 비회원: 세션 스토리지 확인 → `NonMemberHubPage`로 리다이렉트

**2. 등록 조회**
```javascript
const q = query(
  collection(db, 'conferences/{confId}/registrations'),
  where('userId', '==', user.uid),
  where('paymentStatus', '==', 'PAID')
);
```
3. 실시간 리스너: `onSnapshot(q, ...)`

**3. 명찰 상태별 표시**

**미발급 상태 (badgeQr === null)**
- 타이틀: "Registration Voucher"
- QR 코드: `confirmationQr` (regId)
- 안내: "현장 데스크에서 QR코드를 제시해주세요."
- 배경: 회색 테두리

**발급 상태 (badgeQr !== null)**
- 타이틀: "Digital Name Tag"
- QR 코드: `badgeQr` ('BADGE-{regId}')
- 출결 상태:
  - `INSIDE`: 🟢 입장 중
  - `OUTSIDE`: 🔴 퇴장 상태
- 현재 위치: `currentZone` (입장 중일 때)
- 총 참여 시간: `totalMinutes` (분 단위)
- 배경: 파란색 테두리

**4. 안내 문구**
- 입장 중: "수강 입장/퇴장 시 QR코드를 스캔해주세요."
- 미입장: "현장 데스크에서 QR코드를 제시해주세요."

#### Firestore 경로
```
등록 실시간 조회:
  → collection: 'conferences/{confId}/registrations'
  → where: { userId: user.uid, paymentStatus: 'PAID' }
  → fields: {
      userName, userAffiliation,
      badgeQr, badgeIssued,
      attendanceStatus: 'INSIDE' | 'OUTSIDE',
      currentZone: string | null,
      totalMinutes: number
    }
```

---

### 2.6 출결 체크

#### 관련 파일
- **메인 페이지**: `src/pages/admin/conf/GatePage.tsx`
- **훅**: Firebase Firestore (업데이트/추가)
- **라우트**: `/admin/conf/{cid}/gate`

#### 플로우

**1. 게이트 설정**
- 모드 선택:
  - `ENTER_ONLY`: 입장만
  - `EXIT_ONLY`: 퇴장만
  - `AUTO`: 자동 (입장/퇴장 판단)
- 구역 선택: `selectedZoneId` (세션 아젠다에서 로드)
- LocalStorage 저장: `eregi_conf_{cid}_settings`

**2. 입장 (Check-in)**
1. QR 스캔: `badgeQr` ('BADGE-{regId}')
2. 등록 문서 조회: `conferences/{confId}/registrations/{regId}`
3. 유효성 확인:
   - `status === 'PAID'`?
   - 이미 입장 중?
4. 입장 처리:
   ```javascript
   await updateDoc(regRef, {
     attendanceStatus: 'INSIDE',
     currentZone: zoneId,
     lastCheckIn: Timestamp.now()
   });
   await addDoc(logsRef, {
     type: 'ENTER',
     zoneId,
     timestamp: Timestamp.now(),
     method: 'KIOSK'
   });
   ```

**3. 퇴장 (Check-out)**
1. QR 스캔
2. 체크아웃 처리:
   ```javascript
   const now = new Date();
   const lastIn = lastCheckIn.toDate();
   const diffMins = Math.floor((now.getTime() - lastIn.getTime()) / 60000);

   await updateDoc(regRef, {
     attendanceStatus: 'OUTSIDE',
     currentZone: null,
     totalMinutes: increment(diffMins),
     lastCheckOut: Timestamp.now()
   });
   await addDoc(logsRef, {
     type: 'EXIT',
     zoneId,
     timestamp: Timestamp.now(),
     method: 'KIOSK',
     recognizedMinutes: diffMins
   });
   ```

**4. 자동 모드 (AUTO)**
- 이미 입장 중 → 퇴장 처리
- 퇴장 상태 → 입장 처리
- 구역 이동 → 퇴장 + 입장

**5. 화면 표시**
- 모드별 색상:
  - ENTER: 파란색 (`bg-blue-50`)
  - EXIT: 빨간색 (`bg-red-50`)
  - AUTO: 보라색 (`bg-purple-50`)
- 구역 이름 표시
- 3초 후 메시지 복귀

#### Firestore 경로
```
등록 업데이트:
  → doc: 'conferences/{confId}/registrations/{regId}'
  → check-in: {
      attendanceStatus: 'INSIDE',
      currentZone: zoneId,
      lastCheckIn: Timestamp.now()
    }
  → check-out: {
      attendanceStatus: 'OUTSIDE',
      currentZone: null,
      totalMinutes: increment(diffMins),
      lastCheckOut: Timestamp.now()
    }

출결 로그:
  → doc: 'conferences/{confId}/registrations/{regId}/logs/{logId}'
  → fields: {
      type: 'ENTER' | 'EXIT',
      zoneId, timestamp, method: 'KIOSK',
      recognizedMinutes: number (exit only)
    }
```

---

### 2.7 수강이력 관리

#### 관련 파일
- **메인 페이지**: `src/pages/UserHubPage.tsx`
- **훅**: `src/hooks/useAuth.ts`, `src/hooks/useSociety.ts`, `src/hooks/useMyPage.ts`
- **라우트**: `/mypage`

#### 플로우

**1. 데이터 로드**
1. Firebase Auth 상태 확인
2. 사용자 문서: `users/{uid}` 조회
3. **참여 기록 조회** (중요!):
   ```javascript
   const participationsRef = collection(db, `users/${uid}/participations`);
   const snapshot = await getDocs(participationsRef);
   ```
4. 실시간 동기화: `onSnapshot` 리스너

**2. 참여 기록 확장**
- 각 참여마다 컨퍼런스 정보 JOIN:
  - 컨퍼런스 제목: `conferences/{confId}/info/general`
  - 장소: `venue.name` 또는 `venueAddress`
  - 날짜: `dates.start` ~ `dates.end`
  - 영수증 설정: `receiptConfig`

**3. 탭별 표시**
- **등록학회**: 참여한 모든 학술대회 목록
  - 학회 이름, 컨퍼런스 제목
  - 날짜, 장소
  - 상태: 진행중 / 완료
  - 포인트: `earnedPoints`
- **초록 내역**: 제출한 초록 목록
  - 제목, 분야, 발표 형식
  - 심사 상태: 접수 / 승인(구연/포스터) / 반려
  - 심사 의견
- **학회 인증**: 회원 인증 상태
  - 학회별 인증 여부
  - 만료일
  - 인증 코드
- **내 정보**: 사용자 프로필
  - 이름, 연락처, 소속, 면허번호
  - 이메일

**4. 영수증 발행**
1. 영수증 클릭
2. `receiptConfig` 확인:
   - 발행자 이름
   - 스탬프 이미지
   - 다음 시리얼 번호
3. 영수증 프린트

**5. QR 명찰 접근**
1. 각 참여 카드에 QR 버튼
2. `/{slug}/badge`로 이동
3. Firebase Auth 세션 유지하며 이동

#### Firestore 경로
```
참여 기록:
  → collection: 'users/{uid}/participations'
  → doc: {confId}
  → fields: {
      conferenceId, societyId,
      conferenceName, societyName,
      location, dates,
      paymentStatus, amount,
      receiptNumber, paymentDate,
      earnedPoints,
      userName, userAffiliation, userEmail, userPhone
    }

초록 조회 (컬렉션 그룹 - 비활성화 중):
  → collectionGroup: 'submissions'
  → where: { userId: user.uid }
  → orderBy: 'submittedAt' desc
```

---

## 3. 비회원 (NON-MEMBER) 전체 플로우

### 3.1 정회원과의 주요 차이점

| 구분 | 정회원 | 비회원 |
|------|--------|--------|
| **인증** | Firebase Auth + users/{uid} | Anonymous Auth → Email/Password 업그레이드 |
| **users/{uid}** | 존재함 | 초기에는 존재하지 않음 (등록 후 생성) |
| **참여 기록** | users/{uid}/participations/{confId} | users/{uid}/participations/{confId} (동일) |
| **초록 제출** | userId로 조회 | registrationId로 조회 |
| **마이페이지** | 전체 탭 | 제한 탭 (학회 인증 제외) |
| **명찰 접근** | /:slug/badge (Firebase Auth) | /:slug/non-member/hub (세션 기반) |

---

### 3.2 비회원 등록 플로우

#### 등록 단계별 차이

**STEP 1: 약관 동의**
- 동일

**STEP 2: 기본 정보 입력**
- 익명 사용자 생성: `signInAnonymously()`
- 폼 입력 (이름, 이메일, 연락처, 소속, 면허번호, 비밀번호)
- **계정 업그레이드** (최신 변경사항):
  ```javascript
  const credential = EmailAuthProvider.credential(email, password);
  await linkWithCredential(anonymousUser, credential);
  await setDoc(doc(db, 'users', currentUser.uid), {
    email, name, phone, affiliation,
    licenseNumber, simplePassword,
    isAnonymous: false,
    convertedFromAnonymous: true
  }, { merge: true });
  ```
- PENDING 등록 문서 생성:
  ```javascript
  const pendingRegRef = doc(db, 'conferences/{confId}/registrations', currentUser.uid);
  await setDoc(pendingRegRef, {
    id: currentUser.uid,
    userId: currentUser.uid,
    status: 'PENDING',
    password: simplePassword, // 비회원 로그인용
    // ...
  });
  ```

**STEP 3: 회원 인증**
- 선택 사항 (비회원은 생략 가능)
- 인증 시 회원 등급 선택

**STEP 4: 결제**
- 동일 (CloudFunction 처리)

**STEP 5: 완료**
- 동일

#### Firestore 경로
```
비회원 계정:
  → doc: 'users/{uid}'
  → fields: {
      email, name, phone, affiliation,
      licenseNumber, simplePassword,
      isAnonymous: false,
      convertedFromAnonymous: true
    }

비회원 등록:
  → doc: 'conferences/{confId}/registrations/{uid}'
  → fields: {
      password: simplePassword, // 비회원 로그인용
      isAnonymous: false,
      // ...
    }
```

---

### 3.3 비회원 마이페이지

#### 관련 파일
- **메인 페이지**: `src/pages/NonMemberHubPage.tsx`
- **훅**: `src/hooks/useNonMemberAuth.ts`
- **라우트**: `/:slug/non-member/hub`

#### 플로우

**1. 비회원 인증**
```javascript
const login = async (email, password, confId) => {
  const confRef = doc(db, `conferences/${confId}/registrations`);
  const q = query(confRef, where('email', '==', email), where('password', '==', password));
  const snap = await getDocs(q);

  if (!snap.empty) {
    const reg = snap.docs[0].data();
    setNonMemberSession({ registrationId: reg.id, ... });
  }
};
```

**2. 디지털 명찰 표시**
- `/badge` 접속 시 자동 리다이렉트
- 세션 기반 명찰 표시
- QR 코드: `badgeQr` 또는 `confirmationQr`
- 출결 상태 실시간 표시

**3. 제한 사항**
- 학회 인증 탭 표시 안 함
- 영수증 발행 가능
- 초록 제출 가능 (등록 완료 후)

---

## 4. URL vs Firestore 경로 불일치 분석

### 4.1 문제점 요약

지속적으로 DB 저장소 이름(경로)과 URL 주소가 일치하지 않아 수정이 반복되고 있습니다.

### 4.2 불일치 사례 정리

#### 4.2.1 confId 구성 방식의 혼재

**URL 파라미터:**
- `/:slug` (예: `2026spring`)
- `/:slug/badge` (예: `2026spring/badge`)
- `/:slug/badge-prep/:token` (예: `2026spring/badge-prep/TKN-xxx`)

**Firestore confId:**
- `kap_2026spring` (societyId + slug)
- `kadd_2026spring`

**문제:**
```javascript
// App.tsx lines 69-85
const getConferenceIdByDomain = () => {
  const hostname = window.location.hostname;

  if (hostname.includes('kap.eregi')) {
    return 'kap_2026Spring'; // 대문자 Spring
  }

  if (hostname.includes('kadd.eregi')) {
    return 'kadd_2026spring'; // 소문자 spring
  }

  return 'kadd_2026spring';
};
```

- **불일치**: `kap_2026Spring` vs `kap_2026spring` (Spring 대소문자)
- **영향**: confId 일치하지 않으면 데이터 조회 실패

#### 4.2.2 BadgePrepPage와 StandAloneBadgePage의 confId 결정

**BadgePrepPage.tsx (lines 40-57):**
```javascript
const getConfIdToUse = (slugVal: string | undefined): string => {
  if (!slugVal) return 'kadd_2026spring';

  if (slugVal.includes('_')) {
    return slugVal; // confId가 직접 전달됨
  } else {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    let societyIdToUse = 'kadd';

    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'admin') {
      societyIdToUse = parts[0].toLowerCase();
    }

    return `${societyIdToUse}_${slugVal}`; // confId 생성
  }
};
```

**StandAloneBadgePage.tsx (lines 17-34):**
- 동일한 `getConfIdToUse` 함수 사용

**문제:**
- URL에서 `slug`만 받는 경우 vs `confId`를 직접 받는 경우
- `/badge-prep/{token}`: slug 사용 → confId 생성 필요
- `/badge`: slug 사용 → confId 생성 필요

#### 4.2.3 UserHubPage의 참여 기록 쿼리

**최신 변경사항 (lines 287-304):**
```javascript
// Fallback: Fetch from users/{uid}/participations (no index required)
const participationsRef = collection(db, `users/${user.uid}/participations`);
const snapshot = await getDocs(participationsRef);
```

**컬렉션 그룹 쿼리 (비활성화):**
```javascript
const qReg = query(collectionGroup(db, 'registrations'), where('userId', '==', user.uid));
```

**문제:**
- 컬렉션 그룹 쿼리는 인덱스 필요 (배포 시간 소요)
- 참여 기록은 `users/{uid}/participations` (인덱스 불필요)
- 두 가지 방식이 혼재로 인해 혼란 발생

#### 4.2.4 GatePage와 InfodeskPage의 등록 쿼리

**GatePage.tsx (lines 165-167):**
```javascript
// [Fix] Use conference-specific path instead of global registrations
const regRef = doc(db, `conferences/${selectedConferenceId}/registrations`, regId);
```

**InfodeskPage.tsx (lines 139-139):**
```javascript
const regRef = doc(db, 'conferences', targetConferenceId, 'registrations', code);
```

**문제:**
- 두 페이지에서 동일한 경로 사용
- `regId`가 `registration` 문서 ID인지 확인 필요

#### 4.2.5 AbstractSubmissionPage의 회원/비회원 처리

**AbstractSubmissionPage.tsx (lines 26-40):**
```javascript
// [FIX] Priority: Use non-member registration ID over anonymous user ID
const submitterId = nonMember?.registrationId || auth.user?.id;

const { submitAbstract, uploading, error, mySubmissions, deleteSubmission } = useAbstracts(
  confId || undefined,
  auth.user?.id,
  nonMember?.registrationId
);
```

**문제:**
- 회원: `userId` 사용
- 비회원: `registrationId` 사용
- 초록 문서의 `userId`와 `registrationId` 필드 혼용

### 4.3 불일치 원인 분석

| 원인 | 설명 | 영향 |
|------|------|------|
| **대소문자 불일치** | `2026Spring` vs `2026spring` | confId 매칭 실패 |
| **slug vs confId** | URL은 slug, DB는 confId | 변환 로직 필요 |
| **userId vs registrationId** | 회원은 userId, 비회원은 registrationId | 쿼리 로직 분기 필요 |
| **collectionGroup vs subcollection** | 인덱스 필요 vs 불필요 | 배포 시간 차이 |

### 4.4 권장 사항

**1. confId 구성 통일**
```javascript
// 모든 곳에서 동일한 confId 생성 함수 사용
const buildConfId = (societyId: string, slug: string): string => {
  return `${societyId}_${slug.toLowerCase()}`;
};
```

**2. URL 파라미터 명확화**
- `/:slug` → `/:confId` 또는 명확한 주석
- slug만 필요한 경우는 명시

**3. 회원/비회원 쿼리 로직 통일**
- 모든 훅에서 동일한 패턴 사용
- `submitterId = userId || registrationId` 표준화

---

## 5. 페이지별 파일 매핑

### 5.1 사용자 페이지

| URL | 메인 컴포넌트 | 영향 파일 | 배포 시 수정 필요 |
|-----|---------------|-----------|------------------|
| `/auth`, `/portal` | `NewAuthPortal.tsx` | `src/pages/auth/NewAuthPortal.tsx`, `src/hooks/useAuth.ts` | ✅ |
| `/auth/recovery` | `AccountRecoveryPage.tsx` | `src/pages/auth/AccountRecoveryPage.tsx` | ✅ |
| `/mypage` | `UserHubPage.tsx` | `src/pages/UserHubPage.tsx`, `src/hooks/useAuth.ts`, `src/hooks/useMyPage.ts` | ✅ |
| `/:slug` | `ConferenceLoader.tsx` → `FinalConferenceHome.tsx` | `src/components/conference/ConferenceLoader.tsx`, `src/pages/FinalConferenceHome.tsx` | ✅ |
| `/:slug/register` | `RegistrationPage.tsx` | `src/pages/RegistrationPage.tsx`, `src/hooks/useRegistration.ts` | ✅ |
| `/:slug/register/success` | `RegistrationSuccessPage.tsx` | `src/pages/RegistrationSuccessPage.tsx` | ✅ |
| `/:slug/check-status` | `CheckStatusPage.tsx` | `src/pages/CheckStatusPage.tsx`, `src/hooks/useNonMemberAuth.ts` | ✅ |
| `/:slug/non-member/hub` | `NonMemberHubPage.tsx` | `src/pages/NonMemberHubPage.tsx`, `src/hooks/useNonMemberAuth.ts` | ✅ |
| `/:slug/abstracts` | `AbstractSubmissionPage.tsx` | `src/pages/AbstractSubmissionPage.tsx`, `src/hooks/useAbstracts.ts` | ✅ |
| `/:slug/program` | `ProgramPage.tsx` | `src/pages/ProgramPage.tsx`, `src/hooks/useCMS.ts` | ✅ |
| `/:slug/badge` | `StandAloneBadgePage.tsx` | `src/pages/StandAloneBadgePage.tsx`, `src/hooks/useAuth.ts` | ✅ |
| `/:slug/badge-prep/:token` | `BadgePrepPage.tsx` | `src/pages/BadgePrepPage.tsx`, Cloud Functions | ✅ |
| `/:slug/mypage` | `ConferenceMyPageRedirect.tsx` | `src/components/common/ConferenceMyPageRedirect.tsx` | ✅ |
| `/payment/success` | `PaymentSuccessHandler.tsx` | `src/components/payment/PaymentSuccessHandler.tsx` | ✅ |

### 5.2 관리자 페이지

| URL | 메인 컴포넌트 | 영향 파일 | 배포 시 수정 필요 |
|-----|---------------|-----------|------------------|
| `/super` | `SuperAdminPage.tsx` | `src/pages/admin/SuperAdminPage.tsx`, `src/hooks/useSuperAdmin.ts` | ✅ |
| `/super/security` | `SecurityPolicyManager.tsx` | `src/components/admin/SecurityPolicyManager.tsx` | ✅ |
| `/admin/login` | `AdminLoginPage.tsx` | `src/pages/admin/auth/AdminLoginPage.tsx` | ✅ |
| `/admin/society` | `SocietyDashboardPage.tsx` | `src/pages/admin/SocietyDashboardPage.tsx`, `src/hooks/useSocietyAdmin.ts` | ✅ |
| `/admin/society/:sid/infra` | `InfraPage.tsx` | `src/pages/admin/InfraPage.tsx` | ✅ |
| `/admin/society/:sid/identity` | `IdentityPage.tsx` | `src/pages/admin/IdentityPage.tsx` | ✅ |
| `/admin/society/:sid/templates` | `TemplatesPage.tsx` | `src/pages/admin/TemplatesPage.tsx` | ✅ |
| `/admin/society/:sid/members` | `MemberManagerPage.tsx` | `src/pages/admin/MemberManagerPage.tsx`, `src/hooks/useMemberVerification.ts` | ✅ |
| `/admin/society/:sid/users` | `AdminUsersPage.tsx` | `src/pages/admin/AdminUsersPage.tsx` | ✅ |
| `/admin/conf/:cid` | `DashboardPage.tsx` | `src/pages/admin/DashboardPage.tsx`, `src/hooks/useConferenceAdmin.ts` | ✅ |
| `/admin/conf/:cid/settings` | `ConferenceSettingsPage.tsx` | `src/pages/admin/ConferenceSettingsPage.tsx` | ✅ |
| `/admin/conf/:cid/settings/registration` | `RegistrationSettingsPage.tsx` | `src/pages/admin/RegistrationSettingsPage.tsx` | ✅ |
| `/admin/conf/:cid/attendance-settings` | `AttendanceSettingsPage.tsx` | `src/pages/admin/AttendanceSettingsPage.tsx` | ✅ |
| `/admin/conf/:cid/statistics` | `StatisticsPage.tsx` | `src/pages/admin/StatisticsPage.tsx` | ✅ |
| `/admin/conf/:cid/attendance-live` | `AttendanceLivePage.tsx` | `src/pages/admin/AttendanceLivePage.tsx` | ✅ |
| `/admin/conf/:cid/gate` | `GatePage.tsx` | `src/pages/admin/conf/GatePage.tsx` | ✅ |
| `/admin/conf/:cid/infodesk` | `InfodeskPage.tsx` | `src/pages/admin/conf/InfodeskPage.tsx` | ✅ |
| `/admin/conf/:cid/agenda` | `AgendaManager.tsx` | `src/pages/admin/AgendaManager.tsx`, `src/hooks/useCMS.ts` | ✅ |
| `/admin/conf/:cid/registrations` | `RegistrationListPage.tsx` | `src/pages/admin/RegistrationListPage.tsx`, `src/hooks/useRegistrations.ts` | ✅ |
| `/admin/conf/:cid/registrations/:id` | `RegistrationDetailPage.tsx` | `src/pages/admin/RegistrationDetailPage.tsx` | ✅ |
| `/admin/conf/:cid/pages` | `PageEditor.tsx` | `src/pages/admin/PageEditor.tsx`, `src/hooks/useCMS.ts` | ✅ |
| `/admin/conf/:cid/badge-editor` | `BadgeEditorPage.tsx` | `src/pages/admin/BadgeEditorPage.tsx` | ✅ |
| `/admin/conf/:cid/refunds` | `AdminRefundPage.tsx` | `src/pages/admin/AdminRefundPage.tsx` | ✅ |
| `/admin/conf/:cid/abstracts` | `AbstractManagerPage.tsx` | `src/pages/admin/AbstractManagerPage.tsx`, `src/hooks/useAbstracts.ts` | ✅ |

### 5.3 공통 컴포넌트 및 훅

**레이아웃:**
- `src/layouts/SuperLayout.tsx` - 슈퍼 어드민 레이아웃
- `src/layouts/SocietyLayout.tsx` - 학회 관리자 레이아웃
- `src/layouts/ConfLayout.tsx` - 컨퍼런스 관리자 레이아웃
- `src/layouts/VendorLayout.tsx` - 벤더 레이아웃

**Context Providers:**
- `src/contexts/GlobalContext.tsx` - 슈퍼 어드민 컨텍스트
- `src/contexts/ConfContext.tsx` - 컨퍼런스 컨텍스트
- `src/contexts/SocietyContext.tsx` - 학회 컨텍스트
- `src/contexts/VendorContext.tsx` - 벤더 컨텍스트

**공통 컴포넌트:**
- `src/components/common/LoadingSpinner.tsx`
- `src/components/common/EmptyState.tsx`
- `src/components/common/GlobalErrorBoundary.tsx`

**UI 프리미티브 (Radix UI + Tailwind):**
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/dialog.tsx`
- 등...

**훅 (20+):**
- `src/hooks/useAuth.ts` - 인증
- `src/hooks/useConference.ts` - 컨퍼런스 데이터
- `src/hooks/useRegistration.ts` - 등록 로직
- `src/hooks/useCheckIn.ts` - 출결 로직
- `src/hooks/useMyPage.ts` - 마이페이지
- `src/hooks/useAbstracts.ts` - 초록 제출
- `src/hooks/useMemberVerification.ts` - 회원 인증
- `src/hooks/useNonMemberAuth.ts` - 비회원 인증
- `src/hooks/useSociety.ts` - 학회 데이터
- `src/hooks/useCMS.ts` - CMS 기능
- 등...

### 5.4 배포 시 파일 수정 범위

**프론트엔드:**
- 페이지 파일: `src/pages/**/*.{ts,tsx}`
- 컴포넌트: `src/components/**/*.{ts,tsx}`
- 훅: `src/hooks/*.ts`
- 레이아웃: `src/layouts/*.{ts,tsx}`
- 컨텍스트: `src/contexts/*.{ts,tsx}`
- 라우팅: `src/App.tsx`
- 타입: `src/types/schema.ts`
- 유틸리티: `src/utils/*.{ts,tsx}`

**백엔드 (Cloud Functions):**
- 메인: `functions/src/index.ts`
- 결제: `functions/src/payment/*.ts`
- 스케줄: `functions/src/scheduled/*.ts`
- 유틸리티: `functions/src/utils/*.ts`

**Firebase 설정:**
- Firestore 규칙: `firestore.rules`
- 인덱스: `firestore.indexes.json`

---

## 6. 테스트 시나리오

### 6.1 정회원 전체 시나리오

#### 시나리오 1: 신규 회원 학술대회 등록
```
1. 회원 가입 완료 상태 가정
2. /{slug}/register 접속
3. 약관 동의 (Terms)
4. 기본 정보 자동 완성 확인
5. 회원 인증 (면허번호 입력)
   - societies/{societyId}/members에서 검증
6. 등급 선택 (회원 등급 자동 선택)
7. 결제 (Toss 또는 Nice)
   - CloudFunction: confirmTossPayment 또는 confirmNicePayment
8. 등록 완료:
   - conferences/{confId}/registrations/{userId} 생성
   - users/{userId}/participations/{confId} 생성
   - 회원 코드 잠금 (used: true)
9. 영수증 표시 (/register/success)
```

**검증 항목:**
- [ ] 회원 정보 자동 완성 (이름, 연락처, 소속)
- [ ] 회원 인증 성공
- [ ] 등급 자동 선택 (MEMBER)
- [ ] 결제 처리 완료
- [ ] 등록 문서 생성 확인
- [ ] 참여 기록 생성 확인
- [ ] 회원 코드 잠금 확인

#### 시나리오 2: 기존 회원 초록 제출
```
1. /{slug}/abstracts 접속
2. 로그인 상태 확인
3. 등록 상태 확인 (PAID)
4. 신규 제출:
   - 기본 정보 입력
   - 저자 정보 입력
   - 파일 업로드
   - 제출
   - conferences/{confId}/submissions/{subId} 생성
5. 수정:
   - 기존 초록 수정
   - 파일 교체
   - 제출
```

**검증 항목:**
- [ ] 등록 상태 확인
- [ ] 초록 제출 성공
- [ ] 초록 문서 생성 확인
- [ ] 파일 업로드 확인

#### 시나리오 3: 인포데스크 명찰 발급
```
1. 이메일 수신: 바우처 링크 (/{slug}/badge-prep/{token})
2. 바우처 페이지 접속
3. QR 코드 표시 (confirmationQr)
4. 인포데스크 접속 (/admin/conf/{cid}/infodesk)
5. QR 스캔 (confirmationQr)
6. CloudFunction: issueDigitalBadge 호출
7. 명찰 발급:
   - badgeQr 생성 ('BADGE-{regId}')
   - badgeIssued: true
8. 바우처 페이지 자동 전환 (실시간 새로고침)
```

**검증 항목:**
- [ ] 바우처 토큰 유효성 확인
- [ ] confirmationQr 표시
- [ ] QR 스캔 성공
- [ ] 명찰 발급 성공
- [ ] badgeQr 생성 확인
- [ ] 자동 전환 확인 (2초 폴링)

#### 시나리오 4: 디지털 명찰 확인
```
1. /{slug}/badge 접속
2. Firebase Auth 확인
3. 등록 조회 (userId)
4. 명찰 표시:
   - 이름, 소속
   - QR 코드 (badgeQr)
   - 출결 상태 (OUTSIDE)
```

**검증 항목:**
- [ ] Firebase Auth 확인
- [ ] 등록 문서 조회
- [ ] badgeQr 표시
- [ ] 출결 상태 표시

#### 시나리오 5: 입장 체크인
```
1. 게이트 접속 (/admin/conf/{cid}/gate)
2. 모드 선택 (ENTER_ONLY)
3. 구역 선택
4. QR 스캔 (badgeQr)
5. 등록 조회
6. 입장 처리:
   - attendanceStatus: INSIDE
   - currentZone: zoneId
   - lastCheckIn: Timestamp
   - logs/{logId} 생성 (type: ENTER)
```

**검증 항목:**
- [ ] QR 스캔 성공
- [ ] 입장 처리 성공
- [ ] attendanceStatus 업데이트 확인
- [ ] currentZone 업데이트 확인
- [ ] 로그 생성 확인

#### 시나리오 6: 퇴장 체크아웃
```
1. 게이트 접속
2. 모드 선택 (EXIT_ONLY)
3. QR 스캔
4. 퇴장 처리:
   - attendanceStatus: OUTSIDE
   - currentZone: null
   - totalMinutes: increment(diffMins)
   - lastCheckOut: Timestamp
   - logs/{logId} 생성 (type: EXIT, recognizedMinutes)
```

**검증 항목:**
- [ ] QR 스캔 성공
- [ ] 퇴장 처리 성공
- [ ] attendanceStatus 업데이트 확인
- [ ] totalMinutes 계산 확인
- [ ] 로그 생성 확인

#### 시나리오 7: 마이페이지 수강이력 확인
```
1. /mypage 접속
2. Firebase Auth 확인
3. 참여 기록 조회 (users/{uid}/participations)
4. 확장 정보 로드 (컨퍼런스, 학회)
5. 등록학회 탭:
   - 참여한 학술대회 목록
   - 날짜, 장소, 포인트
6. 영수증 발행
7. QR 명찰 접근
```

**검증 항목:**
- [ ] 참여 기록 조회
- [ ] 확장 정보 로드
- [ ] 학술대회 목록 표시
- [ ] 영수증 발행
- [ ] QR 명찰 접근

---

### 6.2 비회원 전체 시나리오

#### 시나리오 1: 비회원 등록
```
1. /{slug}/register 접속
2. 익명 사용자 생성 (signInAnonymously)
3. 약관 동의
4. 기본 정보 입력 (이름, 이메일, 연락처, 소속, 면허번호, 비밀번호)
5. 계정 업그레이드 (linkWithCredential)
6. PENDING 등록 문서 생성 (users/{uid})
7. 회원 인증 (선택사항)
8. 결제 (Toss/Nice)
9. 등록 완료:
   - conferences/{confId}/registrations/{uid} 생성
   - users/{uid}/participations/{confId} 생성
```

**검증 항목:**
- [ ] 익명 사용자 생성
- [ ] 계정 업그레이드 성공
- [ ] users/{uid} 문서 생성
- [ ] PENDING 등록 문서 생성
- [ ] 결제 처리 완료
- [ ] 참여 기록 생성

#### 시나리오 2: 비회원 마이페이지 접속
```
1. /{slug}/check-status 접속
2. 이메일, 비밀번호 입력
3. 등록 조회 (conferences/{confId}/registrations)
4. 세션 저장 (sessionStorage)
5. /{slug}/non-member/hub 리다이렉트
6. 디지털 명찰 표시 (badgeQr)
7. 출결 상태 표시
```

**검증 항목:**
- [ ] 비회원 인증 성공
- [ ] 세션 저장
- [ ] 리다이렉트
- [ ] 명찰 표시

---

### 6.3 멀티테넌트 시나리오

#### 시나리오 1: KAP 학회 새로운 컨퍼런스 추가
```
1. kap.eregi.co.kr 접속
2. confId: 'kap_2026spring' 결정
3. /{2026spring}/register 접속
4. 등록 완료
5. DB 저장소: conferences/kap_2026spring/registrations/{userId}
```

**검증 항목:**
- [ ] 도메인 → confId 매핑 확인
- [ ] KAP 데이터만 접근
- [ ] 등록 문서 올바른 경로

#### 시나리오 2: KADD 학회 컨퍼런스 접속
```
1. kadd.eregi.co.kr 접속
2. confId: 'kadd_2026spring' 결정
3. /{2026spring}/register 접속
4. DB 저장소: conferences/kadd_2026spring/registrations/{userId}
```

**검증 항목:**
- [ ] 도메인 → confId 매핑 확인
- [ ] KADD 데이터만 접근
- [ ] 등록 문서 올바른 경로

---

## 7. 요약 및 권장 사항

### 7.1 주요 문제점

1. **confId 대소문자 불일치**
   - `kap_2026Spring` vs `kap_2026spring`
   - 모든 곳에서 소문자 사용 권장

2. **URL 파라미터 vs confId**
   - slug vs confId 혼재
   - 명확한 명칭 사용 필요

3. **회원/비회원 쿼리 로직**
   - userId vs registrationId 분기 필요
   - 표준화된 접근 방식 필요

4. **collectionGroup vs subcollection**
   - 인덱스 필요 vs 불필요
   - 참여 기록은 subcollection 사용 (인덱스 불필요)

### 7.2 권장 사항

**1. confId 생성 함수 통일**
```javascript
const buildConfId = (societyId: string, slug: string): string => {
  return `${societyId}_${slug.toLowerCase()}`;
};
```

**2. 회원/비회원 쿼리 로직 통일**
```javascript
const getSubmitterId = (user: User, nonMember: NonMember): string => {
  return nonMember?.registrationId || user?.id;
};
```

**3. 참여 기록 표준화**
- `users/{uid}/participations/{confId}` 사용 (인덱스 불필요)

**4. URL 명명 규칙**
- `/:confId` 사용 (slug 대신)
- 또는 명확한 주석 추가

### 7.3 사이드이펙트 방지

- **이 분석은 코드 수정 없음**
- 모든 분석은 읽기 전용
- 향후 수정 시 본 문서 참조

---

## 8. 부록

### 8.1 Firestore 인덱스 요구사항

**필수 인덱스:**
```json
{
  "indexes": [
    {
      "collectionGroup": "registrations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "submittedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "licenseNumber", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 8.2 Cloud Functions 목록

**결제 관련:**
- `confirmTossPayment` - Toss 결제 확인
- `confirmNicePayment` - Nice 결제 확인

**명찰 관련:**
- `generateBadgePrepToken` - 바우처 토큰 생성
- `validateBadgePrepToken` - 바우처 토큰 검증
- `issueDigitalBadge` - 디지털 명찰 발급

**회원 인증:**
- `verifyMemberIdentity` - 회원 신원 검증

---

**문서 끝**

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
