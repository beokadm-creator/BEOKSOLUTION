---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 465
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

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

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
