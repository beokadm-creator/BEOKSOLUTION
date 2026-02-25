# Firebase 프로젝트 분리 가이드

## 목표
- **Live (운영)**: `eregi-8fc1e` (기존)
- **Dev (개발)**: `eregi-dev-8fc1e` (신규 생성)

## 왜 분리해야 하나?

### 현재 문제점
```
[단일 프로젝트 구조]
eregi-8fc1e (Live + Dev 공유)
├── Firestore (공유)
├── Storage (공유)
└── Authentication (공유)

문제:
❌ 개발 중인 기능이 라이브에 노출
❌ 테스트 데이터가 라이브 데이터에 섞임
❌ 롤백 불가능
❌ 실사용자에게 영향
```

### 분리 후 구조
```
[다중 프로젝트 구조]
eregi-8fc1e (Live)
├── Firestore (운영 데이터만)
├── Storage (운영 파일만)
└── Authentication (실사용자만)

eregi-dev-8fc1e (Dev)
├── Firestore (테스트 데이터)
├── Storage (테스트 파일)
└── Authentication (개발계정)
```

---

## 단계 1: Firebase 개발 프로젝트 생성

### 1.1 Firebase Console 접속
```
https://console.firebase.google.com/
```

### 1.2 새 프로젝트 생성
1. **Add project** 클릭
2. **Project name**: `eregi-dev-8fc1e`
3. **Google Analytics**: 비활성 (개발 환경이므로)
4. **Create project**

### 1.3 앱 등록 (웹)
1. **Web icon** (</>) 클릭
2. **App nickname**: `eRegi Dev`
3. **Hosting setup**: 체크하지 않음 (나중에 설정)
4. **Register app**

### 1.4 Firebase SDK 설정 복사
```json
{
  "apiKey": "...",
  "authDomain": "eregi-dev-8fc1e.firebaseapp.com",
  "projectId": "eregi-dev-8fc1e",
  "storageBucket": "eregi-dev-8fc1e.firebasestorage.app",
  "messagingSenderId": "...",
  "appId": "..."
}
```

### 1.5 Firestore 생성
1. **Build** → **Firestore Database**
2. **Create database**
3. **Start in test mode** (개발이므로)
4. **Location**: `asia-northeast3` (라이브와 동일하게)

### 1.6 Storage 규칙 생성
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{allPaths=**} {
    allow read, write: if true; // 개발은 모두 허용
  }
}
```

---

## 단계 2: 개발 프로젝트 설정

### 2.1 Hosting 활성화
```bash
# 개발 프로젝트 초기화
firebase login
firebase use eregi-dev-8fc1e
firebase init hosting
# Public directory: dist
# Configure as single-page app: Yes
```

### 2.2 사용자 생성 (테스트용)
이메일: `dev+admin@eregi.co.kr`
비밀번호: 개발용 암호

---

## 단계 3: 로컬 환경 설정

### 3.1 `.env.development` 생성
```bash
# Firebase Development
VITE_FIREBASE_API_KEY=dev_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=eregi-dev-8fc1e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=eregi-dev-8fc1e
VITE_FIREBASE_STORAGE_BUCKET=eregi-dev-8fc1e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=dev_sender_id
VITE_FIREBASE_APP_ID=dev_app_id

# API Endpoints
VITE_BASE_URL=https://dev.eregi.co.kr
VITE_ADMIN_DOMAIN=dev.eregi.co.kr

# Toss Payment (Development)
VITE_TOSS_CLIENT_KEY=test_gck_test_Okp56BeO0QG2Q4I2FJcL7j8v

# Environment
VITE_ENV=development
```

### 3.2 `.env.production` 생성
```bash
# Firebase Production
VITE_FIREBASE_API_KEY=production_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=eregi.co.kr
VITE_FIREBASE_PROJECT_ID=eregi-8fc1e
VITE_FIREBASE_STORAGE_BUCKET=eregi-8fc1e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=853389544
VITE_FIREBASE_APP_ID=production_app_id

# API Endpoints
VITE_BASE_URL=https://eregi.co.kr
VITE_ADMIN_DOMAIN=eregi.co.kr

# Toss Payment (Production)
VITE_TOSS_CLIENT_KEY=live_toss_client_key_here

# Environment
VITE_ENV=production
```

---

## 단계 4: 환경별 배포 설정

### 4.1 firebase.json 수정
```json
{
  "hosting": {
    "public": "dist",
    "ignore": [...],
    "rewrites": [...]
  },
  "functions": [...]
}
```

### 4.2 .firebaserc 수정
```json
{
  "projects": {
    "default": "eregi-8fc1e"
  },
  "targets": {
    "eregi-8fc1e": {
      "hosting": {
        "live": ["eregi-8fc1e"],
        "public": ["eregi-8fc1e"]
      }
    },
    "eregi-dev-8fc1e": {
      "hosting": {
        "dev": ["eregi-dev-8fc1e"],
        "public": ["eregi-dev-8fc1e"]
      }
    }
  }
}
```

---

## 단계 5: 배포 스크립트 수정

### package.json
```json
{
  "scripts": {
    "dev": "vite --mode development",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "build:prod": "vite build --mode production",
    
    "deploy:dev": "npm run build:dev && firebase deploy --only hosting --project eregi-dev-8fc1e",
    "deploy:live": "npm run build:prod && firebase deploy --only hosting --project eregi-8fc1e",
    "deploy:prod": "npm run build:prod && firebase deploy --only hosting,functions --project eregi-8fc1e",
    
    "serve:dev": "vite --mode development",
    "serve:prod": "vite --mode production"
  }
}
```

---

## 검증 체크리스트

### 프로젝트 분리 확인
- [ ] `eregi-dev-8fc1e` 프로젝트 생성 완료
- [ ] Firestore Database 생성 완료
- [ ] Storage 생성 완료
- [ ] 테스트 사용자 생성 완료

### 환경 설정 확인
- [ ] `.env.development` 파일 생성
- [ ] `.env.production` 파일 생성
- [ ] `.gitignore`에 `.env*` 포함 확인

### 배포 확인
- [ ] `npm run deploy:dev` → dev.eregi.co.kr 접속 확인
- [ ] `npm run deploy:live` → eregi.co.kr 접속 확인
- [ ] 두 환경 데이터 완전 분리 확인

---

## 도메인 설정 (선택사항)

### 개발 도메인
```
dev.eregi.co.kr → eregi-dev-8fc1e.web.app
```

### 운영 도메인
```
eregi.co.kr → eregi-8fc1e.web.app
```

---

## 다음 단계

이 가이드를 따라:
1. Firebase 개발 프로젝트 생성
2. 로컬 환경 설정
3. 배포 스크립트 수정
4. 환경별 배포 테스트

**완료되면 라이브/개발이 완전히 분리되어 안정성 확보됩니다!**
