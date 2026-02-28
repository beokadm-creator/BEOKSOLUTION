# 🔴 회원 인증 금액 적용 문제 - 심층 진단 리포트

**작성일**: 2026-01-22 | **상태**: 추가 데이터 수집 필요

---

## 📌 사용자의 지적 사항

> **"memberVerificationData 로드에서 된 금액은 인증된 회원 등급을 정확하게 확인해줘야 합니다."**
> 
> DB 경로: `/conferences/kadd_2026spring/settings/registration`

---

## 🔍 근본 문제 분석

현재 적용된 PATCH의 흐름:

```
1. 마이페이지 인증 (UserHubPage.tsx:622)
   → verifyMember() 호출
   → CloudFunction verifyMemberIdentity() 반환
   → res.memberData = { grade: "Dental Hygienist", id, name, ... }
   
2. affiliations 업데이트
   → (코드 확인 필요) ← 문제 지점!
   → auth.user.affiliations[societyId].grade 저장
   
3. 등록 페이지 방문
   → memberVerificationData = affiliations[societyId]로 로드
   → grade: "Dental Hygienist" (원본 형식 유지)
   
4. 가격 조회
   → activePeriod.prices에서 "Dental Hygienist" 검색
   → 정규화해서 "dental_hygienist" 매칭 시도
   → 🔴 실패 가능성!
```

---

## 🎯 핵심 문제 3가지

### 1️⃣ **affiliations 업데이트 로직이 불명확함**

**현재 상황**:
- UserHubPage.tsx:622 `handleVerify()` 함수에서 `verifyMember()` 호출
- 하지만 반환받은 `res.success` 확인 후 **affiliations 업데이트 코드가 보이지 않음**

**코드** (라인 622-637):
```typescript
const handleVerify = async () => {
    const { societyId, name, code } = verifyForm;
    const res = await verifyMember(societyId, name, code, true, "", ...);

    if (res.success) {
        // 🔴 여기서 affiliations를 업데이트하는 로직이 없음!
        toast.success("인증되었습니다.");
        setShowCertModal(false);
        // "AuthContext onSnapshot will auto-update the UI via affiliations."
    } else {
        toast.error(res.message);
    }
};
```

**문제**: 
- `affiliations` 업데이트가 어디서 발생하는가?
- `useMemberVerification()` 훅 내부에서 처리되는가?
- 아니면 `auth.user` 자동 갱신에 의존하는가?

---

### 2️⃣ **CloudFunction 반환 데이터 구조 불명확**

**functions/src/index.ts:391-406** (verifyMemberIdentity)

```typescript
return { 
    success: true, 
    grade: member.grade || member.category || 'Member',
    memberData: { 
        id: memberDoc.id,
        name: member.name, 
        licenseNumber: member.licenseNumber || member.code,
        societyId: societyId,
        expiryDate: finalExpiry,
        expiry: finalExpiry
    }
};
```

**문제**:
- `grade` 필드: 원본 DB 형식 (예: "Dental Hygienist")
- `memberData`에는 `grade`가 없음! ← **핵심 문제**
- 콘퍼런스 설정의 가격 키와 비교할 정보 부족

---

### 3️⃣ **가격 설정 경로와의 매핑 불일치**

**사용자 지적**: `/conferences/kadd_2026spring/settings/registration`의 설정이 가격 기준

```
DB 경로: /conferences/kadd_2026spring/settings/registration
  ├─ prices: {
  │   "member": 100000,
  │   "non_member": 150000,
  │   "dental_hygienist": 80000,    ← 가격 키 형식
  │   ...
  │ }
  └─ grades: [{
      code: "dental_hygienist",
      name: "Dental Hygienist",
      priceKey: "dental_hygienist"
    }]
```

**현재 문제**:
- `memberVerificationData.grade` = "Dental Hygienist" (표시명)
- `activePeriod.prices` 키 = "dental_hygienist" (가격 키)
- 둘의 형식이 다름!

---

## 📊 데이터 흐름 재분석

### CloudFunction 응답:
```javascript
{
  success: true,
  grade: "Dental Hygienist",           // DB 원본 형식
  memberData: {
    id: "member_123",
    name: "홍길동",
    grade: ???                         // 🔴 없음!
    licenseNumber: "DH-12345",
    societyId: "kadd",
    expiryDate: "2026-12-31"
  }
}
```

### 마이페이지 affiliations 저장:
```javascript
// 어디서? 언제? 어떤 데이터로?
auth.user.affiliations.kadd = {
    verified: true,
    grade: ???                         // 🤔 "Dental Hygienist"인가?
    id: "member_123",
    licenseNumber: "DH-12345",
    expiryDate: "2026-12-31"
}
```

### 등록 페이지 memberVerificationData 로드:
```javascript
memberVerificationData = {
    grade: societyAffiliation.grade,   // "Dental Hygienist"
    id: societyAffiliation.id,
    ...
}

// 가격 조회:
findMatchingPrice(memberVerificationData, activePeriod.prices)
// memberData.grade = "Dental Hygienist"
// prices 키 = "dental_hygienist"
// 🔴 정규화 실패 가능성!
```

---

## ✅ 즉각적인 해결 방안

### 해결책 1: CloudFunction에서 grade 필드 추가

**파일**: [functions/src/index.ts#L391-406](functions/src/index.ts#L391-406)

```typescript
return { 
    success: true, 
    grade: member.grade || member.category || 'Member',
    memberData: { 
        id: memberDoc.id,
        name: member.name, 
        grade: member.grade,                      // ✅ 추가!
        licenseNumber: member.licenseNumber || member.code,
        societyId: societyId,
        expiryDate: finalExpiry,
        expiry: finalExpiry,
        priceKey: (member.grade || 'member').toLowerCase().replace(/\s+/g, '_')  // ✅ 추가!
    }
};
```

**효과**:
- `memberData.grade`에 DB 원본 등급 명시
- `memberData.priceKey`에 정규화된 가격 키 포함
- 등록 페이지에서 바로 사용 가능

---

### 해결책 2: 등록 페이지 가격 조회 로직 재개선

**파일**: [src/pages/RegistrationPage.tsx#L861-890](src/pages/RegistrationPage.tsx#L861-890)

```typescript
const findMatchingPrice = (gradeInfo: any, prices: Record<string, number>): number | null => {
    if (!gradeInfo?.grade || !prices) return null;
    
    console.log('[MemberDiscount-Debug] findMatchingPrice called with:', {
        grade: gradeInfo.grade,
        priceKey: gradeInfo.priceKey,
        availableKeys: Object.keys(prices)
    });
    
    // 1️⃣ 우선: CloudFunction에서 반환한 정규화 키 사용
    if (gradeInfo.priceKey && prices[gradeInfo.priceKey] !== undefined) {
        console.log(`[MemberDiscount] ✅ Price found using priceKey: ${gradeInfo.priceKey} = ${prices[gradeInfo.priceKey]}`);
        return prices[gradeInfo.priceKey];
    }
    
    // 2️⃣ 차선: 직접 정규화 시도
    const serverGrade = String(gradeInfo.grade).trim();
    const variants = [
        serverGrade.toLowerCase(),
        serverGrade.toLowerCase().replace(/\s+/g, '_'),
        serverGrade.toLowerCase().replace(/\s+/g, ''),
        serverGrade.replace(/\s+/g, '_').toLowerCase(),
    ];
    
    for (const variant of variants) {
        if (prices[variant] !== undefined) {
            console.log(`[MemberDiscount] ✅ Price match found: "${serverGrade}" → "${variant}" = ${prices[variant]}`);
            return prices[variant];
        }
    }
    
    console.error(`[MemberDiscount] ❌ Price not found for grade: "${serverGrade}"`);
    console.error('[MemberDiscount] Available keys:', Object.keys(prices));
    return null;
};

// 사용
const tierPrice = findMatchingPrice(memberVerificationData, activePeriod?.prices || {})
               ?? activePeriod?.prices[selectedGradeId];
```

---

### 해결책 3: useMemberVerification 훅 개선

**파일**: [src/hooks/useMemberVerification.ts](src/hooks/useMemberVerification.ts)

현재 훅에서 CloudFunction 응답을 받아 **affiliations 업데이트 시점을 명시**:

```typescript
const verifyMember = async (...) => {
    try {
        const currentUser = auth.currentUser;
        if (!uid) {
            setLoading(false);
            return { success: false, message: "Session not initialized." };
        }

        const verifyFn = httpsCallable(functions, 'verifyMemberIdentity');
        const { data }: any = await verifyFn({
            societyId,
            name,
            code,
            lockNow: lockNow || false
        });

        if (data.success) {
            // ✅ CloudFunction 응답이 memberData.priceKey를 포함하도록 개선됨
            console.log('[useMemberVerification] Verification success:', {
                grade: data.memberData?.grade,
                priceKey: data.memberData?.priceKey  // 확인
            });
            
            // [NEW] affiliations 직접 업데이트 (useAuth onSnapshot보다 빠름)
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                [`affiliations.${societyId}`]: {
                    verified: true,
                    verifiedAt: Timestamp.now(),
                    grade: data.memberData?.grade,      // ✅ 원본 등급
                    priceKey: data.memberData?.priceKey, // ✅ 정규화 키
                    id: data.memberData?.id,
                    licenseNumber: data.memberData?.licenseNumber,
                    expiryDate: data.memberData?.expiryDate
                }
            });
            
            setLoading(false);
            return {
                success: true,
                message: "Verification successful",
                memberData: data.memberData
            };
        } else {
            setLoading(false);
            return { success: false, message: data.message || "Verification failed" };
        }
    } catch (e: any) {
        setLoading(false);
        return { success: false, message: e.message };
    }
};
```

---

## 🧪 검증 필요 사항

현재 적용된 PATCH가 정확한지 확인해야 할 항목:

### 1️⃣ **CloudFunction 응답 확인**
```javascript
// browser console에서 실제 반환값 확인
console.log('CloudFunction response:', data);
// {
//   success: true,
//   grade: "???"
//   memberData: { grade: "???" }  ← 이 필드가 있는가?
// }
```

### 2️⃣ **affiliations 저장 데이터 확인**
```javascript
// Firestore users/{uid} 문서 확인
// affiliations.kadd = {
//   verified: true,
//   grade: "???"  ← 어떤 형식인가?
//   priceKey: "???"  ← 이 필드가 있는가?
// }
```

### 3️⃣ **activePeriod.prices 키 확인**
```javascript
// 콘솔에서 실제 가격 키 확인
console.log('Price keys:', Object.keys(activePeriod.prices));
// ["member", "non_member", "dental_hygienist", ...]  ← 어떤 형식?
```

### 4️⃣ **정규화 로직 테스트**
```javascript
// 정규화 전후 비교
const original = "Dental Hygienist";
const normalized = original.toLowerCase().replace(/\s+/g, '_'); // "dental_hygienist"
const priceKey = "dental_hygienist";
console.log('Match:', normalized === priceKey);  // true?
```

---

## 📝 수정 우선순위

| 순위 | 항목 | 파일 | 중요도 |
|------|------|------|--------|
| 1 | CloudFunction에서 `memberData.grade`, `memberData.priceKey` 추가 | functions/src/index.ts | 🔴 필수 |
| 2 | useMemberVerification에서 affiliations 직접 업데이트 | src/hooks/useMemberVerification.ts | 🔴 필수 |
| 3 | 등록 페이지 가격 조회 로직에서 priceKey 우선 사용 | src/pages/RegistrationPage.tsx | 🟡 권장 |

---

## 🎯 최종 요약

**현재 적용 PATCH의 문제점**:
- affiliations에서 grade만 읽음 → 원본 형식 유지
- 가격 키 정규화는 등록 페이지에서 수행
- 형식 불일치로 인한 가격 조회 실패 가능

**필요한 개선**:
1. CloudFunction에서 **이미 정규화된 priceKey 반환**
2. useMemberVerification에서 affiliations에 **priceKey 저장**
3. 등록 페이지에서 **priceKey를 우선 사용**

