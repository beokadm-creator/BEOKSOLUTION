# MANDATORY WORKFLOW RULES

## 🚨 CRITICAL: All Agents MUST Follow

### Branch Protection Rules (ENFORCED)
- **`main` 브랜치로 직접 push 금지**
- **모든 변경사항은 PR로만 반영**
- **CI/CD 통과 후에만 merge 가능**

### Workflow
```bash
# 1. feature 브랜치 생성 (MANDATORY)
git checkout -b feature/description

# 2. 작업 후 commit
git add .
git commit -m "type: description"

# 3. push & PR
git push origin feature/description
# → GitHub에서 PR 생성

# 4. CI/CD 확인 (자동 실행)
# - ✅ ESLint
# - ✅ TypeScript
# - ✅ Jest Tests
# - ✅ Build

# 5. Merge (CI/CD 통과 시에만)
# GitHub에서 "Merge pull request" 클릭
```

### Violations
- **직접 commit을 main에 시도**: ❌ GitHub에서 거부됨
- **CI/CD 실패**: ❌ Merge 불가능
- **PR 없는 변경**: ❌ Branch Protection에 의해 차단

---

# AGENTS.md - eRegi AI Agent Guidelines

## Essential Commands

```bash
# Development & Build
npm run dev
npm run build
npm run lint
npm test

# 🚨 CRITICAL: Testing
npm test                      # Always run tests before commit
npm test -- --coverage       # With coverage report
npm test -- src/utils/       # Run specific tests

# Git Workflow (MANDATORY)
git checkout -b feature/...  # MANDATORY: Never work on main directly
git push origin feature/...   # Push to feature branch
# → Create PR on GitHub       # MANDATORY: PR required for all changes
```

---

## Code Style Guidelines
(이하 기존 내용 유지)
