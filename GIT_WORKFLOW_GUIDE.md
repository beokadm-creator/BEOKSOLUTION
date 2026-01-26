# Git 작업 가이드 (GitHub 연동 문제 해결)

## 현재 상황

- ✅ 코드 수정 완료 (로컬에 저장됨)
- ⚠️ GitHub 동작 안됨
- ✅ 로컬 백업 준비됨 (이미 저장된 상태)

---

## Git 작업 흐름

### 백업이 필요한 경우 ❌
```
수정된 파일 → 복사본 저장 → Git Commit
```
**지금은 이 과정이 필요 없습니다.**

### 지금 필요한 과정 ✅
```
수정된 파일 (이미 로컬에 저장됨) → Git Commit → GitHub Push
```

---

## Git 명령 (터미널에서 직접 실행)

### 1. Git 레파지토리 확인
```bash
git status
```

### 2. 변경된 파일 스테이징 (Staging Area로 이동)
```bash
git add src/pages/ConferenceDetailHome.tsx
git add src/pages/RegistrationPage.tsx
git add *.md
```

### 3. Commit 생성
```bash
git commit -m "feat: 완전한 회원/비회원 분리 구현

- ConferenceDetailHome: 비회원 감지 로직 추가 (isAnonymous 체크)
- ConferenceDetailHome: 비회원 세션 정리 로직 추가
- ConferenceDetailHome: 버튼 로직 완전 분리
- RegistrationPage: URL mode 파라미터 우선 순위 변경"
```

### 4. GitHub 원격 레파지토리 연결 확인
```bash
git remote -v
```

**출력 예시**:
```
origin  https://github.com/username/repo-name.git (fetch)
origin  https://github.com/username/repo-name.git (push)
```

**출력이 비어있으면**:
```bash
git remote add origin https://github.com/username/repo-name.git
```

### 5. GitHub로 Push
```bash
git push origin main
# 또는
git push origin master
```

---

## GitHub 웹에서 Commit/Push 방법

터미널 명령이 어려운 경우 GitHub 웹사이트에서 직접 할 수 있습니다.

### 1. GitHub 웹사이트 접근
- URL: `https://github.com/your-username/your-repo`

### 2. 파일 업로드
1. **Add file** 버튼 클릭
2. 파일 선택:
   - `src/pages/ConferenceDetailHome.tsx`
   - `src/pages/RegistrationPage.tsx`
3. 파일 내용 붙여넣기 (로컬 파일에서 복사)
4. Commit message 입력:
   ```
   feat: 완전한 회원/비회원 분리 구현
   ```
5. **Commit changes** 클릭

---

## GitHub Push 후 Firebase 배포

### GitHub 연동 배포 (추천)
Firebase가 GitHub와 연동되어 있으면 자동 배포됩니다.

1. Firebase Console → Build & Release → Continuous deployment
2. GitHub 연동 확인
3. Push 후 자동 배포 대기

### 직접 배포
```bash
firebase deploy --only hosting
```

---

## 문제 해결: GitHub 동작 안됨

### 원인 확인

#### 1. SSH 키 문제
```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```
생성된 공개키를 GitHub Settings → SSH Keys에 추가

#### 2. 인증 정보 만료
```bash
git config --global credential.helper store
```
다시 push 시 인증 정보 입력

#### 3. HTTPS vs SSH
**HTTPS**:
```bash
git remote set-url origin https://github.com/username/repo.git
```

**SSH**:
```bash
git remote set-url origin git@github.com:username/repo.git
```

---

## 현재 파일 백업 상태 확인

### 이미 저장된 파일 ✅
- `src/pages/ConferenceDetailHome.tsx` (수정됨)
- `src/pages/RegistrationPage.tsx` (수정됨)
- `MEMBER_GUEST_COMPLETE_SEPARATION.md` (새로 생성)
- `URL_MODE_LOGIC_VERIFICATION.md` (새로 생성)
- `SCENARIO_TEST_GUIDE.md` (새로 생성)
- `GIT_DEPLOY_GUIDE.md` (새로 생성)

### Git 상태로 확인
```bash
git status
```

**예상 출력**:
```
On branch main
Untracked files:
  MEMBER_GUEST_COMPLETE_SEPARATION.md
  URL_MODE_LOGIC_VERIFICATION.md
  SCENARIO_TEST_GUIDE.md
  GIT_DEPLOY_GUIDE.md

Modified files:
  src/pages/ConferenceDetailHome.tsx
  src/pages/RegistrationPage.tsx
```

---

## 추천 작업 순서

1. **터미널 열기** (프로젝트 루트 디렉토리)
2. `git status` 실행
3. `git add .` 실행 (모든 변경 사항 스테이징)
4. `git commit -m "..."` 실행
5. `git push origin main` 실행
6. Firebase 배포: `firebase deploy --only hosting`

---

## 도움링크

- [Git 기본 사용법](https://git-scm.com/docs/gittutorial)
- [GitHub SSH 키 설정](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [Firebase 배포 가이드](https://firebase.google.com/docs/hosting/deploy-cli)
