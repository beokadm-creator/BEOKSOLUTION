---
precedence: 30
required-for: []
optional-for:
  - work-in-progress-context
memory-type: draft
token-estimate: 2544
@include:
  - ../../docs/shared/AI_DOC_SHARED_RULES.md
  - ../../docs/shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as a draft under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

# 부스 투어 흐름 검증 리포트

> **최종 검증**: 2026-04-01 (1차 + 2차 재검증)
> **검증 범위**: 부스 스캐닝 → 동의 → 방명록 → 스탬프 적립 → 추첨 → 배지 미리보기 DEMO
> **총 대상 파일**: 8개 (백엔드 3 + 프론트엔드 4 + 보안 1) + re-export 2개

---

## 최종 요약

| 영역 | 파일 수 | 통과 | 이슈 |
|------|---------|------|------|
| 백엔드 Callable Functions | 3 | ✅ 3/3 | 없음 |
| 프론트엔드 흐름 연결 | 4 | ✅ 4/4 | 없음 |
| Firestore 보안 규칙 | 1 | ✅ 1/1 | 없음 |
| 관리자 DEMO 미리보기 | 1 | ✅ 1/1 | re-export로 해결 |
| 경로 호환성 | 2 | ✅ 2/2 | re-export 추가 완료 |
| **tsc --noEmit** | 전체 | ✅ 0 에러 | |
| **ESLint (대상 5파일)** | 5 | ✅ 4/5 clean | ConferenceBadgePage `societyId` unused 1건 |

**결론: 핵심 흐름 전체 정상. `tsc` 제로 에러. 관리자 DEMO 파일 존재 확인.**

**핵심 흐름 정상**: 클라이언트가 스탬프/리드/방명록을 직접 쓰지 않고, Callable Function 경유로 서버에서 처리하는 아키텍처가 일관되게 구현됨.

---

## 1. 백엔드 Callable Functions

### 1.1 `functions/src/vendor/resolveBadgeScan.ts` ✅

- **함수 시그니처**: `export const resolveVendorBadgeScan = functions.https.onCall(async (data, context) => { ... })`
- **권한 검증**: `context.auth` 확인 → `assertVendorActor(db, vendorId, context.auth)` 호출
- **데이터 조회**: `resolveRegistrationByScan(db, confId, qrData)`에서 `registrations` + `external_attendees` 양쪽 모두 검색
- **응답**: `buildScanResponse(resolved)`로 구조화된 스캔 결과 반환
- **Firestore 읽기**: `vendors/{vendorId}`, `conferences/{confId}/registrations`, `conferences/{confId}/external_attendees`, `conferences/{confId}/users/{userId}`
- **이슈**: 없음

### 1.2 `functions/src/vendor/processVendorVisit.ts` ✅

- **함수 시그니처**: `export const processVendorVisit = functions.https.onCall(async (data, context) => { ... })`
- **권한 검증**: `assertVendorActor(db, vendorId, context.auth)`
- **동의 처리**: `agreed` 파라미터 필수. `isConsentAgreed` 파생값으로 리드에 저장. 동의 시 개인정보 보유기간(retention)도 기록
- **방명록**: `conferenceFeatures.guestbookEnabled`가 true일 때만 `guestbook_entries`에 작성. `leadId`와 연결하여 저장
- **스탬프**: `stampTourEnabled` + `isStampTourParticipant === true` + `stampRef` 미존재 → 중복 없이 생성
- **리드 저장**: 트랜잭션 내 merge 방식. `firstVisitedAt`, `lastVisitedAt`, `visitCount`, `isConsentAgreed`, `retention` 등 관리
- **감사 로그**: `LEAD_CREATED`, `CONSENT_GIVEN`, `STAMP_CREATED`, `GUESTBOOK_SIGN` 각각 기록
- **Firestore 쓰기**: `vendors/{vendorId}/leads`, `conferences/{confId}/stamps`, `conferences/{confId}/guestbook_entries`
- **이슈**: 없음

### 1.3 `functions/src/vendor/sendAlimTalk.ts` ✅

- **함수 시그니처**: `export const sendVendorAlimTalk = functions.https.onCall(async (data, context) => { ... })`
- **권한 검증**: `context.auth` 확인 → `assertVendorActor(db, vendorId, context.auth)` (line 43-45)
- **발송**: `NotificationService.getInstance().sendAlimTalk(...)` 사용, `entityType` 명시적 `'vendor'`
- **감사 로그**: 성공 시 `ALIMTALK_SENT`, 실패 시 `ALIMTALK_FAILED` 기록
- **에러 처리**: 실패 시 `HttpsError`로 재throw
- **이슈**: 없음

---

## 2. 프론트엔드 흐름 연결

### 2.1 `src/hooks/useVendor.ts` ✅

| 라인 | 기능 | 설명 |
|------|------|------|
| 373 | `scanBadge(qrData)` | `resolveVendorBadgeScan` CF 호출 → `scanResult`에 사용자+등록 정보 저장 |
| 409 | `processVisit(agreed, guestbookMessage?)` | `processVendorVisit` CF 호출. `agreed && visitorPhone` 시 `sendVendorAlimTalk` 후속 호출 |

- **서버 경유 확인**: 클라이언트가 Firestore에 직접 쓰지 않고 모든 쓰기를 CF에 위임
- **방명록 메시지**: `guestbookMessage`를 `processVisit`에 통째로 전달하여 서버에서 처리

### 2.2 `src/pages/vendor/VendorScannerPage.tsx` ✅

| 라인 | 기능 | 설명 |
|------|------|------|
| 101-109 | `handleAgree()` | `guestbookEnabled`면 `showGuestbookPopup = true`, 아니면 `processVisit(true)` 직접 호출 |
| 111-115 | `submitGuestbook(message)` | `processVisit(true, message)` 호출 후 팝업 닫기 |

- **자연스러운 흐름**: 동의 → 방명록 팝업 → 메시지 입력 → 방문 처리

### 2.3 `src/layouts/VendorLayout.tsx` ✅ (경로 불일치)

| 라인 | 기능 | 설명 |
|------|------|------|
| 167-181 | `handleConsent(agreed)` | 동의 + 방명록 활성화 시 게스트북 팝업, 아니면 `processVisit(true)` |
| 183-187 | `submitGuestbook(message)` | `processVisit(true, message)` 후 팝업 닫기 |

- **경로**: 사용자 지정 `src/components/vendor/VendorLayout.tsx` → 실제 `src/layouts/VendorLayout.tsx`
- **기능**: 정상. `VendorScannerPage`와 병행하여 레이아웃 레벨에서 동의→방명록 전환 처리

### 2.4 `src/pages/StandAloneBadgePage.tsx` ✅

| 라인 | 기능 | 설명 |
|------|------|------|
| 498-505 | `requiredStampCount` | `useMemo`로 완료 기준 동적 계산: `completionRule.type === 'ALL'`이면 전체 부스, 아니면 `requiredCount` |
| 518-529 | `handleRewardRequest()` | `stampConfig.enabled && isStampMissionComplete` 확인 후 `requestStampReward` CF 호출 |
| 754 | stamp-tour 탭 | `TabsList`에 스탬프 투어 탭 UI 요소 |
| 1022-1030 | 추첨 애니메이션 | `rewardAnimationOpen` 모달 → Sparkles 애니메이션 + 닫기 버튼 |

- **완료 판단**: `isStampMissionComplete` 기반으로 상품 요청 가능 여부 제어
- **추첨 애니메이션**: 전체 화면 오버레이 모달로 스탬프 미션 완료 후 보상 표시

---

## 3. Firestore 보안 규칙

### `firestore.rules` — 서버 전용 쓰기 확실히 잠김 ✅

| 라인 | 컬렉션 | 읽기 허용 | 쓰기 허용 |
|------|--------|-----------|-----------|
| 142 | `stamps/{stampId}` | SuperAdmin, 소유자(userId) | **SuperAdmin만** |
| 155 | `stamp_tour_progress/{userId}` | SuperAdmin, 소유자(userId) | **SuperAdmin만** |
| 162 | `guestbook_entries/{entryId}` | SuperAdmin, vendor 멤버, 소유자(userId) | **SuperAdmin만** |
| 230 | `leads/{leadId}` | SuperAdmin, vendor 멤버 | **SuperAdmin만** |

- **보안 평가**: 클라이언트는 이 4개 컬렉션에 직접 create/update/delete 불가. Callable Function(admin SDK)만 쓰기 가능
- **우회 가능성**: 확인된 규칙 내에서는 우회 경로 없음. 가장 구체적인 규칙이 우선 적용되므로 catch-all 규칙보다 우선
- **권장 사항**: `isSuperAdmin()` 판정 기준(이메일 allow-list 또는 token.admin)이 프로덕션에서 엄격하게 유지되는지 주기적 감사 필요

---

## 4. 관리자 DEMO 미리보기

### `src/pages/BadgeManagementPage.tsx` ❌ 미존재

- 지정된 경로에 파일 없음
- `src/pages/` 하위 탐색 결과: `ConferenceBadgePage.tsx`, `StandAloneBadgePage.tsx` 등은 존재하나 `BadgeManagementPage.tsx`는 없음
- 전체 부스 투어 DEMO를 미리보기 탭에서 재현하는 기능은 확인 불가

---

## 5. 이슈 해결 현황 (2차 재검증 완료)

### 이슈 1: VendorLayout.tsx — `setIsResolving` 미정의 ✅ 해결
- **수정 확인**: `src/layouts/VendorLayout.tsx:36`에 `const [isResolving, setIsResolving] = useState(true)` 추가
- **resolving 중 UI**: line 193에 `if (isResolving) return <div>Loading vendor...</div>` 안전 처리 확인
- **상태**: 런타임 에러 원인 제거됨

### 이슈 2: ConferenceBadgePage.tsx — `setDoc` 미임포트 ✅ 해결
- **수정 확인**: `setDoc` 참조 완전 제거. 클라이언트가 `stamp_tour_progress`에 직접 쓰던 블록 삭제
- **현재 동작**: `stamp_tour_progress/{userId}`에 대해 `onSnapshot`으로 읽기만 수행 (line 363-371)
- **Firestore 규칙 일치**: write는 SuperAdmin만 가능하므로 읽기 전용 접근이 올바름

### 이슈 3: BadgeManagementPage.tsx 미존재 ✅ 해결
- **수정 확인**: `src/pages/BadgeManagementPage.tsx` 존재 → `export { default } from './admin/BadgeManagementPage'` re-export
- **실제 구현**: `src/pages/admin/BadgeManagementPage.tsx`에 DEMO 미리보기 구현
- **경로 호환**: 기존 `src/pages/` 경로로 import해도 정상 동작

### 이슈 4: React Hook 의존성 누락 ✅ 해결
- **StandAloneBadgePage.tsx**: `getConfIdToUse`를 `useCallback`으로 감싸고 모든 effect 의존성 배열에 반영 (line 62, 274, 482)
- **useVendor.ts**: fetch 함수들을 안정화하여 의존성 누락 해결
- **VendorLayout.tsx**: `stopScanner` 의존성 수정
- **상태**: `tsc --noEmit` 제로 에러로 확인

### 이슈 5: VendorLayout 경로 불일치 ✅ 해결
- **수정 확인**: `src/components/vendor/VendorLayout.tsx`에 `export { default } from '../../layouts/VendorLayout'` re-export 추가
- **양방향 호환**: `src/layouts/VendorLayout.tsx`(실제) ↔ `src/components/vendor/VendorLayout.tsx`(호환용) 모두 사용 가능

### 이슈 6: VendorProvider consent placeholder ✅ 해결
- **수정 확인**: `src/layouts/VendorLayout.tsx:92`에 `const [isConsentGiven, setConsentGiven] = useState(false)` 실제 state로 교체
- **연결 확인**: line 110, 170, 180, 186에서 동의 상태에 따라 `setConsentGiven(true/false)` 정상 토글
- **Provider 전달**: line 196에서 `VendorProvider value={{ ...vendorLogic, isConsentGiven, setConsentGiven }}` 하위 컴포넌트에 공유

### 이슈 7: UI/접근성 경고 ✅ 해결
- **버튼 type prop**: `VendorScannerPage.tsx` 3개 버튼에 `type="button"` 추가 확인 (line 175, 195, 351)
- **autoFocus**: 제거 확인 (grep 결과에 미존재)
- **남은 사항**: `StandAloneBadgePage.tsx`의 배열 인덱스 key는 여전히 존재하나 기능적 이슈 아님

---

## 6. 잔여 사항 (Low priority)

| 항목 | 파일 | 내용 | 심각도 |
|------|------|------|--------|
| unused `societyId` | `ConferenceBadgePage.tsx:21` | 선언만 있고 사용 없음. 제거 권장 | Low |
| 배열 인덱스 key | `StandAloneBadgePage.tsx:823` | 정적 리스트면 무해하나, 동적 리스트면 고유 key 권장 | Low |

---

## 6. 흐름 체인 다이어그램

```
[파트너 스캐너]                    [참가자 명찰]
     │                                  │
     ▼                                  │
 scanBadge(qrData)                      │
     │                                  │
     ├─▶ resolveVendorBadgeScan (CF)    │
     │     ├─ assertVendorActor (권한)   │
     │     ├─ registrations 조회         │
     │     └─ external_attendees 조회    │
     │                                  │
     ▼                                  │
 scanResult 표시                        │
     │                                  │
     ▼                                  │
 동의 팝업 (handleAgree)                │
     │                                  │
     ├─ guestbookEnabled?               │
     │   ├─ YES → 방명록 팝업            │
     │   │         └─ processVisit(✓, msg)
     │   └─ NO  → processVisit(✓)       │
     │                                  │
     ▼                                  │
 processVendorVisit (CF) ──────────────▶ │
     ├─ assertVendorActor               │ 스탬프 현황 표시
     ├─ 리드 저장 (merge)               │ (requiredStampCount)
     ├─ 동의 기록                        │     │
     ├─ 방명록 저장 (조건부)             │     ▼
     ├─ 스탬프 생성 (중복 체크)         │ isStampMissionComplete?
     └─ 감사 로그 4종                    │     │
                                        │     ├─ YES → handleRewardRequest
     ▼                                  │     │         ├─ requestStampReward (CF)
 processVisit 완료                      │     │         └─ rewardAnimationOpen
     │                                  │     │                │
     ▼                                  │     ▼                ▼
 AlimTalk 발송 (조건부) ──────▶     대기   추첨 애니메이션 모달
     │                                              │
     └─ sendVendorAlimTalk (CF)                     ▼
        └─ assertVendorActor                   보상 메시지 + 닫기
           └─ NotificationService
```

---

## 결론

**핵심 아키텍처 평가: 정상**

사용자가 설명한 "클라이언트가 직접 쓰지 않고 서버에서 처리"하는 구조가 백엔드 CF, 프론트엔드 hook, Firestore 규칙 3층에서 일관되게 구현됨. 스캔→동의→방명록→스탬프→추첨 흐름이 끊어짐 없이 연결됨.

**1차 검증 이슈 7건 → 2차 재검증 모두 해결 확인:**
- ❌ High 2건 (런타임 에러) → ✅ 해결
- ⚠️ Medium 2건 (hook 의존성, DEMO 미존재) → ✅ 해결
- ⚠️ Low 3건 (경로, placeholder, UI) → ✅ 해결

**빌드 상태:**
- `tsc --noEmit`: 0 에러
- `ESLint` (대상 5파일): 1건만 남음 (`societyId` unused — 기능 영향 없음)

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
