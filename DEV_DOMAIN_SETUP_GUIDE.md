# Dev 환경 도메인/경로 구성 가이드

## 목표
기존 라이브와 동일한 도메인/경로 구조로 개발 환경 구성

---

## 🌐 기존 라이브 구조

### 도메인 기반 라우팅
```
eregi.co.kr (메인)
├── admin.eregi.co.kr          → 슈퍼관리자
├── {society}.eregi.co.kr    → 학회별 사이트
└── eregi.co.kr               → 일반 사용자
```

### 개발 환경도 동일 구조로
```
dev.eregi.co.kr (개발 메인)
├── admin.dev.eregi.co.kr      → 슈퍼관리자
├── {society}.dev.eregi.co.kr → 학회별 사이트
└── dev.eregi.co.kr           → 일반 사용자
```

---

## 🎯 두 가지 구성 방법

### 방법 A: Firebase Hosting Custom Domains (권장)
실제 도메인을 연결하여 운영과 동일한 구조

### 방법 B: 서브도메인 자동 생성
Firebase Hosting이 자동으로 서브도메인 생성

---

## 📋 방법 A: Custom Domains (권장)

### 1. 도메인 구매/설정
```
필요한 도메인들:
- dev.eregi.co.kr (개발 메인)
- admin.dev.eregi.co.kr
- *.dev.eregi.co.kr (와일드카드, 학회 서브도메인)
```

### 2. Firebase Console 설정

#### 2.1 eregi-dev 프로젝트 접속
```
https://console.firebase.google.com/
→ eregi-dev 프로젝트
```

#### 2.2 Hosting 설정
1. **Build** → **Hosting**
2. **Custom domains** 클릭
3. **Add custom domain**
4. 도메인 입력:
   - `dev.eregi.co.kr`
   - `admin.dev.eregi.co.kr`
   - `*.dev.eregi.co.kr` (와일드카드)

### 3. DNS 설정
도메인 공급자(Google Domains, 등)에서:
```
Type: CNAME
Name: dev.eregi.co.kr
Value: eregi-dev.web.app
```

---

## 📋 방법 B: Firebase 자동 서브도메인 (간단)

Firebase Hosting은 자동으로 서브도메인 생성:

```
기본: eregi-dev.web.app
자동 생성:
- admin.eregi-dev.web.app
- any-name.eregi-dev.web.app
```

### 와일드카드 서브도메인
```
*.{project-id}.web.app
→ *.eregi-dev.web.app

예:
- admin.eregi-dev.web.app
- test-society.eregi-dev.web.app
- kap.eregi-dev.web.app
```

---

## 🎯 라우팅 로직 (이미 구현됨)

App.tsx에서 이미 hostname 기반 라우팅 구현:

```typescript
const hostname = window.location.hostname;

// 슈퍼관리자
if (hostname.includes('admin.eregi')) {
  return <SuperAdminPage />
}

// 학회 사이트
const subdomain = hostname.split('.')[0];
if (['kap', 'kadd', ...].includes(subdomain)) {
  return <SocietyLayout societyId={subdomain} />
}
```

---

## ✅ 추천 구성

### 간단한 방법 (권장)
Firebase 자동 서브도메인 활용:
```
Dev 환경:
- 메인: eregi-dev.web.app
- 어드민: admin.eregi-dev.web.app
- 학회: {society}.eregi-dev.web.app
```

### 완전한 방법
Custom Domains 구매:
```
Dev 환경:
- 메인: dev.eregi.co.kr
- 어드민: admin.dev.eregi.co.kr
- 학회: {society}.dev.eregi.co.kr
```

---

## 🔍 기존 라우팅 확인

App.tsx에서 이미 구현된 라우팅:

1. **admin.eregi.co.kr** → 슈퍼관리자
2. **{society}.eregi.co.kr** → 학회 사이트
3. **eregi.co.kr** → 메인 사이트

개발 환경에서도 동일하게:
1. **admin.dev.eregi.co.kr** 또는 **admin.eregi-dev.web.app** → 슈퍼관리자
2. **{society}.dev.eregi.co.kr** 또는 **{society}.eregi-dev.web.app** → 학회 사이트
3. **dev.eregi.co.kr** 또는 **eregi-dev.web.app** → 메인 사이트

---

## 🚀 다음 단계

어떤 방식으로 진행하고 싶으신가요?

1. **간단한 방법**: Firebase 자동 서브도메인 사용
   - 도메인 구매 불필요
   - 즉시 사용 가능
   - `*.eregi-dev.web.app` 형태

2. **완전한 방법**: Custom Domains 구매
   - dev.eregi.co.kr 도메인 구매
   - Firebase에 연결
   - 운영과 동일한 구조

어떤 방식이 좋으신가요?
