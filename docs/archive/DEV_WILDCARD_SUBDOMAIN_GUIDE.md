# Firebase 와일드카드 서브도메인 설정 가이드

## 목표
`*.eregi-dev.web.app` 와일드카드 서브도메인 설정으로 무제한 서브도메인 지원

---

## 🎯 Firebase Console 설정

### 1. Firebase Console 접속
```
https://console.firebase.google.com/
→ eregi-dev 프로젝트
```

### 2. Hosting 설정
1. 좌측 **Build** → **Hosting**
2. **Custom domains** 섹션 (또는 사용자 지정 도메인)
3. **Add custom domain** 클릭

### 3. 와일드카드 도메인 입력
```
도메인: *.eregi-dev.web.app
```

#### 중요: 별도의 DNS 설정 없이 자동으로 작동!

**설정 과정:**
1. 도메인 입력: `*.eregi-dev.web.app`
2. **Continue** 클릭
3. Firebase가 자동으로 인증하고 설정 완료
4. **Activate** 클릭하여 활성화

---

## ✅ 완료 후 자동 생성되는 서브도메인

Firebase가 자동으로 모든 서브도메인을 허용합니다:

```
자동 생성됨:
eregi-dev.web.app (기본)
admin.eregi-dev.web.app
kap.eregi-dev.web.app
kadd.eregi-dev.web.app
test-society.eregi-dev.web.app
any-name.eregi-dev.web.app
무엇이든 전부 허용! ✅
```

---

## 🎯 사용 예시

### 슈퍼관리자
```
URL: https://admin.eregi-dev.web.app
동작: 기존 라우팅 그대로
→ hostname.includes('admin.eregi') 체크
→ 슈퍼관리자 페이지 렌더링
```

### 학회 사이트
```
URL: https://kap.eregi-dev.web.app
동작: 기존 라우팅 그대로
→ hostname.split('.')[0] == 'kap' 체크
→ KAP 학회 사이트 렌더링
```

### 테스트 사이트
```
URL: https://test.eregi-dev.web.app
동작: 기존 라우팅 그대로
→ 커스텀 서브도메인 처리
```

---

## 🔍 검증 방법

### 1. Firebase Console 확인
```
Build → Hosting → Custom domains
→ *.eregi-dev.web.app 보이면 성공 ✅
```

### 2. 실제 접속 테스트
```bash
# 다양한 서브도메인으로 접속 테스트
https://admin.eregi-dev.web.app
https://kap.eregi-dev.web.app
https://test.eregi-dev.web.app
https://anything.eregi-dev.web.app
```

### 3. 라우팅 확인
```
각 서브도메인에서:
- 어드민 페이지 진입 가능?
- 학회 사이트 진입 가능?
- 메인 페이지 정상 작동?
```

---

## ⚡ 장점

### 1. 무제한 서브도메인
- 학회마다 자동 생성
- 테스트 환경 자유롭게
- DNS 설정 불필요

### 2. 기존 코드 그대로 사용
```typescript
// 이미 구현된 라우팅 로직
const hostname = window.location.hostname;
const subdomain = hostname.split('.')[0];

// 그대로 작동!
if (hostname.includes('admin.eregi')) { /* 슈퍼관리자 */ }
if (['kap', 'kadd'].includes(subdomain)) { /* 학회 사이트 */ }
```

### 3. 빠른 설정
- 도메인 구매 불필요
- DNS 레코드 변경 불필요
- SSL 자동 발급

---

## 📋 설정 완료 체크리스트

- [ ] Firebase Console 접속
- [ ] eregi-dev 프로젝트 선택
- [ ] Build → Hosting → Custom domains
- [ ] Add custom domain 클릭
- [ ] `*.eregi-dev.web.app` 입력
- [ ] Continue 클릭
- [ ] Activate 클릭
- [ ] 완료 메시지 확인

---

## 🚀 설정 완료 후

### 생성된 URL들
```
https://eregi-dev.web.app (기본)
https://admin.eregi-dev.web.app (슈퍼관리자)
https://kap.eregi-dev.web.app (KAP 학회)
https://kadd.eregi-dev.web.app (KADD 학회)
https://test.eregi-dev.web.app (테스트)
```

### 접속 테스트
```
1. admin.eregi-dev.web.app 접속
   → 슈퍼관리자 대시보드 접근

2. kap.eregi-dev.web.app 접속
   → KAP 학회 사이트 접근

3. eregi-dev.web.app 접속
   → 메인 페이지 접근
```

---

## 💡 참고

### 와일드카드 형식
```
*.eregi-dev.web.app
```

- `*`: 모든 서브도메인 허용
- `eregi-dev`: 프로젝트 ID
- `.web.app`: Firebase Hosting 도메인

### 기존 라이브와의 비교
```
Live: admin.eregi.co.kr (Custom Domain)
Dev:  admin.eregi-dev.web.app (WildCard Subdomain)
```

---

Firebase Console에서 설정 완료 후 알려주세요! 🚀

설정이 완료되면 모든 서브도메인이 자동으로 작동합니다.
