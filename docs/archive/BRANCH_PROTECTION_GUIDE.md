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
