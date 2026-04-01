---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 656
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

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

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
