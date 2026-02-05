# 🚨 MANDATORY WORKFLOW - ALL AGENTS MUST FOLLOW 🚨

## CRITICAL RULES (ENFORCED AT MULTIPLE LAYERS)

### 🛡️ Protection System Overview

This repository uses a **3-layer protection system** to prevent rollbacks and ensure code quality:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Pre-commit Hooks (LOCAL ENFORCEMENT)               │
│  - ESLint must pass (0 errors, 0 warnings)                   │
│  - Jest Tests must pass (167 tests, 100% pass rate)          │
│  - Runs automatically on `git commit`                        │
│  - File: .husky/pre-commit                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: GitHub Branch Protection (SERVER ENFORCEMENT)       │
│  - Direct push to `main` is BLOCKED                          │
│  - Pull Request REQUIRED for all changes                     │
│  - CI/CD validation must pass before merge                    │
│  - Force push protection enabled                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: CI/CD Pipeline (AUTOMATED VALIDATION)               │
│  - ESLint check (all files)                                  │
│  - TypeScript compilation check                              │
│  - Jest test suite (167 tests)                              │
│  - Vite production build                                     │
│  - File: .github/workflows/ci.yml                            │
└─────────────────────────────────────────────────────────────┘
```

## 📋 MANDATORY PRE-WORK CHECKLIST

**BEFORE starting ANY work**, agents MUST:

1. ✅ **Read** this entire file (`MANDATORY_WORKFLOW.md`)
2. ✅ **Check** current production version in `.DEPLOYED_VERSION` file
3. ✅ **Read** `RELEASE_NOTES_v1.0.0.md` to understand baseline
4. ✅ **Create** feature branch: `git checkout -b feature/description`
5. ✅ **NEVER** work directly on `main` branch

## 🔄 MANDATORY WORKFLOW (STEP-BY-STEP)

### Step 1: Check Current State
```bash
# Check current production version
cat .DEPLOYED_VERSION

# Verify Git tag exists
git tag -l "v1.0.0"

# Check current branch (should NOT be main)
git branch --show-current
```

### Step 2: Create Feature Branch
```bash
# MANDATORY: Never work on main directly
git checkout -b feature/your-description

# Examples:
git checkout -b feature/add-user-auth
git checkout -b feature/fix-payment-error
git checkout -b feature/update-pricing-logic
```

### Step 3: Make Changes
```bash
# Work on your feature...
# Edit files, add features, fix bugs, etc.

# Before committing, run tests
npm test

# Before committing, fix linting
npm run lint
```

### Step 4: Commit Changes
```bash
# Stage changes
git add .

# Commit with conventional commit format
git commit -m "feat: add user authentication feature"
# or
git commit -m "fix: resolve payment processing error"
# or
git commit -m "docs: update API documentation"

# Pre-commit hooks will AUTOMATICALLY run:
# ✅ ESLint on staged files
# ✅ Jest tests on related files
# ❌ If any fail, commit is BLOCKED
```

### Step 5: Push to GitHub
```bash
# Push feature branch to GitHub
git push origin feature/your-description

# This will create a remote tracking branch
# GitHub will show a link to create a Pull Request
```

### Step 6: Create Pull Request
```bash
# GitHub will show: "Comparing feature/your-description → main"
# Click: "Create Pull Request"

# Fill in PR template:
# - Description of changes
# - Related issues (if any)
# - Testing performed
# - Screenshots (if UI changes)
```

### Step 7: Wait for CI/CD Validation
```bash
# CI/CD pipeline runs AUTOMATICALLY:
# ✅ ESLint (all files)
# ✅ TypeScript check
# ✅ Jest tests (167 tests)
# ✅ Vite build

# Check GitHub Actions tab for results
# Must see: ✅ "All checks have passed"
```

### Step 8: Request Review
```bash
# Assign reviewers:
# - Team member
# - Senior developer
# - Code owner

# Wait for approval
# Reviewer will check:
# - Code quality
# - Test coverage
# - Documentation
# - Breaking changes
```

### Step 9: Merge Pull Request
```bash
# ONLY after ALL checks pass:
# ✅ CI/CD passed
# ✅ Review approved
# ✅ No merge conflicts

# Click: "Merge pull request"
# Options:
# - "Create a merge commit" (recommended)
# - "Squash and merge" (clean history)
# - "Rebase and merge" (linear history)

# GitHub will automatically:
# - Merge feature branch into main
# - Delete feature branch (if configured)
```

### Step 10: Verify Deployment
```bash
# Pull latest changes
git fetch origin
git checkout main
git pull origin main

# Verify version in .DEPLOYED_VERSION
cat .DEPLOYED_VERSION

# Check if new tag was created
git tag -l
```

## 🚫 PROHIBITED ACTIONS (BLOCKED BY SYSTEM)

### ❌ Direct Commit to Main
```bash
# THIS WILL FAIL:
git checkout main
git add .
git commit -m "direct commit"
git push origin main

# ERROR: GitHub rejects with:
# "Push rejected by branch protection rule"
```

### ❌ Skipping Tests
```bash
# Pre-commit hooks will BLOCK:
git add .
git commit -m "skip tests"

# ERROR: Husky pre-commit hook fails:
# "Jest tests failed. Fix before committing."
```

### ❌ Rolling Back to Previous Version
```bash
# THIS WILL FAIL:
git reset --hard v0.9.0
git push --force

# ERROR: Tag protection prevents deletion/modification
# ERROR: Branch protection blocks force push
```

### ❌ Bypassing CI/CD
```bash
# PR cannot be merged if CI/CD fails:
# - ESLint errors: Merge button disabled
# - Test failures: Merge button disabled
# - Build failures: Merge button disabled
```

## 🚨 EMERGENCY PROCEDURES

### If You Accidentally Break Something

1. **DO NOT** try to rollback
2. **DO** create a new feature branch with fix:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b fix/emergency-bugfix
   # Fix the issue
   git add .
   git commit -m "fix: emergency bugfix"
   git push origin fix/emergency-bugfix
   # Create PR, follow normal workflow
   ```

3. **DO NOT** use `git reset --hard` on main branch
4. **DO NOT** delete or modify Git tags
5. **READ** `VERSION_CONTROL_POLICY.md` for detailed rollback prevention

### If Pre-commit Hooks Fail

1. Read the error message carefully
2. Fix the reported issues:
   - ESLint errors: Run `npm run lint -- --fix`
   - Test failures: Run `npm test` to see details
3. Try committing again
4. **DO NOT** use `git commit --no-verify` (bypasses protection)

### If CI/CD Fails on PR

1. Check GitHub Actions tab for details
2. Fix the reported issues
3. Push fix to feature branch:
   ```bash
   git add .
   git commit -m "fix: resolve CI/CD failure"
   git push
   ```
4. CI/CD will automatically re-run
5. DO NOT attempt to merge while checks are failing

## 📊 CURRENT SYSTEM STATUS

### Protection Layers: ACTIVE ✅
- Pre-commit hooks: ✅ Installed (`.husky/pre-commit`)
- GitHub Branch Protection: ⚠️ **REQUIRES MANUAL SETUP** (see `BRANCH_PROTECTION_SETUP.md`)
- CI/CD Pipeline: ✅ Configured (`.github/workflows/ci.yml`)
- Git Tag v1.0.0: ✅ Created (commit `35aaeed`)

### Test Coverage: 167 Tests ✅
- All tests passing: ✅
- Test framework: Jest (ts-jest preset)
- Coverage: 53% (utils), 7% (overall)

### Code Quality: ✅
- ESLint: Flat config (ts-eslint + react-hooks + react-refresh)
- TypeScript: Strict mode FALSE (uses schema.ts interfaces)
- No `any` types allowed (must use schema.ts interfaces)

## 🔗 RELATED DOCUMENTATION

- **`VERSION_CONTROL_POLICY.md`**: Detailed version control rules
- **`BRANCH_PROTECTION_SETUP.md`**: GitHub configuration guide
- **`RELEASE_NOTES_v1.0.0.md`**: Production baseline documentation
- **`.github/workflows/ci.yml`**: CI/CD pipeline definition
- **`.husky/pre-commit`**: Pre-commit hook script
- **`.lintstagedrc.json`**: Lint-staged configuration

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
