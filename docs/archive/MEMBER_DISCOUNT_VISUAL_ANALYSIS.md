---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 3406
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

# 회원 인증 금액 적용 문제 - 시각화 분석

## 🔄 데이터 흐름 다이어그램

### ❌ 현재 상황 (문제 발생)

```
┌─────────────────────────────────────────────────────────────────┐
│                     마이페이지 (MyPage)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. 회원 인증 버튼 클릭                                         │
│  2. verifyMemberIdentity() CloudFunction 호출                    │
│  3. 응답 수신: {                                                │
│       success: true,                                             │
│       grade: "Dental Hygienist",      ← 서버에서 반환           │
│       memberData: { id, name, grade } ← 중요한 정보             │
│     }                                                            │
│  4. affiliations 업데이트                                       │
│     auth.user.affiliations.kadd = {                             │
│       verified: true,         ✅                                 │
│       grade: "Dental Hygienist",  ✅                            │
│       ...                                                        │
│     }                                                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    [마이페이지 닫음]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│            콘퍼런스 등록 페이지 (Registration)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Step 1: useAuth() 호출                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ auth.user = {                                           │   │
│  │   uid: "user123",                                       │   │
│  │   email: "member@example.com",                          │   │
│  │   affiliations: {                                       │   │
│  │     kadd: {                                             │   │
│  │       verified: true,      ✅ 인증 상태 로드됨!         │   │
│  │       grade: "Dental Hygienist",  ✅ 등급 정보 있음!    │   │
│  │     }                                                   │   │
│  │   }                                                     │   │
│  │ }                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Step 2: useEffect (라인 343-356) 실행                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ if (userAffiliation?.verified) {                        │   │
│  │   setIsVerified(true);  ← ✅ 인증 상태 설정됨           │   │
│  │ }                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Step 3: 🔴 문제 발생!                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ memberVerificationData = null  ← ❌ 데이터 로드 안 됨!  │   │
│  │                                                         │   │
│  │ ← 마이페이지의 affiliations 정보가                      │   │
│  │   memberVerificationData로 초기화되지 않음!             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Step 4: useEffect (라인 387-429) 실행 - 등급 매칭             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ if (isVerified) {     ← true 맞음                       │   │
│  │   if (memberVerificationData?.grade) {  ← 🔴 null!     │   │
│  │     // 이 블록이 실행되지 않음!                         │   │
│  │     setSelectedGradeId(matched.id);                     │   │
│  │   }                                                     │   │
│  │ }                                                       │   │
│  │                                                         │   │
│  │ 결과: selectedGradeId 자동 선택 안 됨                   │   │
│  │      selectedGradeId = 'non_member' (기본값 유지)       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Step 5: 가격 계산 (라인 813-825)                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ const priceKey = selectedGradeId;    ← 'non_member'   │   │
│  │ const tierPrice = activePeriod.prices[priceKey]        │   │
│  │                                                         │   │
│  │ tierPrice = activePeriod.prices['non_member']          │   │
│  │          = 150,000 ← 비회원 가격! ❌                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  🎯 최종 결과: 비회원 가격 (150,000원) 표시 ❌                 │
│      기대값: 회원 할인 가격 (80,000원) ✅                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### ✅ 수정 후 (예상 결과)

```
┌─────────────────────────────────────────────────────────────────┐
│            콘퍼런스 등록 페이지 (Registration) - 수정됨           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Step 1-2: (동일)                                               │
│  auth.user 로드됨 ✅                                             │
│  isVerified = true 설정됨 ✅                                    │
│                                                                   │
│  Step 2.5: 🟢 새로운 useEffect 추가!                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ // [FIX] 마이페이지 인증 데이터 로드                   │   │
│  │ useEffect(() => {                                       │   │
│  │   if (auth.user && isVerified && !memberVerificationData) {│  │
│  │     const affiliations = auth.user.affiliations || {};  │   │
│  │     const aff = affiliations[societyId];                │   │
│  │     if (aff?.grade) {                                   │   │
│  │       setMemberVerificationData({                       │   │
│  │         grade: aff.grade,   ← "Dental Hygienist"       │   │
│  │         id: aff.id,                                     │   │
│  │         ...                                             │   │
│  │       });  ← ✅ 데이터 로드됨!                          │   │
│  │     }                                                   │   │
│  │   }                                                     │   │
│  │ }, [auth.user, isVerified, memberVerificationData]);    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Step 3: memberVerificationData 로드됨 ✅                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ memberVerificationData = {                              │   │
│  │   grade: "Dental Hygienist",  ✅                        │   │
│  │   id: "doc123",                                         │   │
│  │   ...                                                   │   │
│  │ }                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Step 4: useEffect (라인 387-429) 실행 - 등급 매칭            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ if (isVerified) {     ← true                            │   │
│  │   if (memberVerificationData?.grade) {  ← ✅ "Dental Hygienist"│
│  │     const normalizedServer = "dentalhygienist"          │   │
│  │     const matched = grades.find(g => {                  │   │
│  │       gCode = "dental_hygienist".replace(/\s/g, '')     │   │
│  │       return gCode === normalizedServer  ← ✅ 매칭!     │   │
│  │     })                                                  │   │
│  │     if (matched) {                                      │   │
│  │       setSelectedGradeId("dental_hygienist")  ← ✅      │   │
│  │     }                                                   │   │
│  │   }                                                     │   │
│  │ }                                                       │   │
│  │                                                         │   │
│  │ 결과: selectedGradeId = "dental_hygienist" ✅           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Step 5: 가격 계산 (라인 813-825) - 강화됨                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ const findMatchingPrice = (grade, prices) => {          │   │
│  │   const variants = [                                    │   │
│  │     "dental hygienist",         ← 그대로 시도           │   │
│  │     "dental_hygienist",         ← ✅ 매칭!             │   │
│  │     "dentalhygienist"                                   │   │
│  │   ];                                                    │   │
│  │   for (const v of variants) {                           │   │
│  │     if (prices[v] !== undefined)                        │   │
│  │       return prices[v];  ← ✅ 80,000 반환              │   │
│  │   }                                                     │   │
│  │ }                                                       │   │
│  │                                                         │   │
│  │ tierPrice = findMatchingPrice(memberVerificationData,   │   │
│  │                               activePeriod.prices)      │   │
│  │          = 80,000 ← 회원 할인 가격! ✅                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  🎯 최종 결과: 회원 할인 가격 (80,000원) 표시 ✅              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 상태 비교표

| 상태 | 현재 (문제) | 수정 후 | 설명 |
|------|-----------|--------|------|
| **auth.user 로드** | ✅ | ✅ | Firebase Auth 데이터 로드 |
| **affiliations 로드** | ✅ | ✅ | 마이페이지 인증 정보 존재 |
| **isVerified 설정** | ✅ | ✅ | 인증 상태 인식 |
| **memberVerificationData 로드** | ❌ | ✅ | 🔴 핵심 문제 / ✅ 해결 |
| **등급 매칭** | ❌ | ✅ | memberVerificationData 필수 |
| **가격 조회** | ❌ ("non_member") | ✅ ("dental_hygienist") | 등급 매칭 후 가능 |
| **최종 가격** | ❌ 150,000원 | ✅ 80,000원 | 회원 할인 적용 |

---

## 🔍 함수 호출 흐름 분석

### 현재 (문제)

```
useConference()
├─ confId, info, activePeriod 로드 ✅
│
useAuth()
├─ auth.user.affiliations 로드 ✅
│
useEffect (라인 343-356)
├─ isVerified = true 설정 ✅
├─ memberVerificationData = null ❌ ← 로드 안 함
│
useEffect (라인 387-429)
├─ if (memberVerificationData?.grade) ← null이므로 패스
├─ selectedGradeId = 'non_member' (기본값)
│
handleContinueStep()
├─ const tierPrice = activePeriod.prices['non_member']
├─ tierPrice = 150,000 ❌
```

### 수정 후

```
useConference()
├─ confId, info, activePeriod 로드 ✅
│
useAuth()
├─ auth.user.affiliations 로드 ✅
│
useEffect (라인 343-356)
├─ isVerified = true 설정 ✅
│
🟢 NEW useEffect (라인 356 이후)
├─ affiliations[societyId].grade 조회
├─ memberVerificationData 초기화 ✅ ← 새로 추가!
│
useEffect (라인 387-429)
├─ if (memberVerificationData?.grade) ← "Dental Hygienist"
├─ 등급 매칭 실행
├─ selectedGradeId = 'dental_hygienist' ✅
│
handleContinueStep()
├─ findMatchingPrice() 함수로 정규화
├─ const tierPrice = activePeriod.prices['dental_hygienist']
├─ tierPrice = 80,000 ✅
```

---

## 🎯 변경 범위

```
src/pages/RegistrationPage.tsx

┌─────────────────────────────────────────────────────────────┐
│ Line 343-356: 기존 useEffect (변경 없음)                     │
├─────────────────────────────────────────────────────────────┤
│ 🟢 Line 356 이후: 새로운 useEffect 추가 (PATCH 1)           │
│    → memberVerificationData 자동 로드                        │
├─────────────────────────────────────────────────────────────┤
│ Line 387-429: 기존 useEffect (로깅 추가 가능)                 │
├─────────────────────────────────────────────────────────────┤
│ Line 813-825: 가격 계산 로직 수정 (PATCH 2)                 │
│    → findMatchingPrice() 함수 추가                           │
│    → 정규화된 가격 조회                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📈 예상 영향도

| 항목 | 영향도 | 설명 |
|------|--------|------|
| **기존 인증 로직** | 무영향 ✅ | 기존 검증 로직 그대로 유지 |
| **마이페이지** | 무영향 ✅ | 마이페이지 기능 변경 없음 |
| **신규 회원** | 개선 ✅ | 등록 페이지에서 바로 인증하는 경우 동일 |
| **기존 회원** | 개선 ✅ | 마이페이지에서 인증 후 재방문 시 개선 |
| **비회원** | 무영향 ✅ | 비회원 가격 로직 변경 없음 |
| **성능** | 무영향 ✅ | 추가 쿼리나 API 호출 없음 |

---

## 🚀 배포 계획

```
1. 로컬 개발환경 테스트
   ├─ PATCH 1, 2 적용
   ├─ KADD 회원 계정으로 테스트
   └─ 콘솔 로그 확인

2. Staging 환경 배포 (48시간)
   ├─ QA 팀 테스트
   ├─ 회원/비회원 모두 테스트
   └─ 성능 모니터링

3. Production 배포
   ├─ 저녁 시간대 배포 (트래픽 적을 때)
   ├─ 롤백 플랜 준비
   └─ 모니터링

4. 사후 관리
   ├─ 에러 로그 모니터링
   ├─ 가격 정산 검증
   └─ 사용자 피드백 수집
```

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
