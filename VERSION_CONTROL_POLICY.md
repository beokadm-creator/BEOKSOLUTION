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
