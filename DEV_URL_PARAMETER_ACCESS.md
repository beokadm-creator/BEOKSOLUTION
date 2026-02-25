# 개발 환경 접속 방법 (URL 파라미터)

## 🎯 개발 환경에서는 도메인 대신 URL 파라미터 사용

### 기본 URL (공통)
```
https://eregi-dev.web.app
```

---

## 📋 각 역할별 접속 방법

### 1. 슈퍼관리자 대시보드
```
https://eregi-dev.web.app?admin=true
```
- `?admin=true` 파라미터로 슈퍼관리자 모드
- 관리자 로그인 페이지로 이동

### 2. 학회 사이트
```
https://eregi이름.web.app?society=kap
```
- `?society=kap` 파라미터로 KAP 학회
- 해당 학회 사이트로 이동

### 3. 일반 사용자
```
https://eregi-dev.web.app
```
- 파라미터 없음
- 메인 페이지

---

## 🔍 이미 구현된 코드 (App.tsx)

```typescript
// URL 파라미터로 관리자 모드
const params = new URLSearchParams(window.location.search);
const isAdminMode = params.get('admin') === 'true';

// URL 파라미터로 학회 선택
const societyParam = params.get('society');
```

이미 구현되어 있습니다! ✅

---

## 🚀 개발 환경 접속 예시

### 슈퍼관리자
```
https://eregi-dev.web.app?admin=true
→ SuperAdminPage 렌더링
```

### 학회 관리자 (KAP)
```
https://eregi-dev.web.app?society=kap
→ SocietyDashboardPage 렌더링
```

### 학회 관리자 (KADD)
```
https://eregi-dev.web.app?society=kadd
→ SocietyDashboardPage 렌러링
```

### 일반 사용자
```
https://eregi-dev.web.app
→ 메인 페이지
```

---

## ✅ 장점

### 1. 도메인 불필요
- 별도 도메인 구매 필요 없음
- DNS 설정 불필요
- Firebase 와일드카드 제약 없음

### 2. 유연한 환경 구분
- `?admin=true` - 슈퍼관리자
- `?society=kap` - KAP 학회
- `?society=kadd` - KADD 학회
- 무제한 조합 가능

### 3. 테스트 용이
- 학회 추가 시 별도의 도메인 필요 없음
- URL 파라미터만 변경하면 됨
- 즉시 테스트 가능

---

## 🎯 운영 환경과의 차이

### 운영 (Live)
```
도메인 기반 라우팅:
- admin.eregi.co.kr → 슈퍼관리자
- kap.eregi.co.kr → KAP 학회
- kadd.eregi.co.kr → KADD 학회
```

### 개발 (Dev)
```
URL 파라미터 기반 라우팅:
- eregi-dev.web.app?admin=true → 슈퍼관리자
- eregi-dev.web.app?society=kap → KAP 학회
- eregi-dev.web.app?society=kadd → KADD 학회
```

---

## 💡 개발 시나리오

### 1. KAP 학회 테스트
```
1. https://eregi-dev.web.app?society=kap 접속
2. KAP 학회 사이트 진입
3. 기능 테스트
```

### 2. 슈퍼관리자 테스트
```
1. https://eregi-dev.web.app?admin=true 접속
2. 관리자 로그인
3. 대시보드 테스트
```

### 3. 일반 사용자 테스트
```
1. https://eregi-dev.web.app 접속
2. 메인 페이지 진입
3. 회원가입 테스트
```

---

## 🔥 추천 방식

**개발 환경**: URL 파라미터 방식
- 간단하고 빠름
- 무제한 환경 구분
- 즉시 테스트 가능

**운영 환경**: 도메인 기반 방식 (기존)
- 전문적인 URL
- 사용자에게 친숙
- SEO 최적화

---

**결론: 개발에서는 URL 파라미터가 훨씬 효율적입니다!** 🎯

바로 테스트해보세요:
```
https://eregi-dev.web.app?admin=true
https://eregi-dev.web.app?society=kap
```
