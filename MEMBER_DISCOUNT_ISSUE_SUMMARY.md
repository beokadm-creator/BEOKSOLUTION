# 회원 인증 금액 적용 문제 - 빠른 요약

**문제**: KADD 학회 등록 페이지에서 마이페이지의 회원 인증 정보가 로드되지 않아 비회원 가격이 표시됨

---

## 🎯 핵심 원인 (3줄 요약)

1. **마이페이지에서 인증 완료** → `affiliations[societyId] = { verified: true, grade: "..." }` 저장 ✅
2. **등록 페이지 재방문** → `isVerified = true` 확인되지만 ⚠️
3. **`memberVerificationData = null`** → 인증 정보가 로드되지 않아 비회원 가격 표시 ❌

---

## 📍 문제 위치

### 1. 마이페이지 인증 데이터가 로드되지 않음
**파일**: [src/pages/RegistrationPage.tsx#L343-L356](src/pages/RegistrationPage.tsx#L343-L356)

```
현재: isVerified = true ✅ 
      but memberVerificationData = null ❌ (로드 안 됨)

필요: isVerified = true ✅
      AND memberVerificationData = { grade: "Dental Hygienist", ... } ✅
```

### 2. 등급 매칭 실패
**파일**: [src/pages/RegistrationPage.tsx#L387-L429](src/pages/RegistrationPage.tsx#L387-L429)

```
if (memberVerificationData?.grade) {  // null이므로 이 블록 실행 안 됨
    // 등급 자동 선택 로직
}
```

### 3. 가격 계산 실패
**파일**: [src/pages/RegistrationPage.tsx#L813-825](src/pages/RegistrationPage.tsx#L813-825)

```
selectedGradeId = 'non_member' (기본값)
→ tierPrice = activePeriod.prices['non_member'] (비회원 가격)
```

---

## ✅ 해결 방법

### 방법 1: 마이페이지 인증 데이터 로드 (필수)

**추가할 코드**: [src/pages/RegistrationPage.tsx](src/pages/RegistrationPage.tsx) 라인 356 이후

```typescript
// [FIX] 마이페이지 인증 정보를 memberVerificationData로 로드
useEffect(() => {
    if (memberVerificationData) return;
    if (!auth.user || !info?.societyId || !isVerified) return;
    
    const affiliations = (auth.user as any)?.affiliations || {};
    const societyAffiliation = affiliations[info?.societyId];
    
    if (societyAffiliation?.grade) {
        setMemberVerificationData({
            grade: societyAffiliation.grade,
            id: societyAffiliation.id,
            societyId: info.societyId
        });
    }
}, [auth.user, info?.societyId, isVerified, memberVerificationData]);
```

**효과**: `memberVerificationData.grade`가 로드되어 등급 매칭 가능

---

### 방법 2: 가격 조회 로직 강화 (권장)

**수정할 코드**: [src/pages/RegistrationPage.tsx](src/pages/RegistrationPage.tsx) 라인 813-825

**현재**:
```typescript
const tierPrice = activePeriod.prices[selectedGradeId]
               ?? activePeriod.prices[selectedGrade?.code || '']
               ?? activePeriod.prices[selectedGrade?.name || ''];
```

**수정 후**:
```typescript
const findMatchingPrice = (grade: any, prices: Record<string, number>) => {
    if (!grade?.grade) return null;
    const variants = [
        String(grade.grade).toLowerCase(),
        String(grade.grade).toLowerCase().replace(/\s+/g, '_'),
        String(grade.grade).toLowerCase().replace(/\s+/g, ''),
    ];
    for (const key of variants) {
        if (prices[key] !== undefined) return prices[key];
    }
    return null;
};

const tierPrice = findMatchingPrice(memberVerificationData, activePeriod?.prices || {})
               ?? activePeriod?.prices[selectedGradeId]
               ?? activePeriod?.prices[selectedGrade?.code || ''];
```

**효과**: "Dental Hygienist" → "dental_hygienist" 자동 변환으로 가격 조회 성공

---

## 📊 데이터 흐름 비교

### ❌ 현재 (문제 상황)
```
마이페이지 인증 → affiliations 저장 ✅
                     ↓
등록 페이지 방문 → isVerified = true ✅
                → memberVerificationData = null ❌
                → 등급 자동 선택 불가 ❌
                → selectedGradeId = 'non_member' (기본값)
                → 비회원 가격 표시 ❌
```

### ✅ 수정 후 (예상 결과)
```
마이페이지 인증 → affiliations 저장 ✅
                     ↓
등록 페이지 방문 → isVerified = true ✅
                → memberVerificationData 로드 ✅
                → 등급 자동 선택 ✅ (예: 'dental_hygienist')
                → 가격 정규화 매칭 ✅
                → 회원 할인 가격 표시 ✅
```

---

## 🔧 즉시 적용 가능한 코드

전체 패치 코드는 [MEMBER_DISCOUNT_FIX.patch.ts](MEMBER_DISCOUNT_FIX.patch.ts) 파일 참조

**최소 수정 (라인 2개 추가)**:

```typescript
// Line 343-356 이후에 추가
useEffect(() => {
    if (memberVerificationData || !auth.user || !isVerified) return;
    const affiliations = (auth.user as any)?.affiliations || {};
    if (affiliations[info?.societyId]?.grade) {
        setMemberVerificationData(affiliations[info.societyId]);
    }
}, [auth.user, info?.societyId, isVerified, memberVerificationData]);
```

---

## 🧪 테스트 방법

1. **KADD 회원 로그인**
2. **마이페이지 방문** → "회원 인증" 버튼 클릭 → 회원 인증 완료
3. **KADD 콘퍼런스 등록 페이지 재방문**
   - URL: `https://kadd.eregi.co.kr/kadd_2026spring/register`
4. **Console 확인**:
   - `[MemberDiscount] Loaded affiliation data from MyPage` 메시지 확인
   - `[MemberDiscount] Grade matched successfully` 메시지 확인
5. **가격 확인**: 회원 할인 가격이 표시되는지 확인 ✅

---

## 📋 체크리스트

- [ ] PATCH 1 적용: 마이페이지 인증 데이터 로드 추가
- [ ] PATCH 2 적용: 가격 조회 로직 강화
- [ ] 콘솔 로그 확인
- [ ] 로컬 테스트 (KADD 회원 계정)
- [ ] Staging 환경 테스트
- [ ] Production 배포

---

## 📞 추가 정보

**상세 분석**: [MEMBER_DISCOUNT_ISSUE_ANALYSIS.md](MEMBER_DISCOUNT_ISSUE_ANALYSIS.md)

**패치 코드**: [MEMBER_DISCOUNT_FIX.patch.ts](MEMBER_DISCOUNT_FIX.patch.ts)

**관련 파일**:
- [src/pages/RegistrationPage.tsx](src/pages/RegistrationPage.tsx)
- [src/hooks/useAuth.ts](src/hooks/useAuth.ts)
- [functions/src/index.ts#L450](functions/src/index.ts#L450)

