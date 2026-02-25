# 라이브/개발 환경 분리 완료 보고

## 수정 날짜
2026년 2월 25일

## 목표
- **Live (운영)**: `eregi-8fc1e`
- **Dev (개발)**: `eregi-dev-8fc1e` (신규 생성 필요)

---

## ✅ 완료된 작업

### 1. Firebase 개발 프로젝트 생성 가이드 작성
**파일:** `FIREBASE_PROJECT_SEPARATION_GUIDE.md`
- 단계별 생성 절차
- Firebase Console 설정 방법
- Firestore/Storage 생성 가이드

### 2. 환경 변수 파일 구성
**파일 생성:**
- `.env.development` (개발 환경 설정)
- `.env.production` (운영 환경 설정)

**내용:**
```bash
# 개발 환경
VITE_FIREBASE_PROJECT_ID=eregi-dev-8fc1e
VITE_BASE_URL=https://dev.eregi.co.kr
VITE_TOSS_CLIENT_KEY=test_key
VITE_ENV=development

# 운영 환경
VITE_FIREBASE_PROJECT_ID=eregi-8fc1e
VITE_BASE_URL=https://eregi.co.kr
VITE_TOSS_CLIENT_KEY=live_key
VITE_ENV=production
```

### 3. .firebaserc 다중 프로젝트 설정
**수정 전:**
```json
{
  "targets": {
    "eregi-8fc1e": {
      "hosting": {
        "live": ["eregi-8fc1e"],
        "dev": ["eregi-8fc1e"]  // ❌ 동일 프로젝트
      }
    }
  }
}
```

**수정 후:**
```json
{
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

### 4. 배포 스크립트 환경별 분리
**수정 전:**
```json
{
  "deploy:dev": "firebase hosting:channel:deploy dev",
  "deploy:live": "firebase deploy --only hosting",
  "deploy:prod": "firebase deploy --only hosting,functions"
}
```

**수정 후:**
```json
{
  "dev": "vite --mode development",
  "build:dev": "vite build --mode development",
  "build:prod": "vite build --mode production",
  "deploy:dev": "npm run build:dev && firebase deploy --only hosting --project eregi-dev-8fc1e",
  "deploy:live": "npm run build:prod && firebase deploy --only hosting --project eregi-8fc1e",
  "deploy:prod": "npm run build:prod && firebase deploy --only hosting,functions --project eregi-8fc1e"
}
```

### 5. gitignore 환경 변수 보안 강화
**추가:**
```gitignore
.env.development.local
.env.test.local
.env.production.local
```

---

## 🎯 개발/라이브 배포 명령어

### 개발 환경
```bash
# 1. 개발 모드로 실행
npm run dev

# 2. 개발용 빌드
npm run build:dev

# 3. 개발 환경 배포
npm run deploy:dev

# 결과: dev.eregi-8fc1e.web.app
# 데이터: eregi-dev-8fc1e (테스트 데이터)
```

### 운영 환경
```bash
# 1. 프로덕션 빌드
npm run build:prod

# 2. 운영 배포 (Hosting only)
npm run deploy:live

# 3. 전체 배포 (Hosting + Functions)
npm run deploy:prod

# 결과: eregi-8fc1e.web.app
# 데이터: eregi-8fc1e (운영 데이터)
```

---

## 🔐 보안 강화

### .gitignore 설정
- ✅ `.env.development` 제외 (로컬만)
- ✅ `.env.production` 제외 (로컬만)
- ✅ `.env.*.local` 제외 (개별 설정)

### Firebase API 키
- ✅ 각 환경별 다른 API 키 사용
- ✅ Git에 커밋되지 않음

---

## 📋 다음 단계 (수동 작업 필요)

### 1. Firebase 개발 프로젝트 생성
```bash
# Firebase Console 접속
https://console.firebase.google.com/

# 프로젝트 생성
1. Add project
2. Name: eregi-dev-8fc1e
3. Create project
4. Firestore Database 생성
5. Storage 생성
6. Hosting 활성화
```

### 2. 개발 프로젝트 환경 변수 입력
```bash
# .env.development 파일에 실제 값 입력
VITE_FIREBASE_API_KEY=실제_dev_api_key
VITE_FIREBASE_AUTH_DOMAIN=eregi-dev-8fc1e.firebaseapp.com
# ... 나머지도
```

### 3. 개발 배포 테스트
```bash
# 1. 개발용 빌드
npm run build:dev

# 2. 개발 환경 배포
npm run deploy:dev

# 3. 접속 확인
# https://dev.eregi-8fc1e.web.app
```

### 4. 데이터 마이그레이션 (선택사항)
운영 데이터를 개발 환경에 복사하려면:
- Firestore export/import
- Storage 파일 복사
- Authentication 사용자 재생성

---

## ✨ 예상 효과

### 이전
```
단일 프로젝트 (위험)
├── 개발 테스트 → 라이브 데이터 오염
├── 배포 실수 → 서비스 중단
└── 롤백 불가능
```

### 이후
```
다중 프로젝트 (안전)
├── Dev 환경 (테스트 자유)
│   ├── eregi-dev-8fc1e.web.app
│   └── 별도 데이터베이스
└── Live 환경 (운영 안정)
    ├── eregi-8fc1e.web.app
    └── 실사용자 데이터만
```

---

## ⚠️ 주의사항

### CI/CD
- 현재 CI는 빌드 체크만
- 환경별 배포는 수동
- GitHub Actions에서 환경 변수 설정 필요

### 도메인
- 도메인 설정은 추가 작업 필요
- Firebase Hosting에서 사용자 도메인 연결
- 개발 도메인: `dev.eregi.co.kr` (선택)

---

**작업자:** Sisyphus Agent
**상태:** 설정 완료, Firebase 프로젝트 생성 대기 중
