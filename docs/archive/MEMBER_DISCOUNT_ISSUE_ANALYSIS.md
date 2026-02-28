# 🔍 회원 인증 금액 적용 문제 분석 리포트
**작성일**: 2026-01-22 | **문제**: KADD 학회 등록 페이지에서 회원 할인 금액 미적용

---

## 📋 문제 현상
- **상황**: 회원이 마이페이지에서 KADD 학회의 회원 인증을 (회원)으로 완료
- **기대값**: 콘퍼런스 등록 페이지 재방문 시 회원 할인 가격이 표시되어야 함
- **실제값**: 비회원 가격이 표시됨 (회원 할인 금액 미적용)
- **URL**: `https://kadd.eregi.co.kr/kadd_2026spring/register?lang=ko`

---

## 🔬 근본 원인 분석

### 1️⃣ **마이페이지 인증 상태 저장 구조**

#### ✅ 올바르게 구현된 부분
**마이페이지 인증 후 affiliations 필드 업데이트**
```typescript
// 마이페이지에서 회원 인증 완료 후
// auth.user.affiliations.kadd = { verified: true, grade: "...", ... }
```

**코드 위치**: [src/pages/UserHubPage.tsx#L525+](src/pages/UserHubPage.tsx)
- 마이페이지에서 회원 인증 후 `affiliations[societyId]` 객체에 인증 정보 저장
- 인증 상태는 **Firestore의 `users/{uid}` 문서**에 저장됨

---

### 2️⃣ **등록 페이지에서의 인증 상태 조회 문제**

#### 🔴 **핵심 문제점 발견**

**코드 위치**: [src/pages/RegistrationPage.tsx#L343-L356](src/pages/RegistrationPage.tsx#L343-L356)

```typescript
// [Fix-Step 258] Persistence & Auto-Skip Verification
useEffect(() => {
    // If user is logged in, and societyId is known
    if (auth.user && info?.societyId && !isLoading) {
        const affiliations = (auth.user as { affiliations?: Record<string, unknown> }).affiliations || {};
        const userAffiliation = affiliations[info.societyId] as { verified?: boolean } | undefined;

        // If already verified, set state AND auto-skip if on step 2
        if (userAffiliation?.verified) {
            setIsVerified(true);           // ✅ 인증 상태 설정 OK
            setShowVerificationModal(false);
        }
    }
}, [auth.user, info?.societyId, isLoading]);
```

**인증 상태 확인은 정상**: `isVerified = true`로 올바르게 설정됨

---

### 3️⃣ **가격 계산 로직의 핵심 결함**

#### 🔴 **문제 1: 마이페이지 인증 데이터가 등록 페이지로 전달되지 않음**

**코드 위치**: [src/pages/RegistrationPage.tsx#L387-L429](src/pages/RegistrationPage.tsx#L387-L429)

```typescript
// [Fix-Step 369] Auth-First Logic: Auto-select based on Verification
useEffect(() => {
    if (grades.length === 0) return;

    if (isVerified) {
        // Case A: Verified -> Auto-select matching grade
        if (memberVerificationData?.grade) {  // 🔴 문제: memberVerificationData가 비어있음!
            // 마이페이지 인증 데이터를 받지 못함
            const rawServer = String(memberVerificationData.grade).toLowerCase();
            const normalizedServer = rawServer.replace(/\s/g, '');

            const matched = grades.find(g => {
                const gCode = (g.code || '').toLowerCase().replace(/\s/g, '');
                const gName = (g.name || '').toLowerCase().replace(/\s/g, '');
                return gCode === normalizedServer || gName === normalizedServer || gName.includes(normalizedServer);
            });

            if (matched) {
                if (selectedGradeId !== matched.id) {
                    setSelectedGradeId(matched.id);
                }
            }
        }
    } else {
        // Case B: Not Verified -> Auto-select Non-Member
        if (nonMemberGrade && selectedGradeId !== nonMemberGrade.id) {
            setSelectedGradeId(nonMemberGrade.id);
        }
    }
}, [isVerified, grades, memberVerificationData, selectedGradeId]);
```

**문제점**:
- `isVerified = true`이지만 `memberVerificationData`가 `null`임
- 마이페이지에서 인증한 회원 정보(`grade` 등)가 등록 페이지로 전달되지 않음
- 결과: 등급 자동 선택 로직이 동작하지 않고 비회원 등급으로 유지됨

---

#### 🔴 **문제 2: 마이페이지 인증 데이터 로드 로직 누락**

**등록 페이지에서 마이페이지 인증 데이터를 로드하지 않음**

```typescript
// 현재 코드 흐름:
// 1. useConference() → Conference 정보 로드 ✅
// 2. useAuth() → User 정보 로드 ✅
// 3. isVerified 상태 확인 ✅
// 4. 🔴 memberVerificationData = null (로드되지 않음)
// 5. 등급 자동 선택 불가
// 6. 가격 계산 불가
```

**필요한 데이터 흐름**:
```
마이페이지 인증
↓
auth.user.affiliations[societyId] = { verified: true, grade: "치과위생사", ... }
↓
등록 페이지에서 auth.user.affiliations 조회
↓
memberVerificationData 초기화
↓
등급 매칭 및 가격 계산
```

---

### 4️⃣ **동적 등급 생성과 가격 매핑 불일치**

**코드 위치**: [src/pages/RegistrationPage.tsx#L300-L335](src/pages/RegistrationPage.tsx#L300-L335)

```typescript
// [Task 1] Dynamic Grade Generation from Active Period Prices
useEffect(() => {
    if (!activePeriod || !activePeriod.prices) return;

    console.log("🔄 [Dynamic Grades] Syncing with activePeriod.prices...", 
                 Object.keys(activePeriod.prices));
    
    const priceKeys = Object.keys(activePeriod.prices);
    
    // 가격 키로부터 등급 객체 생성
    const dynamicGrades: Grade[] = priceKeys.map(key => {
        const displayName = getNormalizedGradeName(key);
        return {
            id: key,       // 🔴 가격 키를 ID로 사용
            code: key,
            name: displayName
        };
    });

    setGrades(dynamicGrades);
}, [activePeriod, gradeMasterMap, language]);
```

**문제점**:
- `grades[].id = 가격 키` (예: "dental_hygienist")
- 마이페이지 인증 시 서버에서 반환: `grade: "Dental Hygienist"` (공백 포함)
- 정규화되지 않은 형식 비교로 인한 매칭 실패

---

### 5️⃣ **가격 조회 로직의 취약점**

**코드 위치**: [src/pages/RegistrationPage.tsx#L813-L825](src/pages/RegistrationPage.tsx#L813-L825)

```typescript
// Calculate Price
const periodName = language === 'ko' ? activePeriod.name.ko : (activePeriod.name.en || activePeriod.name.ko);
// 가격 찾기 우선순위: ID -> Code -> Name
const priceKey = selectedGradeId;
const tierPrice = activePeriod.prices[priceKey]
                ?? activePeriod.prices[selectedGrade?.code || '']
                ?? activePeriod.prices[selectedGrade?.name || ''];

// 최종 방어: 가격이 undefined인 경우에만 '확인 중' 표시 (0원 방지)
const finalDisplayPrice = tierPrice !== undefined ? tierPrice : null;

if (finalDisplayPrice === null) {
    toast.error("Price not found for this grade. Please contact support.");
    return;
}
```

**현재 흐름**:
1. `selectedGradeId = 'non_member'` (기본값)
2. `tierPrice = activePeriod.prices['non_member']` ✅
3. 비회원 가격 표시 ❌

---

## 📊 데이터 흐름도

```
마이페이지 (MyPage)
├─ 회원 인증 수행
├─ verifyMemberIdentity() 호출
├─ 응답: { grade: "Dental Hygienist", memberData: {...} }
├─ 저장: auth.user.affiliations[societyId] = { verified: true, grade: "..." }
└─ Firestore: users/{uid}.affiliations.kadd = { verified: true, ... }
        ↓
        (마이페이지 닫음, 등록 페이지 재방문)
        ↓
콘퍼런스 등록 페이지
├─ useAuth() 로드
├─ auth.user.affiliations.kadd = { verified: true, ... } ✅
├─ isVerified = true ✅
├─ 🔴 memberVerificationData = null (로드 안 됨)
├─ 등급 자동 선택 불가
├─ selectedGradeId = 'non_member' (기본값 유지)
├─ tierPrice = activePeriod.prices['non_member'] 
└─ 📍 결과: 비회원 가격 표시 ❌
```

---

## 🛠️ 구체적 수정 방안

### ✅ **해결책 1: 마이페이지 인증 데이터 초기화 (긴급)**

**파일**: [src/pages/RegistrationPage.tsx](src/pages/RegistrationPage.tsx)
**위치**: 인증 상태 확인 `useEffect` 직후

```typescript
// [Fix-New] Initialize memberVerificationData from auth.user.affiliations
useEffect(() => {
    if (auth.user && info?.societyId && isVerified && !memberVerificationData) {
        const affiliations = (auth.user as any).affiliations || {};
        const societyAffiliation = affiliations[info.societyId];
        
        if (societyAffiliation && societyAffiliation.grade) {
            // 마이페이지에서 저장된 인증 데이터로 memberVerificationData 초기화
            setMemberVerificationData({
                grade: societyAffiliation.grade,
                id: societyAffiliation.id,
                name: societyAffiliation.name,
                societyId: info.societyId,
                expiryDate: societyAffiliation.expiryDate
            });
            
            console.log("[Membership Check] Loaded affiliation data from MyPage:", societyAffiliation);
        }
    }
}, [auth.user, info?.societyId, isVerified, memberVerificationData]);
```

**효과**:
- 마이페이지 인증 데이터가 등록 페이지로 전달됨
- `memberVerificationData.grade` 활용 가능
- 등급 자동 선택 로직 정상 동작

---

### ✅ **해결책 2: 강화된 가격 조회 로직**

**파일**: [src/pages/RegistrationPage.tsx](src/pages/RegistrationPage.tsx)
**위치**: 가격 계산 섹션

```typescript
// [Enhanced] Price Lookup with Normalization
const findMatchingPrice = (gradeInfo: any, prices: Record<string, number>) => {
    if (!gradeInfo?.grade || !prices) return null;
    
    const serverGrade = String(gradeInfo.grade).trim();
    
    // 시도할 키 변형들
    const variants = [
        serverGrade.toLowerCase(),                          // "dental hygienist"
        serverGrade.toLowerCase().replace(/\s+/g, '_'),    // "dental_hygienist"
        serverGrade.replace(/\s+/g, '_').toLowerCase(),    // "dental_hygienist"
        serverGrade.toLowerCase().replace(/\s+/g, ''),     // "dentalhygienist"
    ];
    
    // 각 변형으로 가격 검색
    for (const variant of variants) {
        if (prices[variant] !== undefined) {
            console.log(`[Price Match] Found price for "${serverGrade}" using key "${variant}"`);
            return prices[variant];
        }
    }
    
    console.warn(`[Price Match] No price found for grade "${serverGrade}"`);
    return null;
};

// 가격 계산 개선
const tierPrice = findMatchingPrice(memberVerificationData, activePeriod.prices)
                ?? activePeriod.prices[selectedGrade?.code || '']
                ?? activePeriod.prices[selectedGrade?.name || ''];
```

**효과**:
- 서버의 다양한 등급명 형식 대응 가능
- "Dental Hygienist" → "dental_hygienist" 자동 매핑

---

### ✅ **해결책 3: 마이페이지 인증 데이터 저장 강화**

**파일**: [functions/src/index.ts](functions/src/index.ts)
**현재 함수**: `verifyMemberIdentity()`
**위치**: 응답 객체

```typescript
// CloudFunction 응답에 마이페이지에서 필요한 모든 정보 포함
return { 
    success: true, 
    grade: member.grade || member.category || 'Member',
    memberData: { 
        id: memberDoc.id,
        name: member.name, 
        licenseNumber: member.licenseNumber || member.code,
        grade: member.grade,              // ✅ 추가: grade 필드
        societyId: societyId,
        expiryDate: finalExpiry,
        expiry: finalExpiry
    }
};
```

---

### ✅ **해결책 4: 마이페이지에서 affiliations 업데이트 시 grade 필드 포함**

**파일**: [src/pages/UserHubPage.tsx](src/pages/UserHubPage.tsx)
**검색 위치**: 회원 인증 완료 후 affiliations 업데이트 로직

```typescript
// 회원 인증 완료 후 affiliations 업데이트 시 grade 정보 포함
if (verificationSuccess && memberData?.grade) {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
        [`affiliations.${societyId}`]: {
            verified: true,
            verifiedAt: Timestamp.now(),
            grade: memberData.grade,        // ✅ grade 필드 저장
            licenseNumber: memberData.licenseNumber,
            expiryDate: memberData.expiryDate,
            id: memberData.id
        }
    });
}
```

---

## ⚠️ 추가 검증 필요 사항

### 1️⃣ **activePeriod.prices 구조 확인**
```typescript
// KADD 2026 Spring의 실제 가격 구조 확인 필요
console.log("Actual prices structure:", activePeriod?.prices);

// 예상되는 형식:
// {
//   "member": 100000,
//   "non_member": 150000,
//   "dental_hygienist": 80000,
//   "resident": 60000
// }
```

### 2️⃣ **마이페이지의 affiliations 저장 구조**
```typescript
// users/{uid} 문서의 affiliations 필드 구조 확인
// {
//   "kadd": {
//     "verified": true,
//     "grade": "Dental Hygienist",  // 서버에서 반환받은 형식
//     "id": "member_doc_id",
//     "expiryDate": "2026-12-31"
//   }
// }
```

### 3️⃣ **societies/{societyId}/members 문서의 grade 필드**
```typescript
// 실제 저장되어 있는 grade 필드값 형식 확인
// verifyMemberIdentity()에서 반환하는 grade 값
console.log("Member grade from DB:", member.grade);
```

---

## 🎯 즉시 적용할 수 있는 패치 코드

### **최소한의 변경으로 최대의 효과**

**파일**: [src/pages/RegistrationPage.tsx](src/pages/RegistrationPage.tsx)

**추가할 useEffect** (라인 343 바로 다음):

```typescript
// [NEW] Load memberVerificationData from affiliations (마이페이지 인증 데이터)
useEffect(() => {
    if (auth.user && info?.societyId && isVerified && !memberVerificationData) {
        const affiliations = (auth.user as any).affiliations || {};
        const societyAffiliation = affiliations[info.societyId];
        
        if (societyAffiliation?.grade) {
            setMemberVerificationData({
                grade: societyAffiliation.grade,
                id: societyAffiliation.id,
                name: societyAffiliation.name,
                societyId: info.societyId,
                expiryDate: societyAffiliation.expiryDate
            });
            console.log("[Affiliation] Loaded from MyPage for", info.societyId, societyAffiliation);
        }
    }
}, [auth.user, info?.societyId, isVerified, memberVerificationData]);
```

**수정할 가격 조회 로직** (라인 813-825 수정):

```typescript
// 강화된 가격 조회 함수
const findMatchingPrice = (gradeInfo: any, prices: Record<string, number>): number | null => {
    if (!gradeInfo?.grade || !prices) return null;
    
    const serverGrade = String(gradeInfo.grade).trim().toLowerCase();
    const variants = [
        serverGrade,
        serverGrade.replace(/\s+/g, '_'),
        serverGrade.replace(/\s+/g, ''),
    ];
    
    for (const variant of variants) {
        if (prices[variant] !== undefined) return prices[variant];
    }
    return null;
};

const priceKey = selectedGradeId;
const tierPrice = findMatchingPrice(memberVerificationData, activePeriod?.prices || {})
                ?? activePeriod?.prices[priceKey]
                ?? activePeriod?.prices[selectedGrade?.code || '']
                ?? activePeriod?.prices[selectedGrade?.name || ''];
```

---

## 📈 예상 효과

✅ **패치 적용 후**:
1. 마이페이지에서 인증한 회원이 등록 페이지에 재방문
2. `isVerified = true` 확인
3. `memberVerificationData` 자동 로드
4. 등급 자동 선택 (예: "dental_hygienist")
5. 가격 정규화 매칭 성공
6. **회원 할인 가격 정상 표시** ✅

---

## 📌 핵심 요약

| 항목 | 상태 | 설명 |
|------|------|------|
| **인증 상태 저장** | ✅ | 마이페이지에서 affiliations에 저장됨 |
| **인증 상태 조회** | ✅ | 등록 페이지에서 isVerified 정상 확인 |
| **인증 데이터 전달** | 🔴 | memberVerificationData 로드 안 됨 (문제) |
| **등급 매칭** | 🔴 | memberVerificationData 없어서 불가 |
| **가격 계산** | 🔴 | 등급 매칭 실패로 비회원 가격만 적용 |

**근본 원인**: 마이페이지의 인증 정보(`affiliations[societyId]`)를 등록 페이지에서 `memberVerificationData`로 초기화하지 않음.

**해결**: 마이페이지 인증 데이터를 자동으로 로드하는 `useEffect` 추가 + 가격 조회 로직 강화

---

## 📝 다음 단계

1. **코드 리뷰 및 검증**
   - `activePeriod.prices` 실제 구조 확인
   - `auth.user.affiliations` 실제 데이터 확인

2. **패치 적용**
   - 마이페이지 인증 데이터 초기화 useEffect 추가
   - 가격 조회 로직 개선

3. **테스트**
   - KADD 회원이 마이페이지에서 인증 후 등록 페이지 방문
   - 할인 가격이 정상 표시되는지 확인

4. **배포**
   - 패치 적용 후 prod 환경에 배포

