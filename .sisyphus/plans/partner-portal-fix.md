# Partner Portal Fix - Work Plan

## 목표
파트너 포털 404 에러 수정 및 스탬프 투어/방명록 기능 정상화

---

## 비즈니스 로직 명확화

### 스탬프 투어 vs 방명록

| `isStampTourParticipant` | 방명록(Lead) | 스탬프 |
|--------------------------|-------------|--------|
| `true` (참가) | ✅ 저장 | ✅ 저장 |
| `false` (미참가) | ✅ 저장 | ❌ 저장 안함 |

### 데이터 저장 위치
- **방명록(Lead)**: `vendors/{vendorId}/leads` - 파트너사 소유
- **스탬프**: `conferences/{confId}/stamps` - 학회 소유 (전체 참가자 공통)

---

## Phase 1: 긴급 수정 (Critical)

### 1.1 Firestore Rules 수정
**파일**: `firestore.rules`

**현재 문제**:
```javascript
match /conferences/{confId}/{document=**} {
  allow write: if isSuperAdmin();  // ← vendor 사용자는 stamps 쓰기 불가
}
```

**수정 내용**:
```javascript
match /conferences/{confId} {
  // ... 기존 규칙 ...

  // Stamps: 인증된 사용자면 쓰기 가능 (스탬프 투어용)
  match /stamps/{stampId} {
    allow read: if true;
    allow create: if isAuthenticated();
  }

  // 기존 하위 컬렉션 규칙 유지
  match /registrations/{userId} { ... }
  match /external_attendees/{attendeeId} { ... }
}
```

### 1.2 useVendor.ts 수정
**파일**: `src/hooks/useVendor.ts`

**현재 문제** (라인 224-231):
```typescript
// 무조건 스탬프 저장
await addDoc(collection(db, `conferences/${conferenceId}/stamps`), {...});
```

**수정 내용**:
```typescript
// 1. sponsor 정보 조회
const sponsorRef = doc(db, `conferences/${conferenceId}/sponsors/${vendor.id}`);
const sponsorSnap = await getDoc(sponsorRef);
const sponsorData = sponsorSnap.exists() ? sponsorSnap.data() : null;

// 2. 스탬프 투어 참가 업체만 스탬프 저장
if (sponsorData?.isStampTourParticipant === true) {
  await addDoc(collection(db, `conferences/${conferenceId}/stamps`), {
    userId: scanResult.user.id,
    vendorId: vendor.id,
    vendorName: vendor.name,
    timestamp: Timestamp.now()
  });
}
```

---

## Phase 2: URL 구조 변경

### 2.1 목표 URL 구조
```
/partner                           → 첫 번째 벤더로 리다이렉트
/partner/:vendorId                 → 해당 벤더 대시보드
/partner/:vendorId/scanner         → 해당 벤더 스캐너
/partner/:vendorId/scanner/camera  → 카메라 스캐너
/partner/:vendorId/scanner/external → 외부 리더기 모드
/partner/:vendorId/profile         → 해당 벤더 프로필 설정
/partner/:vendorId/staff           → 해당 벤더 스태프 관리
/partner/:vendorId/notification    → 해당 벤더 알림 설정
```

### 2.2 파일 수정 목록

| 파일 | 작업 내용 |
|------|----------|
| `App.tsx` | `/partner/:vendorId/*` 라우팅 구조로 변경 |
| `VendorPortalLayout.tsx` | URL 기반 vendorId 처리, 권한 체크 로직 수정 |
| `VendorDashboardPage.tsx` | `useOutletContext` → `useParams` |
| `VendorSettingsPage.tsx` | `useOutletContext` → `useParams` |
| `VendorStaffPage.tsx` | `useOutletContext` → `useParams` |
| `VendorScannerPage.tsx` | `useOutletContext` → `useParams` |
| `PartnerNotificationSettingsPage.tsx` | `useOutletContext` → `useParams` |

### 2.3 App.tsx 라우팅 변경
**현재**:
```tsx
<Route path="/partner" element={<VendorPortalLayout />}>
  <Route index element={<VendorDashboardPage />} />
  <Route path="scanner">...</Route>
  <Route path="profile" element={<VendorSettingsPage />} />
  ...
</Route>
```

**변경 후**:
```tsx
<Route path="/partner" element={<VendorPortalLayout />}>
  <Route index element={<Navigate to="first" replace />} />
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

### 2.4 VendorPortalLayout.tsx 변경
**핵심 변경사항**:
1. `useParams()`로 URL에서 vendorId 추출
2. vendorId 권한 체크
3. 권한 없으면 첫 번째 벤더로 리다이렉트
4. 사이드바 NavLink 경로에 vendorId 포함

---

## Phase 3: 검증

### 검증 시나리오
1. **방문자 QR 스캔** → Lead 저장 확인
2. **스탬프 투어 참가 업체** → Stamp 저장 확인
3. **스탬프 투어 미참가 업체** → Stamp 저장 안됨 확인
4. **참가자 명찰** → 스탬프 진행 상황 표시 확인
5. **알림톡** → 발송 확인 (동의한 경우)

---

## 실행 순서

1. ✅ Firestore Rules 수정
2. ✅ useVendor.ts 수정 (isStampTourParticipant 체크)
3. ✅ App.tsx 라우팅 변경
4. ✅ VendorPortalLayout.tsx 수정
5. ✅ 하위 페이지들 useParams 변경
6. ✅ 검증

---

## 위험 요소 및 대응

| 위험 | 대응 |
|------|------|
| Firestore Rules 배포 후 기존 기능 영향 | 규칙 변경 최소화, stamps만 예외 처리 |
| URL 변경 후 기존 북마크 404 | /partner 접속 시 첫 번째 벤더로 리다이렉트 |
| sponsor 문서 없는 경우 | isStampTourParticipant 기본값 false 처리 |
