# GitHub 브랜치 보호 규칙 설정 가이드

## 문제점
현재 CI/CD가 실패를 무시하고 있어서 린트 오류가 있는 코드도 배포되고 있습니다.

## 즉시 설정해야 할 브랜치 보호 규칙

### 1. GitHub Repository Settings 진입
```
https://github.com/beokadm-creator/BEOKSOLUTION/settings/branches
```

### 2. main 브랜치 보호 규칙 추가

**Branch name:** `main`

**설정 항목:**
- ✅ **Require a pull request before merging** (필수)
  - ✅ Require approvals: **1** 개 이상
  - ✅ Dismiss stale reviews when new commits are pushed
  - ✅ Require review from CODEOWNERS (선택)

- ✅ **Require status checks to pass before merging** (필수)
  - ✅ Require branches to be up to date before merging
  - 필수 체크항목:
    - `ESLint` (CI workflow)
    - `TypeScript Type Check` (CI workflow)
    - `Jest Tests` (CI workflow)
    - `Build Check` (CI workflow)

- ❌ **Do not allow bypassing the above settings** (관리자 포함)
- ✅ **Require conversation resolution before merging**

### 3. develop 브랜치 보호 규칙 (같은 설정 적용)

**Branch name:** `develop`

**설정항목:** main과 동일

---

## 현재 작업 중인 브랜치 안전하게 PR 생성

### 현재 상황
```bash
# 현재 브랜치: feature/restore-badge-background
# 스테이징된 파일들:
# - ConfLayout.tsx (New)
# - BadgeEditorPage.tsx (Modified)
# - BadgeManagementPage.tsx (New)
# - RegistrationListPage.tsx (Modified)
```

### 안전한 PR 워크플로우

1. **커밋 및 푸시**
```bash
git add .
git commit -m "fix: restore badge background functionality"
git push -u origin feature/restore-badge-background
```

2. **PR 생성** (GitHub 웹 또는 gh CLI)
```bash
# gh CLI가 설치된 경우:
gh pr create \
  --title "fix: restore badge background functionality" \
  --body "## 변경 사항\n- 배지 배경 복원\n- 관련 이슈: #" \
  --base develop \
  --repo beokadm-creator/BEOKSOLUTION
```

3. **CI 확인**
   - GitHub Actions 탭에서 4가지 체크가 모두 통과하는지 확인
   - ESLint: ✅
   - TypeScript: ✅
   - Tests: ✅
   - Build: ✅

4. **코드 리뷰 및 머지**
   - 모든 체크 통과 후 리뷰 요청
   - 승인 후 develop 브랜치에 머지

---

## 향후 작업 프로세스

### ✅ 올바른 워크플로우
```
1. feature 브랜치 생성
2. 작업 및 커밋
3. PR 생성 (→ CI 자동 실행)
4. CI 4가지 체크 모두 통과 확인
5. 코드 리뷰
6. 머지
7. develop → main 배포
```

### ❌ 하지 말아야 할 것들
```bash
# 절대 금지:
git checkout main
git commit -m "hotfix"
git push origin main  # ❌ 브랜치 보호 규칙으로 막혀야 함

# 우회 금지:
git push --force  # ❌ 강제 푸시
git commit --no-verify  # ❌ pre-commit hook 우회
```

---

## 핫픽스 예외 프로세스 (긴급 상황만)

만약 운영 환경의 치명적인 버그를 즉시 수정해야 한다면:

1. **긴급 브랜치 사용**
```bash
git checkout -b hotfix/critical-bug-fix
# 수정 후 PR 생성
```

2. **리뷰어 1명 승인 후 즉시 머지**
3. **배포 후 포스트모템 작성**

---

## CI/CD 설정 변경 완료

### 수정된 내용
```yaml
# 변경 전 (❌ 위험)
continue-on-error: true

# 변경 후 (✅ 안전)
continue-on-error: false
```

이제 ESLint 실패 시 CI가 즉시 중단됩니다.

---

## 다음 단계

1. **브랜치 보호 규칙 설정** (위 가이드 참조)
2. **현재 feature 브랜치를 PR로 전환**
3. **CI 통과 확인**
4. **안전하게 머지**
# eRegi Branch Protection Setup Guide

## 🚨 목적
모든 에이전트가 **PR로만** 코드를 반영하도록 강제합니다. main 브랜치로의 직접 push를 차단합니다.

---

## GitHub 설정 방법

### 1단계: GitHub 레포지토리 설정 이동
```
https://github.com/[username]/eRegi/settings/branches
```

### 2단계: Branch Protection Rule 추가
1. **"Add rule"** 버튼 클릭
2. **Branch name pattern**: `main` 입력
3. 아래 옵션들을 모두 체크:

```yaml
✅ Require a pull request before merging
   ✅ Require approvals: 1
   ✅ Dismiss stale reviews when new commits are pushed

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   다음 체크리스트에서 필수로 선택:
   ✅ ESLint
   ✅ TypeScript Type Check
   ✅ Jest Tests
   ✅ Build Check

✅ Require conversation resolution before merging
   ✅ Do not allow bypassing the above settings
```

### 3단계: 저장
**"Create"** 또는 **"Save changes"** 클릭

---

## 효과 확인

### ❌ 차단됨 (보호됨)
```bash
git push origin main

# GitHub 에러 메시지:
# remote: error: GH006: Protected branch update failed for refs/heads/main.
# remote: error: Cannot push to a protected branch
# To [github.com:username/eRegi.git]
#  ! [rejected]        main -> main (pre-receive hook declined)
```

### ✅ 허용됨 (PR만 가능)
```bash
git checkout -b feature/new-feature
git push origin feature/new-feature
# → GitHub에서 PR 생성 → Merge 버튼 활성화
```

---

## 참고: PR 생성 후 자동 실행되는 CI/CD

PR 생성 후 자동으로 다음을 실행합니다:
1. ✅ ESLint 체크
2. ✅ TypeScript 컴파일 체크
3. ✅ Jest 테스트 (167개)
4. ✅ Vite 빌드 확인

모두 통과해야만 Merge 버튼이 활성화됩니다.

---

## 완료 확인

설정 후 다음을 시도해보세요:
```bash
# 테스트: main에 직접 push 시도 (차단되어야 함)
git push origin main

# → "protected branch update failed" 에러 발생하면 성공!
```
# Git Commit & Firebase 배포 가이드

## Git 상태 확인

수정된 파일:
1. `src/pages/ConferenceDetailHome.tsx`
   - 비회원 감지 로직 추가 (`isAnonymous` 체크)
   - 비회원 세션 정리 로직 추가
   - 버튼 로직 완전 분리 (회원/비회원)

2. `src/pages/RegistrationPage.tsx`
   - URL mode 파라미터 우선 순위 변경
   - `modeFromUrl || (auth.user && !isAnonymous ? 'member' : 'guest')`

3. 추가된 문서:
   - `MEMBER_GUEST_COMPLETE_SEPARATION.md` - 전체 분리 로직 설명
   - `URL_MODE_LOGIC_VERIFICATION.md` - URL 진입 로직 검증
   - `SCENARIO_TEST_GUIDE.md` - 시나리오 테스트 가이드

---

## Git Commit 명령 (수동 실행)

### 1. Git 상태 확인
```bash
git status
```

### 2. 변경 사항 확인
```bash
git diff src/pages/ConferenceDetailHome.tsx
git diff src/pages/RegistrationPage.tsx
```

### 3. Commit 생성
```bash
git add src/pages/ConferenceDetailHome.tsx
git add src/pages/RegistrationPage.tsx
git add MEMBER_GUEST_COMPLETE_SEPARATION.md
git add URL_MODE_LOGIC_VERIFICATION.md
git add SCENARIO_TEST_GUIDE.md
git commit -m "feat: 완전한 회원/비회원 분리 구현

- ConferenceDetailHome: 비회원 감지 로직 추가 (isAnonymous 체크)
- ConferenceDetailHome: 비회원 세션 정리 로직 추가 (페이지 mount 시)
- ConferenceDetailHome: 버튼 로직 완전 분리
  - 비회원: 무조건 ?mode=guest로 이동
  - 회원: ?mode=member로 이동
- RegistrationPage: URL mode 파라미터 우선 순위 변경
  - ?mode=member: 무조건 회원 모드
  - ?mode=guest: 무조건 비회원 모드
  - mode 없음: 로그인 상태로 fallback
- 비회원이 페이지를 나갔다가 재접근 시 '등록확인' 대신 '등록하기' 버튼 표시
- URL mode 파라미터를 신뢰하도록 로직 수정
- 전체 시나리오 테스트 가이드 작성 (SCENARIO_TEST_GUIDE.md)
"
```

---

## Firebase 배포 명령

### 방법 1: Hosting만 배포 (빠름)
```bash
firebase deploy --only hosting
```

### 방법 2: 전체 배포 (Functions, Hosting, Rules 등)
```bash
firebase deploy
```

### 방법 3: 특정 타겟만 배포
```bash
# KADD 도메인만 배포
firebase deploy --only hosting:kadd

# 또는
firebase deploy --only hosting:kadd,hosting:kap
```

---

## 배포 후 테스트

배포 완료 후 `SCENARIO_TEST_GUIDE.md`에 따라 시나리오 테스트를 진행하세요.

테스트 도메인: `https://kadd.eregi.co.kr/2026spring`

---

## 배포 확인 방법

### Firebase Console
1. Firebase Console → Hosting → 도메인 확인
2. 최근 배포 기록 확인

### 브라우저
1. 배포 URL 접근
2. 개발자 도구 (F12) → Network 탭 → Disable cache 체크
3. Ctrl+Shift+R 강력 새로고침
4. 새로운 코드가 적용되었는지 확인

---

## 문제 해결

### Git 관련 문제

**오류**: `export is not recognized`
- **원인**: Windows cmd 환경에서 bash export 명령이 작동하지 않음
- **해결**: 위 명령을 직접 복사하여 터미널에서 실행

### Firebase 배포 관련 문제

**오류**: `firebase: Error: No project active`
- **원인**: firebase 프로젝트가 설정되지 않음
- **해결**:
  ```bash
  firebase use eregi-korea-firebase
  ```

**오류**: `Error: Could not find a Firebase project`
- **원인**: .firebaserc 또는 firebase.json 파일 누락
- **해결**: 프로젝트 루트에서 명령 실행 확인

---

## 완료 체크리스트

- [ ] Git commit 완료
- [ ] Firebase 배포 완료
- [ ] 배포 URL 접근 가능 확인
- [ ] 시나리오 테스트 가이드에 따라 모든 시나리오 테스트 완료
- [ ] 모든 시나리오 테스트 통과 확인
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
# 🛡️ MANDATORY WORKFLOW - Version Control

**목적**: 이전 버전으로의 롤백 방지, 안전한 배포 관리

---

## 🚨 CRITICAL RULES

### 1. 버전 확인 필수
```bash
# 작업 시작 전에 항상 확인
cat .DEPLOYED_VERSION
git log --oneline -5
git tag
```

### 2. 절대 금지 사항
```bash
# ❌ NEVER DO THIS
git reset --hard HEAD~5  # 이전 커밋으로 되돌리기
git checkout 0bd59e5     # 예전 커밋로 체크아웃
git push -f origin main    # 강제 푸시
```

### 3. 올바른 작업 흐름
```bash
# ✅ ALWAYS DO THIS
git pull origin main           # 최신 변경사항 가져오기
git checkout -b feature/xxx    # feature 브랜치 생성
# ... 작업 ...
git push origin feature/xxx     # PR 생성
# CI/CD 통과 후 Merge
```

---

## 📋 작업 전 체크리스트

### 시작하기 전
- [ ] `.DEPLOYED_VERSION` 확인 (현재 배포된 버전)
- [ ] 최신 커밋 확인 (`git log --oneline -5`)
- [ ] Git 태그 확인 (`git tag`)

### 작업 중
- [ ] feature 브랜치에서만 작업
- [ ] 커밋 메시지 명확하게
- [ ] 테스트 통과 확인

### 작업 후
- [ ] PR 생성 (절대 main에 직접 push 금지)
- [ ] CI/CD 모두 ✅ 확인
- [ ] Merge 후 태그 업데이트 (v1.0.1, v1.1.0 등)

---

## 🔒 버전 관리 정책

### 현재 배포된 버전
```
v1.0.0 (commit: 35aaeed)
```

### 다음 버전 규칙 (SemVer)
- **Bug fix**: v1.0.1 (PATCH)
- **New feature**: v1.1.0 (MINOR)
- **Breaking change**: v2.0.0 (MAJOR)

### 태그 생성 방법
```bash
# Production 배포 시에만 태그 생성
git tag -a v1.0.1 -m "Release v1.0.1 - Bug fix summary"
git push origin v1.0.1

# .DEPLOYED_VERSION 업데이트
echo "v1.0.1" > .DEPLOYED_VERSION
git add .DEPLOYED_VERSION
git commit -m "chore: Update deployed version to v1.0.1"
git push origin main
```

---

## 🚨 롤백 방지 시나리오

### 시나리오 1: 에이전트가 예전 커밋을 체크아웃
```bash
# ❌ 에이전트가 실수로 실행
git checkout 0bd59e5  # 5커밋 전으로 되돌림

# ✅ 방지됨
# - CI/CD에서 빌드 실패
# - .DEPLOYED_VERSION 불일치로 감지
# - PR 불가능
```

### 시나리오 2: 강제로 푸시하려고 시도
```bash
# ❌ 에이전트가 시도
git push -f origin main

# ✅ 방지됨
# - GitHub Branch Protection에 의해 차단
# - "protected branch update failed" 에러
```

### 시나리오 3: 예전 빌드를 다시 배포
```bash
# ❌ 시나리오
npm run build  # 예전 소스로 빌드
firebase deploy  # 구 버전 배포

# ✅ 방지됨
# - .DEPLOYED_VERSION 체크로 감지
# - Git 태그 없으면 경고
# - CI/CD에서 미리 차단
```

---

## 📞 문제 발생 시

### "롤백하고 싶은데 어떻게?"
→ ❌ 롤백하지 마세요. 대신 **forward fix** 하세요.

### "예전 버전으로 되돌아가고 싶은데?"
→ ❌ 안 됩니다. Git 히스토리를 존중하세요.

### "버그가 발생했는데?"
→ ✅ 새로운 feature 브랜치에서 수정 후 PR 생성

---

**핵심**: 항상 앞으로 전진하세요. 롤백은 금지입니다.
