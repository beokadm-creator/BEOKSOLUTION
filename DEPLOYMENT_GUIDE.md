# BEOKSOLUTION 배포 가이드

## 사전 요구사항

### 1. Node.js 설치
```bash
# macOS (Homebrew 사용)
brew install node

# 또는 다운로드: https://nodejs.org/
node --version  # v20+ 권장
```

### 2. Firebase CLI 설치
```bash
npm install -g firebase-tools
```

### 3. Firebase 로그인
```bash
firebase login
```

## 배포 절차

### 1. 프로젝트 설정

```bash
cd ~/BEOKSOLUTION
npm install
cd functions && npm install && cd ..
```

### 2. 프로젝트 빌드

```bash
npm run build
```

### 3. 배포

```bash
# 전체 배포 (스크립트 사용)
chmod +x deploy.sh
./deploy.sh

# 또는 수동 배포
# Firestore 규칙/인덱스 배포
firebase deploy --only firestore:rules,firestore:indexes,storage:rules

# Functions + Hosting 배포
firebase deploy --only functions,hosting
```

## 배포 구성

### Firebase 프로젝트
- **Project ID**: eregi-8fc1e
- **Hosting**: https://eregi-8fc1e.web.app
- **Console**: https://console.firebase.google.com/project/eregi-8fc1e

### Hosting 설정 (firebase.json)
- **Public Directory**: dist/
- **SPA Rewrites**: 활성화 (모든 경로 → /index.html)
- **Cache Headers**:
  - 정적 자산: 1년
  - index.html: 캐시 없음
  - 보안 헤더: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection

### Functions 설정
- **Runtime**: Node.js 20
- **Codebase**: default
- **Pre-deploy**: functions/build

### Firestore 규칙
- Super Admin: aaron@beoksolution.com (모든 권한)
- Members: 인증된 사용자 읽기/쓰기
- Registrations: 소유자만 접근
- Conferences: 공개 읽기

### Storage 규칙
- 읽기: 공개
- 쓰기: 인증된 사용자만

## 환경 변수 (.env.production)

```bash
VITE_FIREBASE_API_KEY=AIzaSyA2Cox3QRBA6FcilD7QuyXu5SqAxLsWqj0
VITE_FIREBASE_AUTH_DOMAIN=eregi.co.kr
VITE_FIREBASE_PROJECT_ID=eregi-8fc1e
VITE_FIREBASE_STORAGE_BUCKET=eregi-8fc1e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=853389544
VITE_FIREBASE_APP_ID=1:853389544:web:ee692931da0d79d84c595d
VITE_FIREBASE_MEASUREMENT_ID=G-TDDXRBX2P5
VITE_BASE_URL=https://eregi-8fc1e.web.app
VITE_ADMIN_DOMAIN=eregi.co.kr
VITE_TOSS_CLIENT_KEY=test_gck_test_Okp56BeO0QG2Q4I2FJcL7j8v
```

**⚠️ 중요**: `VITE_TOSS_CLIENT_KEY`는 테스트 키입니다. 프로덕션용 실제 키로 변경 필요.

## 배포 후 확인

1. **Hosting**: https://eregi-8fc1e.web.app 접속
2. **Firebase Console**:
   - Firestore: 데이터 확인
   - Storage: 파일 업로드 확인
   - Functions: 로그 확인
3. **테스트**: 주요 기능 테스트 (회원가입, 결제 등)

## 문제 해결

### 배포 실패 시
```bash
# Firebase CLI 업데이트
npm update -g firebase-tools

# 캐시 정리
firebase logout && firebase login

# 프로젝트 재설정
firebase use eregi-8fc1e
```

### Functions 배포 오류
```bash
# Functions 디렉토리에서
cd functions
npm run build
firebase functions:shell
```

### 빌드 오류
```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

## 기술 스택

- **Frontend**: React 19.2.0, Vite, TypeScript
- **Backend**: Firebase (Firestore, Storage, Functions)
- **UI**: Radix UI, Tailwind CSS 4.1.18
- **Payment**: Toss Payments SDK
- **State**: Zustand
- **Routing**: React Router DOM

## 연락처

- **Project Owner**: aaron@beoksolution.com
- **GitHub**: https://github.com/beokadm-creator/BEOKSOLUTION
