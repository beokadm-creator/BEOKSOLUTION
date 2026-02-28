# Dev 환경 관리자 계정 설정 가이드

## 목표
- **이메일**: aaron@beoksolution.com
- **역할**: 슈퍼관리자 + 학회 관리자 (예시용)
- **환경**: eregi-dev (개발 환경)

---

## 🎯 Firebase Console 작업 단계

### 1. Firebase Console 접속
```
https://console.firebase.google.com/
→ eregi-dev 프로젝트 선택
```

### 2. Authentication에서 사용자 생성

#### 2.1 Authentication 페이지 이동
1. 좌측 메뉴 **Build** → **Authentication**
2. **Get started** 또는 **Sign-in method** 탭
3. **Email/Password** 활성화 (안 된 경우)
4. **Users** 탭 클릭

#### 2.2 사용자 추가
1. **Add user** 버튼 클릭
2. **User email**: `aaron@beoksolution.com`
3. **Password**: (임시 비밀번호 생성, 예: `Dev@2024!`)
4. **Phone number**: (선택사항, 생략 가능)
5. **Add user** 클릭

### 3. User UID 복사
생성된 사용자를 클릭하여 **User UID** 복사
- 예: `dJxKkabc123XYZ` 같은 형식
- 이 UID가 필요합니다!

---

## 📊 Firestore 데이터베이스 설정

Firebase Console에서 Firestore Database 설정:

### 1. Firestore Console 접속
```
eregi-dev → Build → Firestore Database
→ Collections 클릭
```

### 2. 슈퍼관리자 설정

#### 2.1 super_admins 컬렉션 생성/추가
1. **Start collection** 클릭
2. **Collection ID**: `super_admins`
3. **Auto-ID** 클릭하여 문서 ID 생성
4. **Field 추가**:
   - **Field name**: `email`
   - **Field type**: string
   - **Field value**: `aaron@beoksolution.com`
5. **Save** 클릭

완성된 문서 구조:
```javascript
{
  "email": "aaron@beoksolution.com",
  "createdAt": Firestore Timestamp (자동)
}
```

### 3. 학회 관리자 설정 (예시)

#### 3.1 societies 컬렉션에 학회 추가
1. **Start collection** 클릭
2. **Collection ID**: `societies`
3. **Auto-ID** 클릭 (예: `test_society`)
4. **Field 추가**:
   - **Field name**: `name`
   - **Field type**: string
   - **Field value**: `Test Society`
5. **Save** 클릭

#### 3.2 하위 컬렉션에 관리자 추가
`societies/test_society` 문서에서:
1. **Subcollection** 클릭
2. **Collection ID**: `admins`
3. **Add document**
4. **Field 추가**:
   - **Field name**: `email`
   - **Field type**: string
   - **Field value**: `aaron@beoksolution.com`
5. **Field 추가**:
   - **Field name**: `role`
   - **Field type**: string
   - **Field value**: `admin`
6. **Save** 클릭

완성된 구조:
```
societies/{societyId}
├── name: "Test Society"
└── admins/{uid}
    ├── email: "aaron@beoksolution.com"
    └── role: "admin"
```

---

## 🔐 보안 설정

### 비밀번호
- 생성한 비밀번호를 안전하게 저장
- 나중에 로그인 테스트에 사용

### User UID
- 이 UID로 Firestore 권한 설정
- 슈퍼관리자 문서와 학회 관리자 문서에 사용

---

## ✅ 완료 후 검증

### 1. 로그인 테스트
```
https://eregi-dev.web.app
→ 로그인 페이지
→ aaron@beoksolution.com / 설정한 비밀번호
```

### 2. 슈퍼관리자 접근
- admin.eregi-dev.web.app (또는 ?admin=true 파라미터)
- 대시보드 접근 가능해야 함

### 3. 학회 관리자 접근
- test-society.eregi-dev.web.app (또는 ?society=test_society)
- 학회 대시보드 접근 가능해야 함

---

## 📝 필요한 정보

Firebase Console에서 작업 완료 후 알려주세요:

1. **User UID**: (Authentication에서 생성된 UID)
2. **생성된 비밀번호**: (기억하기 쉬운 것으로 변경 가능)

이 두 가지만 알려주시면 추가 설정을 도와드리겠습니다!

---

## 🎯 참고: 현재 프로젝트 구조

### Firestore 구조
```
eregi-dev (Firestore Database)
├── super_admins/{uid}
│   └── email: "aaron@beoksolution.com"
│
└── societies/{societyId}
    ├── name: "학회 이름"
    └── admins/{uid}
        ├── email: "aaron@beoksolution.com"
        └── role: "admin"
```

### 역할 정의
- **슈퍼관리자**: 모든 학회 관리, 전체 설정
- **학회 관리자**: 자신 학회의 회원, 등록, 설정

---

Firebase Console에서 사용자 생성 완료 후 **User UID**를 알려주세요! 🚀
# Dev 환경 데이터베이스 초기화 가이드

## 문제 상황

### ✅ 작동하는 것
- Firebase Authentication: 사용자 생성 완료
- 로그인 성공: `aaron@beoksolution.com`
- 슈퍼관리자 권한 확인: `isSuperAdmin: true`

### ❌ 문제
- Firestore Database: 빈 상태
- societies 컬렉션: 없음
- 결과: "No sid provided" 에러

---

## 🔧 해결 방법 (3가지)

### 방법 1: Firestore Export/Import (가장 추천 - 데이터 정확히 복사)

#### 1-1. Live 데이터 내보내기
```bash
firebase use eregi-8fc1e
```

Firebase Console:
1. **Firestore Database** → **탭 표** (데이터베이스)
2. 상단에 **Export 데이터** (내보내기) 클릭
3. 다음 선택:
   - **Firestore 데이터베이스**
   - **전체 내보내기** 또는 **컬렉션만 내보내기**
   - societies 컬렉션 포함되어야 함
4. **내보내기** 클릭

#### 1-2. Dev 데이터 가져오기
```bash
firebase use eregi-dev
```

Firebase Console:
1. **Firestore Database** → **탭** (데이터베이스)
2. **Import 데이터** (가져오기) 클릭
3. 내보낸 JSON 파일 선택
4. **가져오기** 클릭

---

### 방법 2: 수동으로 테스트 학회 생성 (간단)

Firebase Console → Firestore Database → Start collection:

#### societies 컬렉션에 학회 추가

##### 1. KAP 학회
```
Collection ID: societies
Document ID: kap

Fields:
- name: "Korean Academy of Periodontology"
- slug: "kap"
- societyId: "kap"
```

##### 2. KADD 학회
```
Collection ID: societies
Document ID: kadd

Fields:
- name: "Korean Academy of Defective Dentistry"
- slug: "kadd"
- societyId: "kadd"
```

#### societies/{societyId}/admins 하위 컬렉션에 관리자 추가

```
Collection ID: admins
Document ID: (생성된 User UID 입력)

Fields:
- uid: (Firebase Authentication의 User UID)
- email: "aaron@beoksolution.com"
- role: "admin"
- name: "Aaron"
```

---

### 방법 3: 스크립트로 자동화 (파이썬)

데이터를 복사할 수 있는 스크립트 작성 필요합니다.

---

## 🎯 추천 방법

### 간단하게: 방법 2 (수동 생성)
1. societies 컬렉션에 KAP, KADD 추가
2. admins 하위 컬렉션에 aaron@beoksolution.com 추가
3. 즉시 테스트 가능

### 정확하게: 방법 1 (Export/Import) 안내
1. Live 데이터 전체 내보내기
2. Dev로 가져오기
3. 라이브와 동일한 상태로 유지

---

## 🔍 User UID 찾는 방법

Firebase Console:
1. **Authentication** → **Users** 탭
2. `aaron@beoksolution.com` 사용자 클릭
3. **User UID** 복사

---

## ✅ 완료 후 테스트

```
https://eregi-dev.web.app?society=kap
→ KAP 학회 대시보드 접근
```

---

어떤 방법으로 진행하고 싶으신가요?

1. **간단하게**: 제가 해드링으로 방법 2 안내
2. **정확하게**: 방법 1 (Export/Import) 안내
3. **자동화**: 스크립트 작성 (시간 소요)
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
# 라이브/개발 환경 분리 완료 및 검증 보고

## 완료 날짜
2026년 2월 25일

## ✅ 완료된 작업

### 1. Firebase Dev 프로젝트 생성
- **프로젝트 ID**: `eregi-dev`
- **앱 ID**: `1:336507907102:web:6197ea10925d0e9cec920f`
- **API Key**: AIzaSyD1em57IiT5BjuD8kepetllr4CeqA5zvm4
- **Auth Domain**: eregi-dev.firebaseapp.com

### 2. .env.development 구성 완료
```bash
VITE_FIREBASE_PROJECT_ID=eregi-dev
VITE_FIREBASE_API_KEY=AIzaSyD1em57IiT5BjuD8kepetllr4CeqA5zvm4
VITE_FIREBASE_AUTH_DOMAIN=eregi-dev.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=eregi-dev.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=336507907102
VITE_FIREBASE_APP_ID=1:336507907102:web:6197ea10925d0e9cec920f
VITE_FIREBASE_MEASUREMENT_ID=G-KKF850Z5G1
```

### 3. 빌드 테스트 성공
```bash
npm run build:dev
✓ built in 20.13s
```

---

## 🎯 환경 분리 검증

### Dev 환경
- **Firebase 프로젝트**: eregi-dev
- **배포 명령**: `npm run deploy:dev`
- **URL**: `eregi-dev.web.app` (예정)
- **데이터**: 독립된 개발 데이터베이스
- **결제**: Toss 테스트 키

### Live 환경
- **Firebase 프로젝트**: eregi-8fc1e
- **배포 명령**: `npm run deploy:live`
- **URL**: `eregi-8fc1e.web.app`
- **데이터**: 운영 데이터베이스
- **결제**: Toss 라이브 키

---

## 📋 배포 명령어 정리

### 개발 환경
```bash
# 개발 모드 실행
npm run dev

# 개발용 빌드
npm run build:dev

# 개발 환경 배포
npm run deploy:dev
```

### 운영 환경
```bash
# 프로덕션 빌드
npm run build:prod

# 운영 배포 (Hosting only)
npm run deploy:live

# 전체 배포 (Hosting + Functions)
npm run deploy:prod
```

---

## 🔐 보안 설정 확인

### .gitignore
```gitignore
.env
.env.development
.env.test
.env.production
.env.local
.env.development.local
.env.test.local
.env.production.local
```

**상태:** ✅ 환경 변수가 Git에 커밋되지 않음

---

## 🚀 다음 단계

### 1. 개발 배포 테스트
```bash
npm run deploy:dev
```
- Firebase CLI로 `eregi-dev` 프로젝트에 배포
- 개발 환경에서 자유롭게 테스트 가능

### 2. 데이터 분리 확인
- Dev 프로젝트: 개발 테스트 데이터
- Live 프로젝트: 실사용자 운영 데이터
- 완전 분리됨

### 3. Firestore Database 생성 (Dev용)
Firebase Console에서:
```
eregi-dev 프로젝트 → Build → Firestore Database → Create database
- Test mode 선택
- Location: asia-northeast3
```

---

## ✨ 완성된 환경 분리

### 데이터 안전성
```
Dev:  eregi-dev (테스트용)  → 테스트 데이터만
Live: eregi-8fc1e (운영용) → 실사용자 데이터
```

### 개발 자유도
```
Dev 배포:  자유롭게 테스트, 실패해도 무관
Live 배포: 신중하게, 실사용자에게 영향
```

### 롤백 가능
```
Dev 배포 실수 → 삭제 재배포 (안전)
Live 배포 실패 → 롤백 (운영 영향 없음)
```

---

## ✅ 최종 상태

**설정 완료:**
- ✅ Firebase 다중 프로젝트 구성
- ✅ 환경 변수 파일 분리
- ✅ 배포 스크립트 환경별 구분
- ✅ .gitignore 보안 설정
- ✅ 빌드 테스트 통과

**준비 완료:**
- ✅ 개발 배포 준비 완료
- ✅ 데이터 분리 구성 완료
- ✅ 안전한 개발 환경 확보

---

**작업자:** Sisyphus Agent
**상태:** 환경 분리 완료, 배포 준비 완료
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
