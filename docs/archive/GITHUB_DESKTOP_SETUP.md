# GitHub Desktop으로 BEOKSOLUTION 저장소 연결

## 방법 1: GitHub Desktop GUI 사용 (추천)

### 1단계: GitHub Desktop 열기

1. **GitHub Desktop** 앱 실행
2. **File** → **Add Local Repository...** 클릭
3. **Choose...** → `C:\Users\whhol\Documents\trae_projects\eRegi` 선택
4. **Add** 클릭

### 2단계: 초기 커밋 만들기

1. GitHub Desktop에서 변경 사항 확인
2. **Commit to main** 또는 **Commit** 클릭
3. 메시지 입력: `Initial commit: eRegi project setup`
4. **Commit** 클릭

### 3단계: 원격 저장소 연결

1. GitHub Desktop에서 **Repository** → **Repository Settings...** 클릭
2. **Remote** 탭 → **Remote repository** 드롭다운 클릭
3. **Add Remote...** 클릭
4. **Name**: `beok`
5. **URL**: `https://northamerica-northeast1-git.developerconnect.dev/853389544/BEOK/beokadm-creator-BEOKSOLUTION`
6. **Save** 클릭

### 4단계: 푸시

1. GitHub Desktop 메인 화면으로 돌아가기
2. **Publish repository** 또는 **Publish branch** 버튼 클릭
   - 원격 브랜치 이름: `main`
3. **Publish** 클릭

## 방법 2: GitHub Desktop 내의 Git 명령어 사용

GitHub Desktop이 Git을 포함하고 있으므로, Git 경로를 사용하여 명령어를 실행할 수 있습니다.

### 1단계: GitHub Desktop 내 Git 경로 찾기

일반적으로 다음 경로에 있습니다:
```
C:\Users\{username}\AppData\Local\GitHubDesktop\app-{version}\resources\app\git\cmd\git.exe
```

### 2단계: CMD에서 Git 명령어 실행

**PowerShell 또는 CMD**에서:

```bash
# 1. 프로젝트 디렉토리로 이동
cd C:\Users\whhol\Documents\trae_projects\eRegi

# 2. GitHub Desktop의 Git 경로 사용 (전체 경로 필요)
"C:\Users\whhol\AppData\Local\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" init

# 또는 GitHub Desktop이 설치된 일반적인 경로
"C:\Program Files\Git\bin\git.exe" init
```

GitHub Desktop 버전에 따라 경로가 다를 수 있으니, 다음으로 찾아보세요:

```bash
# GitHub Desktop Git 경로 확인 (PowerShell)
Get-ChildItem -Path "C:\Users\whhol\AppData\Local\GitHubDesktop" -Filter git.exe -Recurse -ErrorAction SilentlyContinue
```

## 방법 3: GitHub Desktop + Open in Terminal

GitHub Desktop 내에서 터미널을 여는 방법:

1. GitHub Desktop에서 eRegi 저장소 열기
2. **Repository** → **Open in Terminal** 클릭
3. 열린 터미널에서 명령어 실행

이 터미널은 GitHub Desktop이 관리하는 Git 환경을 사용하므로 정상적으로 작동합니다.

## 전체 명령어 (터미널이 열리면)

```bash
# 1. 초기화
git init

# 2. 사용자 정보 설정 (최초 한 번만 필요)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 3. 파일 추가 및 커밋
git add .
git commit -m "Initial commit: eRegi project setup"

# 4. 원격 저장소 추가
git remote add beok https://northamerica-northeast1-git.developerconnect.dev/853389544/BEOK/beokadm-creator-BEOKSOLUTION

# 5. 푸시
git branch -M main
git push -u beok main
```

## 인증 설정

### GitHub Desktop에서 인증

1. **GitHub Desktop** → **File** → **Options...** (Windows) 또는 **Preferences...** (Mac)
2. **Git** 탭
3. **Authentication** → GitHub 계정 로그인

### gcloud 인증 (터미널에서 별도 필요)

```bash
# Google Cloud 인증 (터미널에서)
gcloud auth login
```

gcloud가 설치되어 있지 않다면:
https://cloud.google.com/sdk/docs/install#windows

## 추천 순서

1. **방법 1 (GUI)**: 가장 쉬움 - GitHub Desktop의 그래픽 인터페이스 사용
2. **방법 3 (터미널)**: GitHub Desktop 내 터미널 사용
3. **방법 2 (직접 경로)**: Git 전체 경로를 사용하여 명령어 실행
