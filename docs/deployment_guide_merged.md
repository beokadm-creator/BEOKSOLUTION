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
# GitHub + Firebase Deployment Setup

이 가이드는 GitHub Actions를 사용하여 Firebase에 자동 배포하는 방법을 설명합니다.

## 저장소 정보

### BEOKSOLUTION (Google Cloud Developer Connect)
- **Repository**: beokadm-creator/BEOKSOLUTION
- **Remote URL**: https://northamerica-northeast1-git.developerconnect.dev/853389544/BEOK/beokadm-creator-BEOKSOLUTION
- **Cloud Project**: eregi-8fc1e
- **Region**: northamerica-northeast1

### 전제 조건

1. BEOKSOLUTION 저장소에 액세스 권한이 있어야 함
2. Firebase 프로젝트가 생성되어 있어야 함
3. Firebase CLI가 로컬에 설치되어 있어야 함
4. Google Cloud 인증이 필요함

## 1단계: Git 저장소 초기화

```bash
git init
git add .
git commit -m "Initial commit: eRegi project"
```

BEOKSOLUTION 저장소에 연결:

```bash
git remote add beok https://northamerica-northeast1-git.developerconnect.dev/853389544/BEOK/beokadm-creator-BEOKSOLUTION
git branch -M main
git push -u beok main
```

### Google Cloud 인증

```bash
# gcloud 로그인
gcloud auth login

# 또는 서비스 계정 사용 (CI/CD용)
gcloud auth activate-service-account YOUR_SERVICE_ACCOUNT --key-file=path/to/key.json
```

## 2단계: Firebase Service Account 생성

Firebase Service Account Key는 GitHub Actions에서 Firebase에 인증하는 데 사용됩니다.

### Service Account Key 생성 방법

1. [Google Cloud Console](https://console.cloud.google.com/) 이동
2. 프로젝트 선택
3. **IAM & Admin** → **Service Accounts** 이동
4. **Create Service Account** 클릭
   - Name: `github-actions-deploy`
   - Description: `GitHub Actions deployment account`
   - **Create and Continue**
5. 역할(Role) 추가:
   - `Firebase Cloud Function Admin`
   - `Firebase Rules Admin`
   - `Firebase Hosting Admin`
   - 또는 `Editor` 역할 (더 넓은 권한)
6. **Done** 클릭
7. 생성된 Service Account 클릭
8. **Keys** 탭 → **Add Key** → **Create new key**
9. **JSON** 선택 후 **Create**
10. JSON 파일이 다운로드됨 (이 파일을 안전하게 보관하세요!)

## 3단계: GitHub Secrets 설정

GitHub Repository에서 Service Account Key를 환경 변수로 설정합니다.

1. GitHub Repository 이동
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. 다음 Secret 추가:

| Name | Value | Description |
|------|-------|-------------|
| `GCP_SA_KEY` | `(다운로드한 JSON 파일 내용)` | Firebase Service Account Key (전체 JSON 내용) |

### GCP_SA_KEY 값 넣는 방법

다운로드한 JSON 파일을 열고 전체 내용을 복사하여 Secret 값으로 넣습니다:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

## 4단계: 배포 확인

이제 main 브랜치에 푸시할 때마다 자동으로 배포가 됩니다:

```bash
git add .
git commit -m "Update deployment"
git push origin main
```

### 배포 확인 방법

1. GitHub Repository → **Actions** 탭에서 워크플로우 상태 확인
2. Firebase Console에서 실제 배포 상태 확인

## 워크플로우 설정

기본적으로 다음이 배포됩니다:
- **Hosting**: Frontend (`npm run build` 결과)
- **Functions**: Cloud Functions (`functions/` 폴더)
- **Firestore**: Firestore Rules & Indexes

### 배포 대상 변경

`.github/workflows/firebase-deploy.yml`에서 수정:

```yaml
- name: Deploy to Firebase
  uses: firebase/firebase-tools-actions@v2
  with:
    args: deploy --only hosting  # Hosting만 배포
    # args: deploy --only functions  # Functions만 배포
    # args: deploy --only firestore  # Firestore만 배포
```

## 버전 태그 관리 (선택 사항)

릴리스 버전을 관리하려면:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub에서 **Releases** 탭에서 릴리즈 노트 작성 가능

## 트러블슈팅

### 권한 오류 발생 시

```
Error: Could not load the default credentials from path
```

→ `GCP_SA_KEY` Secret이 올바르게 설정되었는지 확인

### Functions 빌드 실패 시

```
Error: Functions deployment failed
```

→ 로컬에서 `cd functions && npm run build` 실행하여 에러 확인

### Firestore 배포 실패 시

```
Error: Error reading indexes from firestore.indexes.json
```

→ `firestore.indexes.json` 파일이 존재하고 올바른 JSON 형식인지 확인

## 추가 리소스

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Firebase Deployment Documentation](https://firebase.google.com/docs/hosting/github-integration)
- [Firebase CI/CD Guide](https://firebase.google.com/docs/functions/organize-functions)
# 안전한 배포 실행 가이드

## 🎯 목적
이 가이드는 NHN 알림톡 변경과 같은 주요 기능 변경 시 사이트 접근 불가 문제를 방지하기 위한 실행 가이드입니다.

## 📋 즉시 실행 가능한 대책

### 1. 배포 전 필수 체크 실행

```bash
# 배포 전 안전성 체크
npm run pre-deploy
```

이 명령어는 다음을 자동으로 확인합니다:
- ✅ 주요 파일 존재 여부
- ✅ Firebase 설정 유효성
- ✅ 환경 변수 설정
- ✅ TypeScript 타입 체크
- ✅ ESLint 검사
- ✅ 프로덕션 빌드 성공 여부
- ✅ Functions 빌드 성공 여부

**모든 체크를 통과해야만 배포를 진행하세요.**

### 2. 안전한 배포 프로세스

```bash
# 안전한 배포 (스테이징 → 프로덕션)
npm run deploy:safe
```

이 명령어는 다음 단계를 자동으로 수행합니다:
1. 배포 전 체크 실행
2. Git 상태 확인
3. 스테이징 환경 배포 (Preview Channel)
4. 사용자 확인 대기
5. 프로덕션 배포
6. 배포 후 헬스체크

### 3. 수동 단계별 배포 (권장)

더 안전한 방법은 단계별로 수동 실행하는 것입니다:

#### Step 1: 배포 전 체크
```bash
npm run pre-deploy
```

#### Step 2: 스테이징 배포
```bash
npm run deploy:staging
```

스테이징 URL이 출력되면 다음을 테스트하세요:
- [ ] 홈페이지 접근 (`/`)
- [ ] 로그인/로그아웃
- [ ] 컨퍼런스 페이지 (`/conference/2026spring`)
- [ ] 등록 페이지
- [ ] 결제 프로세스
- [ ] 관리자 페이지

#### Step 3: 프로덕션 배포
```bash
npm run deploy:prod
```

#### Step 4: 배포 후 확인
```bash
# 헬스체크 (배포 후 30초 대기 후 실행)
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/healthCheck
```

## 🚨 긴급 롤백

배포 후 문제가 발생하면 즉시 롤백하세요:

```bash
# 이전 버전으로 롤백
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live
```

또는 Firebase Console에서:
1. Hosting 섹션으로 이동
2. "Release history" 탭 선택
3. 이전 버전 선택 후 "Rollback" 클릭

## 📊 배포 후 모니터링 (필수)

배포 후 최소 5-10분간 다음을 모니터링하세요:

### 1. Firebase Console
- Functions 로그: https://console.firebase.google.com/project/_/functions/logs
- Hosting 상태: https://console.firebase.google.com/project/_/hosting

### 2. 실제 사이트 접근 테스트
```bash
# 프로덕션 URL 접근
curl -I https://your-domain.com

# 주요 페이지 확인
curl https://your-domain.com/
curl https://your-domain.com/conference/2026spring
```

### 3. 브라우저 콘솔 확인
- 브라우저에서 F12 → Console 탭
- 에러 메시지가 없는지 확인

## 🔧 NHN 알림톡 안전 배포 계획

현재 Aligo를 사용 중이므로, NHN으로 전환 시 다음 단계를 따르세요:

### Phase 1: 준비 (1주)
1. NHN Cloud 계정 및 API 키 발급
2. `functions/src/services/notificationService.ts`의 `NHNProvider` 구현 완료
3. 테스트 환경에서 NHN API 호출 테스트

### Phase 2: Feature Flag 설정 (1일)
1. Firestore에 Feature Flag 초기화:
```javascript
// Firebase Console → Firestore → _config/feature_flags 문서 생성
{
  useNHNAlimTalk: false,
  useAligoAlimTalk: true,
  // ... 기타 플래그
}
```

2. 코드에서 Feature Flag 사용:
```typescript
// 기존 코드 수정
import { sendAlimTalk } from './services/notificationService';

// 자동으로 Feature Flag에 따라 Aligo 또는 NHN 사용
await sendAlimTalk({
  phone: '01012345678',
  templateCode: 'REGISTRATION_COMPLETE',
  variables: { name: '홍길동' }
});
```

### Phase 3: 스테이징 테스트 (2-3일)
1. 스테이징 환경에서 `useNHNAlimTalk: true` 설정
2. 실제 알림톡 발송 테스트
3. 수신 확인 및 로그 검증

### Phase 4: 프로덕션 배포 (1일)
1. 안전한 배포 프로세스로 배포
2. 프로덕션에서 `useNHNAlimTalk: false` 유지 (Aligo 계속 사용)
3. 배포 후 모니터링

### Phase 5: 점진적 전환 (1주)
1. 프로덕션에서 `useNHNAlimTalk: true`로 변경
2. 실시간 모니터링
3. 문제 발생 시 즉시 `useNHNAlimTalk: false`로 복구

## ✅ 체크리스트

### 배포 전
- [ ] `npm run pre-deploy` 통과
- [ ] Git 커밋 완료
- [ ] 변경 사항 문서화
- [ ] 롤백 계획 준비

### 배포 중
- [ ] 스테이징 테스트 완료
- [ ] 주요 기능 동작 확인
- [ ] 에러 로그 없음

### 배포 후
- [ ] 프로덕션 사이트 접근 확인
- [ ] 헬스체크 통과
- [ ] 5분간 모니터링
- [ ] 사용자 피드백 확인

## 📞 문제 발생 시

1. **즉시 롤백**
   ```bash
   firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live
   ```

2. **로그 확인**
   - Firebase Console → Functions → Logs
   - 브라우저 Console (F12)

3. **Feature Flag 비활성화** (NHN 알림톡 문제 시)
   - Firestore → `_config/feature_flags` → `useNHNAlimTalk: false`

4. **이슈 기록**
   - 문제 상황 문서화
   - 에러 로그 저장
   - 재발 방지 대책 수립

## 🎓 학습 포인트

이번 롤백 사태에서 배운 교훈:
1. **배포 전 체크가 필수**: 빌드, 타입체크, 린트를 자동화
2. **스테이징 환경 활용**: 프로덕션 배포 전 반드시 테스트
3. **Feature Flag 사용**: 새 기능을 안전하게 on/off
4. **모니터링 강화**: 배포 후 즉시 문제 감지
5. **빠른 롤백 준비**: 문제 발생 시 즉시 복구

## 📚 추가 자료

- [배포 안전성 확보 계획](./DEPLOYMENT_SAFETY_PLAN.md)
- [Firebase Hosting 문서](https://firebase.google.com/docs/hosting)
- [Firebase Functions 문서](https://firebase.google.com/docs/functions)
