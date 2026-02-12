# React 버전 고정 및 의존성 관리 정책

## 🚨 문제 상황
React 버전이 의도치 않게 업그레이드/다운그레이드되어 사이트 접근 불가 문제 발생

## 🎯 해결 방안

### 1. package.json에서 정확한 버전 고정

**현재 상태** (문제 있음):
```json
{
  "dependencies": {
    "react": "^19.2.0",  // ^ 기호로 인해 자동 업그레이드 가능
    "react-dom": "^19.2.0"
  }
}
```

**변경 후** (안전):
```json
{
  "dependencies": {
    "react": "19.2.0",  // 정확한 버전 고정
    "react-dom": "19.2.0"
  }
}
```

### 2. package-lock.json 커밋 필수

`package-lock.json` 파일을 반드시 Git에 커밋하여 모든 환경에서 동일한 버전 사용

```bash
# .gitignore에서 package-lock.json이 제외되지 않았는지 확인
git add package-lock.json
git commit -m "chore: lock dependency versions"
```

### 3. npm ci 사용 (npm install 대신)

배포 환경에서는 `npm ci` 사용:
```bash
# ❌ 사용하지 말 것
npm install

# ✅ 사용할 것
npm ci
```

**차이점**:
- `npm install`: package.json의 버전 범위 내에서 최신 버전 설치 가능
- `npm ci`: package-lock.json의 정확한 버전만 설치

### 4. .npmrc 설정

프로젝트 루트에 `.npmrc` 파일 생성:
```
# 정확한 버전만 설치
save-exact=true

# package-lock.json 자동 생성
package-lock=true

# 엔진 버전 체크 강제
engine-strict=true
```

### 5. package.json에 엔진 버전 명시

```json
{
  "engines": {
    "node": ">=18.0.0 <25.0.0",
    "npm": ">=9.0.0 <11.0.0"
  }
}
```

### 6. 배포 전 체크에 버전 검증 추가

`scripts/pre-deploy-check.js`에 다음 체크 추가:
- React 버전이 예상 버전과 일치하는지
- package-lock.json이 존재하는지
- node_modules가 package-lock.json과 일치하는지

## 📋 즉시 적용할 조치

### Step 1: 버전 고정
```bash
# 현재 설치된 정확한 버전 확인
npm list react react-dom

# package.json에서 ^ 제거 (정확한 버전으로 고정)
# 수동으로 편집하거나 다음 명령어 사용:
npm install --save-exact react@19.2.0 react-dom@19.2.0
```

### Step 2: .npmrc 생성
```bash
echo "save-exact=true" > .npmrc
echo "package-lock=true" >> .npmrc
echo "engine-strict=true" >> .npmrc
```

### Step 3: package-lock.json 커밋
```bash
git add package-lock.json .npmrc
git commit -m "chore: lock React version and enforce exact dependencies"
```

### Step 4: CI/CD에서 npm ci 사용
배포 스크립트에서 `npm install` → `npm ci`로 변경

## 🛡️ 재발 방지 체크리스트

### 개발 시
- [ ] 새 패키지 설치 시 `npm install --save-exact` 사용
- [ ] package-lock.json 변경 사항 항상 커밋
- [ ] 로컬에서 `npm ci`로 의존성 재설치 후 테스트

### 배포 전
- [ ] `npm run pre-deploy` 실행 (버전 체크 포함)
- [ ] React 버전이 19.2.0인지 확인
- [ ] package-lock.json이 최신 상태인지 확인

### 배포 시
- [ ] `npm ci` 사용 (npm install 사용 금지)
- [ ] node_modules 삭제 후 재설치
- [ ] 빌드 전 버전 확인

## 🔍 버전 변경이 필요한 경우

React 버전을 의도적으로 변경해야 하는 경우:

### 1. 계획 수립
- 변경 이유 문서화
- 호환성 확인 (모든 의존 패키지)
- 테스트 계획 수립

### 2. 스테이징 테스트
```bash
# 스테이징 브랜치에서
npm install --save-exact react@NEW_VERSION react-dom@NEW_VERSION
npm ci
npm run build
npm run test
```

### 3. 단계적 배포
- 스테이징 환경에서 충분히 테스트
- Feature Flag로 점진적 적용
- 롤백 계획 준비

### 4. 문서화
- CHANGELOG.md에 버전 변경 기록
- 변경 이유 및 영향 범위 문서화

## 📊 모니터링

### 배포 후 확인
```bash
# 프로덕션에서 실제 사용 중인 React 버전 확인
# 브라우저 콘솔에서:
console.log(React.version)
```

### 자동 체크
배포 전 체크 스크립트에서 자동으로 검증:
```javascript
// package.json의 React 버전
const expectedVersion = "19.2.0";

// 실제 설치된 버전
const installedVersion = require('./node_modules/react/package.json').version;

if (installedVersion !== expectedVersion) {
  console.error(`React version mismatch! Expected ${expectedVersion}, got ${installedVersion}`);
  process.exit(1);
}
```

## 🎓 Best Practices

### 1. 의존성 업데이트 주기
- **주요 버전 (Major)**: 분기별 검토, 충분한 테스트 후 적용
- **부 버전 (Minor)**: 월별 검토, 스테이징 테스트 후 적용
- **패치 버전 (Patch)**: 보안 패치는 즉시, 나머지는 주별 검토

### 2. 업데이트 프로세스
1. 로컬에서 업데이트 및 테스트
2. package-lock.json 커밋
3. 스테이징 배포 및 테스트
4. 프로덕션 배포
5. 모니터링

### 3. 롤백 준비
- 이전 버전의 package.json, package-lock.json 백업
- 빠른 롤백을 위한 Git 태그 사용

## 🚀 즉시 실행

```bash
# 1. 현재 버전 확인
npm list react react-dom

# 2. .npmrc 생성
cat > .npmrc << EOF
save-exact=true
package-lock=true
engine-strict=true
EOF

# 3. package.json 수정 (^ 제거)
# 수동으로 편집하거나 스크립트 실행

# 4. 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# 5. 테스트
npm run build
npm run test

# 6. 커밋
git add package.json package-lock.json .npmrc
git commit -m "chore: lock React version to prevent unintended upgrades"
```

## 📚 참고 자료

- [npm semver 문서](https://docs.npmjs.com/cli/v6/using-npm/semver)
- [npm ci 문서](https://docs.npmjs.com/cli/v8/commands/npm-ci)
- [package-lock.json 가이드](https://docs.npmjs.com/cli/v8/configuring-npm/package-lock-json)
