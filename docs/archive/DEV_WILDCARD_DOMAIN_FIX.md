---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 503
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

# Firebase 와일드카드 서브도메인 설정 상세 가이드

## 🔍 문제 상황
Firebase Console에서 직접 `*.domain.com` 형식으로 추가할 수 없습니다.
Firebase CLI를 사용해야 합니다.

---

## ✅ 해결 방법: Firebase CLI 사용

### 1. Firebase CLI 설치 확인
```bash
npm install -g firebase-tools
```

### 2. Firebase 로그인
```bash
firebase login
```

### 3. eregi-dev 프로젝트 사용
```bash
firebase use eregi-dev
```

### 4. 와일드카드 도메인 추가
```bash
firebase hosting:flexible:channels:create
```

명령어를 입력하면 다음과 같이 프롬프트가 뜹니다:
```
? What domain do you want to configure?
```

여기에 다음을 입력:
```
*.eregi-dev.web.app
```

---

## 🎯 완전한 설정 과정

### 단계 1: 프로젝트 사용
```bash
firebase use eregi-dev
```

출력:
```
Now using project eregi-dev
```

### 단계 2: 와일드카드 도메인 생성
```bash
firebase hosting:flexible:channels:create
```

### 단계 3: 도메인 입력
프롬프트:
```
? What domain do you want to configure?
```
입력:
```
*.eregi-dev.web.app
```

### 단계 4: 확인
Firebase가 자동으로:
1. 도메인 소유권 확인
2. DNS 설정 가이드 제공
3. SSL 인증서 발급

---

## 🔍 다른 방법: 개별 도메인 수동 추가

와일드카드 대신 자주 사용하는 도메인 개별 추가:

### 1. Firebase Console
```
eregi-dev → Build → Hosting → Custom domains → Add custom domain
```

### 2. 개별 도메인 추가
```
admin.eregi-dev.web.app
kap.eregi-dev.web.app
kadd.eregi-dev.web.app
```

이 방식은:
- ✅ Firebase Console에서 직접 가능
- ⚠️ 하나씩 수동으로 추가해야 함
- ⚠️ 새 학회마다 매번 추가 필요

---

## 💡 권장 방법

### 옵션 1: Firebase CLI 와일드카드 (자동화)
```bash
firebase hosting:flexible:channels:create
→ *.eregi-dev.web.app
```

**장점:**
- ✅ 무제한 서브도메인 자동 생성
- ✅ 한 번의 설정으로 영구적 사용
- ✅ 새 학회 추가 시 추가 작업 불필요

### 옵션 2: 수동 추가 (단순)
```
필요한 도메인만 하나씩 추가:
- admin.eregi-dev.web.app
- kap.eregi-dev.web.app
- kadd.eregi-dev.web.app
```

**장점:**
- ✅ Firebase Console에서 바로 가능
- ⚠️ 매번 수동으로 추가

---

## 🚀 CLI 방법으로 진행하시겠습니까?

```bash
# 터미널에서 실행
firebase use eregi-dev
firebase hosting:flexible:channels:create
```

프롬프트에 `*.eregi-dev.web.app` 입력하면 됩니다!

설정 완료 후 알려주세요. 자동으로 모든 서브도메인이 생성됩니다. 🚀

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
