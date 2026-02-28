# BEOKSOLUTION 저장소 연결 가이드

이 가이드는 eRegi 프로젝트를 BEOKSOLUTION 저장소에 연결하는 방법을 설명합니다.

## 저장소 정보

- **Repository**: beokadm-creator/BEOKSOLUTION
- **Developer Connect URL**: https://northamerica-northeast1-git.developerconnect.dev/853389544/BEOK/beokadm-creator-BEOKSOLUTION
- **Git Remote URL**: https://northamerica-northeast1-git.developerconnect.dev/853389544/BEOK/beokadm-creator-BEOKSOLUTION
- **Cloud Project**: eregi-8fc1e
- **Region**: northamerica-northeast1

## 단계별 진행

### 1단계: Git 저장소 초기화

터미널에서 eRegi 프로젝트 루트(`C:\Users\whhol\Documents\trae_projects\eRegi`)로 이동 후:

```bash
# Windows CMD 또는 PowerShell에서:
git init
git add .
git commit -m "Initial commit: eRegi project setup"
```

### 2단계: BEOKSOLUTION 리모트 추가

```bash
# BEOKSOLUTION 저장소를 원격 리포지토리로 추가
git remote add beok https://northamerica-northeast1-git.developerconnect.dev/853389544/BEOK/beokadm-creator-BEOKSOLUTION
```

### 3단계: 브랜치 설정 및 푸시

```bash
# main 브랜치 설정
git branch -M main

# BEOKSOLUTION 저장소에 푸시
git push -u beok main
```

## 인증 설정

### Google Cloud 인증

Developer Connect 저장소는 Google Cloud 인증이 필요합니다:

```bash
# gcloud 로그인
gcloud auth login

# 또는 서비스 계정 사용 (CI/CD용)
gcloud auth activate-service-account YOUR_SERVICE_ACCOUNT --key-file=path/to/key.json
```

### Git Credential Helper 설정 (선택)

```bash
# Google Cloud Git 사용자 정보 설정
git config --global credential.helper gcloud.cmd
```

## CI/CD 설정

### GitHub Actions (현재 설정)

기존 GitHub Actions 워크플로우가 `.github/workflows/firebase-deploy.yml`에 있습니다.

### Cloud Build (Google Cloud)

Google Cloud Developer Connect를 사용하는 경우, Cloud Build로 배포할 수도 있습니다.

#### Cloud Build 설정 방법

1. **cloudbuild.yaml** 생성:

```yaml
steps:
  # 빌드 단계
  - name: 'node:18'
    entrypoint: 'npm'
    args: ['ci']

  - name: 'node:18'
    entrypoint: 'npm'
    args: ['run', 'lint']

  - name: 'node:18'
    entrypoint: 'npm'
    args: ['test']

  - name: 'node:18'
    entrypoint: 'npm'
    args: ['run', 'build']

  # Functions 빌드
  - name: 'node:18'
    dir: 'functions'
    entrypoint: 'npm'
    args: ['ci']

  - name: 'node:18'
    dir: 'functions'
    entrypoint: 'npm'
    args: ['run', 'build']

  # Firebase 배포
  - name: 'firebase/firebase-tools-actions@v2'
    args: ['deploy', '--only', 'hosting,functions,firestore']
    env:
      - GCP_SA_KEY=$_GCP_SA_KEY

# 타임아웃 설정
timeout: '1800s'

# 로그 옵션
options:
  logging: CLOUD_LOGGING_ONLY
```

2. **Cloud Build 트리거 설정**:

```bash
# 트리거 생성
gcloud builds triggers create github \
  --name=eregi-deploy \
  --region=northamerica-northeast1 \
  --branch-pattern='^main$' \
  --build-config=cloudbuild.yaml \
  --repository=beokadm-creator/BEOKSOLUTION
```

## 트러블슈팅

### 401 Unauthorized 오류

```bash
# gcloud 인증 갱신
gcloud auth login
gcloud auth application-default login
```

### 푸시 실패

```bash
# 리모트 URL 확인
git remote -v

# 필요한 경우 리모트 URL 재설정
git remote set-url beok https://northamerica-northeast1-git.developerconnect.dev/853389544/BEOK/beokadm-creator-BEOKSOLUTION
```

### Git Credential 관련 오류

Windows에서 Git Credential Helper 설정:

```bash
git config --global credential.helper gcloud.cmd
# 또는
git config --global credential.helper manager-core
```

## 추가 리소스

- [Google Cloud Developer Connect](https://cloud.google.com/source-repositories/docs/connecting-repositories)
- [Cloud Build 트리거 설정](https://cloud.google.com/build/docs/automating-builds/create-manage-build-triggers)
- [Firebase 배포 문서](https://firebase.google.com/docs/hosting/github-integration)
