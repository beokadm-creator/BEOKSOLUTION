---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 1303
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

# 회원/비회원 완전 분리 - 수정 사항 검증

## 1. ConferenceDetailHome.tsx 수정

### 추가된 기능

#### 1.1 비회원 감지 로직 추가
```typescript
// Auth state for guest detection
const { auth } = useAuth('');
const user = auth.user;
const isAnonymous = (user as any)?.isAnonymous || false;

// Non-member auth hook
const { logout: logoutNonMember } = useNonMemberAuth(slug);
```

#### 1.2 비회원 세션 정리 로직
```typescript
// [CRITICAL] Clear stale non-member sessions on mount
useEffect(() => {
    if (isAnonymous) {
        console.log('[ConferenceDetailHome] Clearing stale non-member session for anonymous user');
        // Clear sessionStorage NON_MEMBER session
        sessionStorage.removeItem('NON_MEMBER');
        // Call logout from useNonMemberAuth to clear any remaining state
        if (logoutNonMember) {
            logoutNonMember();
        }
    }
}, [isAnonymous, logoutNonMember]);
```

**목적**: 비회원이 등록 페이지에서 나갔다가 다시 접근할 때, 오래된 세션을 정리하여 "등록확인" 대신 "등록하기" 버튼이 보이도록 함

#### 1.3 버튼 로직 수정 (완전 분리)

**수정 전**:
```typescript
{isNonMemberRegistered ? (
    <button>비회원등록조회 (Check Status)</button>
) : (
    <button onClick={() => navigate(`/${slug}/register?mode=guest`)}>
        사전등록 신청하기 (Register)
    </button>
)}
```

**수정 후**:
```typescript
{isAnonymous ? (
    // 비회원: 무조건 등록하기 버튼 + ?mode=guest
    <>
        <button type="button" onClick={() => navigate(`/${slug}/register?mode=guest`)}>
            사전등록 신청하기 (Register)
        </button>
        <p>🔵 비회원으로 진행합니다. 이 브라우저에서만 접수 내역을 확인할 수 있습니다.</p>
    </>
) : (
    // 회원: 등록 상태에 따라 버튼 결정 + ?mode=member
    <>
        {isNonMemberRegistered ? (
            <button type="button" onClick={() => navigate(`/${slug}/check-status`)}>
                비회원등록조회 (Check Status)
            </button>
        ) : (
            <button type="button" onClick={() => navigate(`/${slug}/register?mode=member`)}>
                사전등록 신청하기 (Register)
            </button>
        )}
    </>
)}
```

---

## 2. RegistrationPage.tsx 수정

### 2.1 Mode 파라미터 우선 순위 변경

**수정 전** (로그인 상태 우선):
```typescript
const isMemberMode = auth.user && !isAnonymous;
const isGuestMode = !isMemberMode;
const mode = isMemberMode ? 'member' : (modeFromUrl || 'guest');
```

**수정 후** (URL 파라미터 우선):
```typescript
// URL mode parameter takes precedence over auth state
const mode = modeFromUrl || (auth.user && !isAnonymous ? 'member' : 'guest');
const isMemberMode = mode === 'member';
const isGuestMode = mode === 'guest';
```

**결과**:
- `?mode=member` → 무조건 회원 모드 (로그인 상태 무관)
- `?mode=guest` → 무조건 비회원 모드 (로그인 상태 무관)
- mode 없음 → 로그인 상태로 fallback

---

## 3. 전체 흐름 검증

### 3.1 회원 로그인 시나리오

| 단계 | URL | 상태 | 버튼 | 동작 |
|------|-----|------|------|------|
| 1. ConferenceHome 접근 | `/{slug}` | 로그인됨 | "사전등록 신청하기" | `?mode=member`로 이동 |
| 2. RegistrationPage 접근 | `/{slug}/register?mode=member` | `isMemberMode=true` | - | 비밀번호 UI 숨김 |
| 3. 등록 진행 | `/{slug}/register?mode=member` | 회원 모드 유지 | - | password 필드 저장 안됨 (null) |
| 4. 페이지 나갔다가 재접근 | `/{slug}` | 로그인 유지 | "사전등록 신청하기" | 다시 `?mode=member`로 이동 |

### 3.2 비회원 시나리오 (새로운 등록)

| 단계 | URL | 상태 | 버튼 | 동작 |
|------|-----|------|------|------|
| 1. ConferenceHome 접근 | `/{slug}` | 비회원 (익명) | "사전등록 신청하기" | `?mode=guest`로 이동 |
| 2. RegistrationPage 접근 | `/{slug}/register?mode=guest` | `isGuestMode=true` | - | 비밀번호 UI 표시 |
| 3. 등록 진행 | `/{slug}/register?mode=guest` | 비회원 모드 유지 | - | password 필드 저장됨 |
| 4. 페이지 나갔다가 재접근 | `/{slug}` | 익명 세션 정리됨 | "사전등록 신청하기" | 다시 `?mode=guest`로 이동 |

**중요 수정**:
- 페이지 나갔을 때 익명 세션이 정리되므로, 재접근 시 "등록확인" 버튼이 나오지 않음
- 항상 "등록하기" 버튼이 나와서 새로운 등록을 시작할 수 있음

### 3.3 비회원 시나리오 (이미 등록 완료)

| 단계 | URL | 상태 | 버튼 | 동작 |
|------|-----|------|------|------|
| 1. ConferenceHome 접근 | `/{slug}` | 비회원 (익명) | "비회원등록조회 (Check Status)" | `/{slug}/check-status`로 이동 |
| 2. 결제 완료 후 | `/{slug}` | PAID 상태 | "비회원등록조회" | 확인 페이지로 이동 |

---

## 4. 예상 동작 vs 실제 동작

### 4.1 예상 동작 (수정 후)

| 상황 | URL | isMemberMode | isGuestMode | 비밀번호 UI | password 필드 저장 |
|-------|------|-------------|-------------|--------------|-----------------|
| 회원 로그인 | `/{slug}/register?mode=member` | true | false | ❌ 숨김 | ❌ 저장 안됨 (null) |
| 비회원 접근 | `/{slug}/register?mode=guest` | false | true | ✅ 표시 | ✅ 저장됨 |
| 비회원 페이지 나갔다가 재접근 | `/{slug}` → `/{slug}/register?mode=guest` | false | true | ✅ 표시 | ✅ 저장됨 |

### 4.2 이전 문제점 해결

| 문제 | 원인 | 해결 방안 |
|------|------|-----------|
| 비회원이 "등록확인" 버튼을 봄 | ConferenceDetailHome이 비회원 감지 안함 | `isAnonymous` 체크 추가 |
| 비회원이 다시 등록할 수 없음 | 오래된 세션이 정리되지 않음 | 페이지 mount 시 세션 정리 로직 추가 |
| 로그인 상태가 URL mode보다 우선됨 | `isMemberMode = auth.user && !isAnonymous` | `mode = modeFromUrl || ...`로 수정 |

---

## 5. 최종 검증 체크리스트

- [x] ConferenceDetailHome에 `isAnonymous` 감지 로직 추가
- [x] 비회원이면 무조건 `?mode=guest`로 이동
- [x] 회원이면 `?mode=member`로 이동
- [x] RegistrationPage에서 URL mode 파라미터를 신뢰
- [x] ConferenceDetailHome mount 시 비회원 세션 정리
- [x] 비회원이 페이지를 나갔다가 재접근 시 "등록하기" 버튼 표시
- [x] 회원/비회원 완전 분리 (서로 간섭 없음)

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
