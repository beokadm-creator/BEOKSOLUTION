# 회원 인증 시스템 분석

## 전반적인 분석

초록 제출 페이지(https://kadd.eregi.co.kr/kadd_2026spring/abstracts?lang=ko)에서 사용하는 회원 인증 디자인은 **보안과 사용자 경험(UX)의 균형을 맞추어 잘 설계**되어 있습니다.

---

## 핵심 발견사항

### 1. 인증 방식 및 디자인

**디자인 접근 방식: "통합감지" (Consistent Detection)**
- 회원/비회원 모두에게 동일한 UX 제공
- 로그인 유도와 인증 접근 경로 구분
- 비회원 인증이 회원과 유사한 UI로 쉽게 진행

---

## 2. 인증 요구 조건 및 제약

### A. 등록 완료 필수 조건
```typescript
if (isRegistered === false) {
  // 접근 차단 + 등록 안내 UI 표시
  return <RegistrationRequiredAlert />
}
```

**조건**:
- 회원: `users/{uid}` 문서 존재 + `conferences/{confId}/registrations`에 PAID 상태
- 비회원: `conferences/{confId}/registrations` 문서에 PAID 상태

**메시지**:
- 회원: "초록을 제출하려면 로그인이 필요합니다."
- 비회원: "초록을 제출하려면 회원가입이 필요합니다."

---

### B. 회원 인증 로직 (verifyMemberIdentity)

**인증 방식**: 이름 + (면허번호 OR 회원코드) 이중 검증

```typescript
// 1차: 면허번호로 검색
q = where('name', '==', name)
   .where('licenseNumber', '==', code)

// 2차: 회원코드로 검색 (면허번호 실패 시)
q = where('name', '==', name)
   .where('code', '==', code)
```

**보안 제약**:
1. **만료 체크**: `member.expiryDate` 확인
2. **이중 사용 방지**: `used === true` + `usedBy !== currentUid`
3. **즉시 락킹**: `lockNow === true` 시 `used: true`로 즉시 락킹
4. **반복 인증 허용**: `usedBy === currentUid` 시 재인증 허용

---

## 3. 회원 인증 규칙 (요청사항 분석)

### ✅ 현재 구현된 규칙

| 규칙 | 설명 | 구현 상태 |
|------|------|----------|
| **이름 검증** | 정확한 이름 일치 | ✅ 구현됨 |
| **면허번호/코드 검증** | 두 필드 중 하나 일치 | ✅ 구현됨 |
| **만료 기한 체크** | `member.expiryDate` 확인 | ✅ 구현됨 |
| **사용 여부 확인** | `used === true` 체크 | ✅ 구현됨 |
| **소유자 확인** | `usedBy` 체크 | ✅ 구현됨 |
| **반복 인증 허용** | 동일 사용자 재인증 허용 | ✅ 구현됨 |
| **즉시 락킹** | `lockNow` 시 즉시 락킹 | ✅ 구현됨 |
| **비회원 경로 지원** | 비회원도 초록 제출 가능 | ✅ 구현됨 |

---

## 4. 데이터 플로우

### 회원 인증 플로우
```
1. 사용자가 이름 + (면허번호 OR 회원코드) 입력
2. verifyMemberIdentity 호출
3. Firestore: societies/{societyId}/members 조회
4. 인증 성공:
   - 멤버 등급 정보 반환
   - priceKey 정규화
   - 사용자 계정 업데이트 (tier, affiliation, organization)
   - UI: "인증 완료" 토스트 + 등록 페이지로 리다이렉트
5. 인증 실패:
   - "회원을 찾을 수 없습니다."
   - 재시도 안내
```

### 비회원 경로 (Non-Member Flow)
```
1. 회원가입 → 결제 완료
2. 등록 생성: `conferences/{confId}/registrations/{regId}`
3. 등록 시 session 저장: `NON_MEMBER`
4. Abstract Submission 접속 시:
   - `useNonMemberAuth` 훅으로 자동 인증
   - `nonMember.registrationId`로 접근 권한 획득
   - "Non-Member Mode" 표시
```

---

## 5. 보안 고려사항

### ✅ 잘 구현된 보안 기능

1. **데이터 유출 방지**: `verifyMemberIdentity`는 인증된 회원 정보만 반환
2. **타인쿠 경쟁 방지**: `used` 플래그로 한 번만 사용
3. **만료 자동 처리**: `expiryDate` 체크
4. **소유권 확인**: `usedBy`로 소유자 확인
5. **즉시 락킹**: 관리자 기능 (`lockNow`) 지원
6. **CORS/Network 로버스트**: 재시도 로직 및 타임아웃
7. **세션 관리**: 비회원 세션 자동 정리

---

## 6. 개선 제안사항 (선택사항)

### A. 디자인 개선
- **상태 표시 개선**: "인증 중 → 인증 완료 → 리다이렉트 중" 진행 상태 표시
- **에러 메시지 구체화**: "이름이 일치하지 않습니다" 등 구체적 안내
- **입력 필드 힌트**: 회원 켚가를 입력했는지 명시

### B. 기능 개선
- **인증 재발송**: 만료된 코드로 재인증 시도 시 자동 알림
- **인증 이력**: 최근 인증 기록 표시
- **휴대폰 인증 추가**: 회원코드 + 휴대폰 2단 인증

---

## 7. 사용자 경험(UX) 설계 평가

### ✅ 잘 설계된 부분

1. **명확성**: 회원/비회원 구분 명확
2. **단순성**: "이름 + 코드" 단순한 인증 방식
3. **피드백**: 즉시 토스트/모달로 결과 피드백
4. **에러 처리**: 실패 시 명확한 에러 메시지
5. **접근성**: 비회원도 쉽게 접근 가능

### 개선 제안
- **진행 상태 표시**: 인증 진행 중 로딩 스피너
- **오류 복구**: 입력 실수 시 재시도 버튼
- **안내 가이드**: 인증 방법에 대한 상세 안내 모달

---

## 8. 데이터 스키마 검증

### Firestore 컬렉션 구조
```
societies/
  └─ {societyId}/
      └─ members/
           └─ {memberId}
                ├─ name: string
                ├─ licenseNumber: string (면허번호)
                ├─ code: string (회원코드)
                ├─ grade: string (등급: Specialist/Resident)
                ├─ expiryDate: Timestamp
                ├─ used: boolean
                ├─ usedBy: string (UID)
                └─ organization: string

users/
  └─ {uid}/
       ├─ name: string
       ├─ email: string
       ├─ phone: string (매핑됨)
       ├─ organization: string (매핑됨)
       ├─ tier: string (매핑됨)
       └─ authStatus: { emailVerified, phoneVerified }

conferences/
  └─ {confId}/
       └─ registrations/
            └─ {regId}
                 ├─ userId: string
                 ├─ userInfo: { name, email, phone, affiliation, licenseNumber }
                 ├─ tier: string
                 └─ status: 'PAID' | 'PENDING' | ...
```

---

## 9. 결론 및 권장사항

### ✅ 현재 시스템 평가
- **보안**: 충분히 구현되어 있음
- **기능**: 회원/비회원 모두 지원
- **UX**: 명확하고 단순함
- **유지보수**: 데이터 구조가 명확하여 유지보수 용이

### 📋 추가 고려사항 (요청사항 대응)

1. **디자인 일관성**:
   - 등록 완료 페이지와 동일한 디자인 언어 적용
   - 통일감지 패턴 유지

2. **기능 개선** (요청사항에 따름):
   - "전반적인 분위기에 맞춰 디자인을 개편해주세요"
   - "디자인이 너무 차가나 간단하지 않게 해주세요"
   - "이미지와 색상을 활용해주세요"

3. **회원 인증**:
   - "회원 인증의 디자인을 이해하기 쉽게 해주세요"
   - "입력 필드의 명확한 라벨링이 필요합니다"
   - "인증 완료 시 다음 단계가 명확해야 합니다"

---

## 10. 요청사항 정리

### 원하시는 것
> "전반적인 분위기에 맞춰 디자인을 개편해주세요"
> "기능과 관련된 내용은 절대 변경하지 말고 디자인만 잡아주세요"

### 이해
- **현재 기능 유지**: 회원 인증 로직, 조건, 보안 모두 유지
- **디자인만 개선**: UI/UX 디자인만 수정 요청
- **디자인 방향**: 학술대회 분위기에 맞는 전문적이고 세련된 디자인

---

## 11. 추천 작업 (선택사항)

### A. 디자인 개선 작업
1. **회원 인증 폼 디자인 개선**
   - 더 세련된 레이아웃
   - 아이콘/일러스트 추가
   - 입력 필드 명확한 라벨링

2. **등록 완료 UI 개선**
   - 회원/비회원 분화를 명확하게 표시
   - 더 부드러운 전환 UI

### B. UI 라이브러리 업데이트
- 색상 테마 적용 (학술대회 분위기)
- 아이콘/이모지 라이브러리 통합
- 타이포그래피 통합

### C. 응답성/접근성 개선
- 로딩 상태 개선
- 오러 메시지 개선
- 모바일 대응 개선

---

## 정리

현재 **회원 인증 시스템은 기능적으로 완벽하게 구현**되어 있습니다.

**보안**: ✅ 충분
**기능**: ✅ 완벽
**데이터 구조**: ✅ 명확

요청하신 **"디자인 개편"**은 기능을 변경하지 않고 UI/UX 디자인만 개선하면 됩니다.
