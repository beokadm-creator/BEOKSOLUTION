# Draft: Partner Portal URL 구조 개선

## 문제 요약

### 현재 상황
1. **404 에러**: `/partner/NeGPCfrmb6IB1j6Nd1Y4` 접속 시 404 발생
2. **라우팅 불일치**: App.tsx는 `/partner/*` 라우트만 정의, VendorPortalLayout은 `/partner/:vendorId`로 리다이렉트 시도
3. **URL에 vendorId 없음**: 현재 `/partner/scanner`, `/partner/notification` 등 vendorId가 URL에 포함되지 않음

### 사용자 요구사항
- 파트너사별로 모든 데이터 분리 (설정, 정보, 템플릿 등)
- URL로 특정 파트너 직접 접근 가능 (`/partner/:vendorId/notification`)
- URL 공유 가능

---

## 데이터 구조 분석

### Firestore 구조 (이미 파트너별 분리됨 ✅)

```
vendors/{vendorId}                          # 파트너 기본 정보
├── name: string
├── description: string
├── logoUrl: string
├── homeUrl: string
├── productUrl: string
├── ownerUid: string                        # 소유자 Firebase Auth UID
├── adminEmail: string                      # 메인 관리자 이메일
├── staffEmails: string[]                   # 스태프 이메일 목록
│
├── settings/infrastructure                 # 알림 인프라 설정 (파트너별)
│   └── notification.nhnAlimTalk: {...}
│
├── notification-templates/{templateId}     # 알림 템플릿 (파트너별)
│   ├── eventType: BOOTH_VISIT | GUESTBOOK_SIGN
│   ├── name, description, isActive
│   └── channels.kakao: {...}
│
└── leads/{leadId}                          # 수집된 리드 (파트너별)
    ├── visitorName, visitorOrg, visitorPhone, visitorEmail
    ├── conferenceId, timestamp
    └── isConsentAgreed: boolean
```

### 데이터 접근 패턴 (코드 분석)

| 컴포넌트 | vendorId 획득 방식 | Firestore 경로 |
|---------|-------------------|----------------|
| `VendorDashboardPage` | `useOutletContext()` | `vendors/{vendorId}`, `vendors/{vendorId}/leads` |
| `VendorSettingsPage` | `useOutletContext()` | `vendors/{vendorId}` |
| `VendorStaffPage` | `useOutletContext()` | `vendors/{vendorId}` |
| `VendorScannerPage` | `useOutletContext()` | `vendors/{vendorId}/leads` |
| `PartnerInfraSettings` | **props** (vendorId) | `vendors/{vendorId}/settings/infrastructure` |
| `PartnerTemplatesPage` | **props** (vendorId) | `vendors/{vendorId}/notification-templates` |

### useVendor Hook (핵심 로직)
- vendorId를 받아 `vendors/{vendorId}` 문서 조회
- 권한 체크: `ownerUid === auth.currentUser.uid` 또는 `adminEmail === auth.currentUser.email`
- 실패 시 `/admin/login`으로 리다이렉트

---

## 현재 코드 문제점

### 1. App.tsx 라우팅 (라인 380-392)
```tsx
// 현재: vendorId 없는 라우트만 정의
<Route path="/partner" element={<VendorPortalLayout />}>
  <Route index element={<VendorDashboardPage />} />
  <Route path="scanner">...</Route>
  <Route path="profile" element={<VendorSettingsPage />} />
  <Route path="staff" element={<VendorStaffPage />} />
  <Route path="notification" element={<PartnerNotificationSettingsPage />} />
</Route>
```

### 2. VendorPortalLayout.tsx (라인 52-58)
```tsx
// 문제: 존재하지 않는 라우트로 리다이렉트
const urlVendorId = location.pathname.match(/\/partner\/([^\/]+)/)?.[1];
if (!isValidVendorId) {
    navigate(`/partner/${uniqueVendors[0].id}`, { replace: true });  // ← 404!
}
```

### 3. 사이드바 드롭다운 (라인 106-108)
```tsx
// 문제: 404 경로로 이동
onChange={(e) => navigate(`/partner/${e.target.value}`)}
```

---

## 해결 방안: URL 기반 vendorId 전달

### 목표 URL 구조
```
/partner                              → 벤더 선택 페이지 또는 첫 번째 벤더로 리다이렉트
/partner/:vendorId                    → 해당 벤더 대시보드
/partner/:vendorId/scanner            → 해당 벤더 스캐너
/partner/:vendorId/scanner/camera     → 카메라 스캐너
/partner/:vendorId/scanner/external   → 외부 리더기 모드
/partner/:vendorId/profile            → 해당 벤더 프로필 설정
/partner/:vendorId/staff              → 해당 벤더 스태프 관리
/partner/:vendorId/notification       → 해당 벤더 알림 설정
```

### 장점
1. **직접 접근**: URL로 특정 파트너 페이지 직접 접근 가능
2. **공유 가능**: `/partner/NeGPCfrmb6IB1j6Nd1Y4/notification` 링크 공유 가능
3. **북마크**: 특정 파트너 페이지 북마크 가능
4. **권한 체크**: URL의 vendorId와 사용자 권한 비교 가능

---

## 변경 파일 목록

### 1. App.tsx (라우팅 구조 변경)
**현재:**
```tsx
<Route path="/partner" element={<VendorPortalLayout />}>
  <Route index element={<VendorDashboardPage />} />
  <Route path="scanner">...</Route>
  ...
</Route>
```

**변경 후:**
```tsx
<Route path="/partner" element={<VendorPortalLayout />}>
  <Route index element={<VendorDashboardPage />} />  {/* 리다이렉트 또는 벤더 선택 */}
  <Route path=":vendorId">
    <Route index element={<VendorDashboardPage />} />
    <Route path="scanner">
      <Route index element={<VendorScannerIntroPage />} />
      <Route path="camera" element={<VendorScannerPage mode="camera" />} />
      <Route path="external" element={<VendorScannerPage mode="external" />} />
    </Route>
    <Route path="profile" element={<VendorSettingsPage />} />
    <Route path="staff" element={<VendorStaffPage />} />
    <Route path="notification" element={<PartnerNotificationSettingsPage />} />
  </Route>
</Route>
```

### 2. VendorPortalLayout.tsx (핵심 변경)
**변경 사항:**
1. `useParams()`로 URL에서 vendorId 추출
2. vendorId가 있으면 권한 체크 후 해당 벤더 데이터 로드
3. vendorId가 없으면 첫 번째 벤더로 리다이렉트
4. 사이드바 드롭다운에서 URL 변경 (context가 아닌 URL로 전환)
5. NavLink 경로 수정

**새로운 로직:**
```tsx
const { vendorId: urlVendorId } = useParams<{ vendorId: string }>();

// 권한 체크
const isAuthorized = vendors.some(v => v.id === urlVendorId);

// 권한 없으면 첫 번째 벤더로 리다이렉트
if (urlVendorId && !isAuthorized) {
  navigate(`/partner/${vendors[0].id}`, { replace: true });
}

// vendorId 없으면 첫 번째 벤더로 리다이렉트
if (!urlVendorId && vendors.length > 0) {
  navigate(`/partner/${vendors[0].id}`, { replace: true });
}

// 드롭다운: URL로 이동
onChange={(e) => navigate(`/partner/${e.target.value}`)}

// NavLink: vendorId 포함
<NavLink to={`/partner/${activeVendorId}`}>
<NavLink to={`/partner/${activeVendorId}/scanner`}>
```

### 3. 하위 페이지들 (vendorId 획득 방식 변경)

**현재:** `useOutletContext<{ activeVendorId: string }>()`
**변경 후:** `useParams<{ vendorId: string }>()`

| 파일 | 변경 내용 |
|------|----------|
| `VendorDashboardPage.tsx` | `useParams()`로 변경 |
| `VendorSettingsPage.tsx` | `useParams()`로 변경 |
| `VendorStaffPage.tsx` | `useParams()`로 변경 |
| `VendorScannerPage.tsx` | `useParams()`로 변경 |
| `VendorScannerIntroPage.tsx` | `useParams()`로 변경 |
| `PartnerNotificationSettingsPage.tsx` | `useParams()`로 변경 |

### 4. useVendor.ts (변경 불필요)
이미 vendorId를 파라미터로 받아서 처리하므로 변경 불필요

---

## 권한 체크 흐름

```
1. 사용자 로그인
2. VendorPortalLayout에서 사용자의 이메일/UID로 vendors 조회
   - adminEmail === user.email
   - ownerUid === user.uid
   - staffEmails contains user.email
3. URL의 vendorId가 조회된 목록에 있는지 확인
4. 있으면 → 해당 벤더 컨텍스트 로드
5. 없으면 → 첫 번째 벤더로 리다이렉트
```

---

## 고려사항

### 1. 다중 벤더 관리자
- 사용자가 여러 벤더의 admin인 경우, 드롭다운에서 전환 시 URL이 변경됨
- 예: `/partner/vendorA` → `/partner/vendorB`

### 2. 직접 링크 공유
- `/partner/NeGPCfrmb6IB1j6Nd1Y4/notification` 링크 공유
- 받은 사람이 로그인 후 권한이 있으면 해당 페이지로 이동
- 권한이 없으면 자신의 첫 번째 벤더로 리다이렉트

### 3. 브라우저 뒤로가기/앞으로가기
- URL 기반이므로 정상 작동

### 4. 새로고침
- URL에 vendorId가 있으므로 새로고침해도 동일 벤더 유지

---

## 확인 필요 사항

1. **빈 벤더 목록**: 사용자가 어떤 벤더에도 속하지 않은 경우 처리
2. **삭제된 벤더**: URL의 vendorId가 삭제된 경우 처리
3. **권한 변경**: 사용자 권한이 변경된 경우 실시간 반영 여부

---

---

## 🔴 중요 발견: 스탬프 투어 전체 플로우 분석

### 사용자(참가자) 스탬프 투어 UI 분석

**위치**: `src/pages/ConferenceBadgePage.tsx` (라인 209-241, 288-327)

```typescript
// 스탬프 데이터 로드 (라인 209-241)
useLayoutEffect(() => {
  if (!slug || !uiData?.id) return;

  // 1. 스탬프 투어 참여 벤더 목록 조회
  const vSnap = await getDocs(
    query(collection(db, `conferences/${slug}/sponsors`), 
          where("isStampTourParticipant", "==", true))
  );
  const validVendorIds = new Set(vSnap.docs.filter(d => d.data().vendorId).map(d => d.data().vendorId));
  setTotalVendors(validVendorIds.size);

  // 2. 사용자의 스탬프 실시간 리스닝
  const sQ = query(
    collection(db, `conferences/${slug}/stamps`), 
    where('userId', '==', uiData.id)  // ← 사용자 ID로 필터링
  );
  unsubStamps = onSnapshot(sQ, (snap) => {
    const list = snap.docs.map(d => d.data());
    const uniqueVendors = Array.from(new Set(list.map(s => s.vendorId)))
      .filter(vid => validVendorIds.has(vid));
    setMyStamps(uniqueVendors);
  });
}, [slug, uiData?.id]);
```

**UI 렌더링** (라인 288-327):
- 스탬프 진행 상황 바 (`{myStamps.length} / {totalVendors}`)
- 수집된 스탬프 표시 (별 이모지 ⭐)
- 완료 시 애니메이션 효과

---

### 🔴 문제: 스탬프 저장이 실제로 실패함

#### 코드 위치: `useVendor.ts:226-231`
```typescript
// STAMP TOUR: Write to /conferences/{confId}/stamps
await addDoc(collection(db, `conferences/${conferenceId}/stamps`), {
  userId: scanResult.user.id,
  vendorId: vendor.id,
  vendorName: vendor.name,
  timestamp: Timestamp.now()
});
```

#### Firestore Rules: `firestore.rules:49-52`
```javascript
match /conferences/{confId}/{document=**} {
  allow read: if true;
  allow write: if isSuperAdmin();  // ← vendor 사용자는 쓰기 불가!
}
```

#### 실제 동작:
1. 스탬프 저장 시도 → Firestore Rules에 의해 **거부됨**
2. try-catch로 에러가 무시됨 (사용자에게 에러 미표시)
3. 사용자는 "처리되었습니다" 메시지를 보지만 **스탬프는 저장되지 않음**
4. ConferenceBadgePage에서 스탬프 조회 → **빈 목록**

---

### 📊 전체 플로우 검증 매트릭스

| 단계 | 액션 | Firestore 경로 | Rules | 실제 동작 |
|------|------|---------------|-------|----------|
| **1. QR 스캔** | 참가자 정보 조회 | `conferences/{cid}/registrations` | `read: isOwner \| isSuperAdmin` | ✅ 정상 |
| **2. 사용자 정보** | 추가 정보 조회 | `conferences/{cid}/users/{uid}` | `read: true` | ✅ 정상 |
| **3. 동의 UI** | 스태프 화면에 표시 | - | - | ✅ 정상 |
| **4. Lead 저장** | 방문 기록 저장 | `vendors/{vid}/leads` | `write: isVendorAdmin` | ✅ 정상 |
| **5. Stamp 저장** | 스탬프 투어 저장 | `conferences/{cid}/stamps` | `write: isSuperAdmin ONLY` | ❌ **실패** |
| **6. 알림톡** | Cloud Function 실행 | 서버 사이드 | - | ✅ 정상 |
| **7. 스탬프 조회** | 사용자 명찰 화면 | `conferences/{cid}/stamps` | `read: true` | ✅ 정상 (데이터 없음) |

---

### 🎯 해결 방안: Firestore Rules 수정 (필수)

```javascript
// firestore.rules 수정 필요
match /conferences/{confId} {
  // ... 기존 규칙 ...

  // ✨ 새로 추가: Stamps 컬렉션 예외 규칙
  match /stamps/{stampId} {
    allow read: if true;  // 누구나 읽기 가능
    allow write: if isAuthenticated();  // 인증된 사용자면 쓰기 가능
    // 또는 더 안전하게:
    // allow create: if isAuthenticated() && 
    //                  request.resource.data.userId == request.auth.uid;
  }

  // 기존 하위 컬렉션 규칙 (stamps 제외하고 유지)
  match /registrations/{userId} { ... }
  match /external_attendees/{attendeeId} { ... }
}
```

---

## 🔴 추가 문제: 스탬프 투어 참여 여부 체크 누락

### isStampTourParticipant 필드 위치
```
conferences/{confId}/sponsors/{sponsorId}
├── vendorId: string
├── isStampTourParticipant: boolean  ← 스탬프 투어 참여 여부
├── name, logoUrl, tier, etc.
```

### 현재 코드 문제 (`useVendor.ts:224-231`)
```typescript
// STAMP TOUR: Write to /conferences/{confId}/stamps
// Even if denied, grant the stamp for the tour.
await addDoc(collection(db, `conferences/${conferenceId}/stamps`), {...});
// ↑ isStampTourParticipant 체크 없이 무조건 저장!
```

### 문제 시나리오
```
파트너 A (isStampTourParticipant: false)
  ↓
스태프가 참가자 QR 스캔
  ↓
스탬프 저장됨 (무조건) → conferences/{confId}/stamps
  ↓
참가자 명찰에서 스탬프 카운트
  ↓
ConferenceBadgePage에서 isStampTourParticipant == true 필터링
  ↓
스탬프 카운트에 포함되지 않음 → 참가자 혼란
```

### 수정 필요
- `useVendor.ts`: `processVisit()`에서 sponsor 정보 조회 후 `isStampTourParticipant` 체크
- 체크 후에만 stamps 저장

---

## ✅ 정상 작동 확인된 부분

### 1. 스태프 동의 UI (VendorScannerPage)
- 동의/거부 버튼 명확히 표시 ✅
- 동의 시: `visitorPhone`, `visitorEmail`, `visitorOrg` 포함하여 Lead 저장
- 거부 시: `visitorName = "Anonymous"`, 개인정보 제외

### 2. Lead 저장 (vendors/{vid}/leads)
- Firestore Rules: `isVendorAdmin()` ✅
- 파트너별로 완전히 분리된 데이터

### 3. 알림톡 발송
- Cloud Function에서 실행 (서버 권한) ✅
- NHN Cloud API 호출 정상
- 파트너별 senderKey 사용

### 4. 사용자 스탬프 UI (ConferenceBadgePage)
- 스탬프 진행 상황 표시 준비됨 ✅
- 실시간 리스닝 설정됨 ✅
- `isStampTourParticipant == true` 필터링 동작 ✅
- 단, **데이터가 없어서 빈 목록 표시** (Rules + 체크 로직 문제)

---

## 📋 최종 작업 목록

### Phase 1: 긴급 수정 (Firestore Rules + 로직) 🔴

| # | 파일 | 작업 내용 |
|---|------|----------|
| 1 | `firestore.rules` | `conferences/{confId}/stamps` 쓰기 권한 추가 |
| 2 | `useVendor.ts` | `processVisit()`에서 sponsor 조회 후 `isStampTourParticipant` 체크 |

### Phase 2: URL 구조 변경

| # | 파일 | 작업 내용 |
|---|------|----------|
| 3 | `App.tsx` | `/partner/:vendorId/*` 라우팅 구조로 변경 |
| 4 | `VendorPortalLayout.tsx` | URL 기반 vendorId 처리, 권한 체크 로직 수정 |
| 5 | `VendorDashboardPage.tsx` | `useOutletContext` → `useParams` 변경 |
| 6 | `VendorSettingsPage.tsx` | `useOutletContext` → `useParams` 변경 |
| 7 | `VendorStaffPage.tsx` | `useOutletContext` → `useParams` 변경 |
| 8 | `VendorScannerPage.tsx` | `useOutletContext` → `useParams` 변경 |
| 9 | `PartnerNotificationSettingsPage.tsx` | `useOutletContext` → `useParams` 변경 |

### Phase 3: 검증

| # | 작업 | 내용 |
|---|------|------|
| 10 | E2E 테스트 | 스태프 QR 스캔 → 동의 → Lead 저장 확인 |
| 11 | E2E 테스트 | 스탬프 저장 확인 (Rules + 로직 수정 후) |
| 12 | E2E 테스트 | 사용자 명찰에서 스탬프 표시 확인 |
| 13 | E2E 테스트 | 알림톡 수신 확인 |

---

## 요약

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| URL 구조 | `/partner/notification` | `/partner/:vendorId/notification` |
| vendorId 전달 | Outlet Context | URL Parameter |
| 직접 접근 | 불가능 | 가능 |
| 링크 공유 | 불가능 | 가능 |
| 북마크 | 불가능 | 가능 |
| **Stamps 저장** | ⚠️ **실패 (Rules 문제)** | Rules 수정 필요 |
| **스탬프 투어 체크** | ⚠️ **누락 (무조건 저장)** | 로직 수정 필요 |
| **사용자 스탬프 UI** | 준비됨 (데이터 없음) | 수정 후 정상 작동 |
