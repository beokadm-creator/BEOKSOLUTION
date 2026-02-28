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
