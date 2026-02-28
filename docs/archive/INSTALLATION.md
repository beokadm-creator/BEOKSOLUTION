# Git 설치 및 설정 가이드 (Windows)

## Git 설치

### 1단계: Git 다운로드

Git 공식 웹사이트에서 다운로드:
https://git-scm.com/download/win

### 2단계: Git 설치

1. 다운로드한 `Git-x.x.x.x-64-bit.exe` 실행
2. 설치 마법사에서 다음 설정 추천:

   **Choosing the default editor**:
   - VS Code (설치되어 있다면) 또는 Vim

   **Adjusting your PATH environment**:
   - ✅ `Git from the command line and also from 3rd-party software` (추천)

   **Choosing HTTPS transport backend**:
   - ✅ `Use the OpenSSL library`

   **Configuring the line ending conversions**:
   - ✅ `Checkout Windows-style, commit Unix-style line endings` (추천)

   **Configuring terminal emulator**:
   - ✅ `Use MinTTY`

   나머지는 기본값으로 **Next** 클릭 → **Install** → **Finish**

### 3단계: 설치 확인

새로운 터미널(CMD 또는 PowerShell)을 열고 다음 실행:

```bash
git --version
```

Git 버전이 표시되면 설치 성공!

## Git 설정

### 사용자 정보 설정 (필수)

Git은 커밋할 때 사용자 정보가 필요합니다:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Google Cloud SDK 설치 (gcloud 명령어용)

### 1단계: gcloud 다운로드

https://cloud.google.com/sdk/docs/install#windows

### 2단계: gcloud 설치

1. 다운로드한 `GoogleCloudSDKInstaller.exe` 실행
2. 설치 마법사에서 **Next** → **Install** → **Finish**

### 3단계: 설치 및 인증

새로운 터미널(CMD 또는 PowerShell)을 열고:

```bash
# 설치 확인
gcloud --version

# Google Cloud 계정 로그인
gcloud auth login

# 기본 프로젝트 설정
gcloud config set project eregi-8fc1e
gcloud config set region northamerica-northeast1
```

브라우저가 열리고 Google 계정 로그인을 요청합니다.

## BEOKSOLUTION 저장소 연결 (Git & gcloud 설치 후)

모든 설치가 완료되면, 새 터미널을 열고 다음 명령어 실행:

```bash
# 1. 이동 (eRegi 프로젝트 루트)
cd C:\Users\whhol\Documents\trae_projects\eRegi

# 2. Git 저장소 초기화
git init
git add .
git commit -m "Initial commit: eRegi project setup"

# 3. BEOKSOLUTION 리모트 추가
git remote add beok https://northamerica-northeast1-git.developerconnect.dev/853389544/BEOK/beokadm-creator-BEOKSOLUTION

# 4. 브랜치 설정 및 푸시
git branch -M main
git push -u beok main
```

## 트러블슈팅

### "git is not recognized" 오류

1. Git 재설치: **PATH** 옵션이 체크되어 있는지 확인
2. 터미널을 완전히 닫고 다시 열기
3. PC 재부팅 (PATH 업데이트에 필요할 수 있음)

### "gcloud is not recognized" 오류

1. gcloud 재설치
2. 새 터미널 열기
3. PC 재부팅

### Git 인증 오류 (401 Unauthorized)

```bash
# Git Credential Manager 재설정
git config --global credential.helper manager-core

# 또는 gcloud 인증 사용
gcloud auth login
gcloud auth application-default login
```

### 푸시 권한 오류

Google Cloud Console에서 Developer Connect 권한 확인:
1. [Google Cloud Console](https://console.cloud.google.com/) 이동
2. 프로젝트: `eregi-8fc1e`
3. **IAM & Admin** → **IAM** 이동
4. 사용자 계정이 올바른 역할을 가지고 있는지 확인

## 참고

- Git 설치 경로 (기본값): `C:\Program Files\Git`
- gcloud 설치 경로 (기본값): `C:\Users\YOUR_USERNAME\AppData\Local\Google\Cloud SDK`
