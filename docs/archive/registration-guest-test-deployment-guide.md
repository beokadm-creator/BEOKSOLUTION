# 비회원 등록 시나리오 테스트 - 배포 가이드

## 배포된 파일

| 파일명 | 설명 | 용도 |
|---------|---------|--------|
| `registration-guest-test-specification.md` | 테스트 사양서 | 모든 테스트 시나리오와 검증 포인트 상세 기술 |
| `registration-guest.spec.ts` | Playwright 테스트 코드 | 실제 테스트 실행 파일 |
| `registration-guest-test-verification-report.md` | 테스트 검증 리포트 | 각 테스트가 검증하는 동작 상세 설명 |

---

## 빠른 시작 가이드

### 1. Playwright 설치
```bash
npm install -D @playwright/test
```

### 2. 브라우저 설치
```bash
npx playwright install
```

### 3. 환경 변수 설정
`.env` 파일 또는 터미널 환경 변수에 설정:

```bash
BASE_URL=http://localhost:5173
TEST_SLUG=kap_2026spring
```

### 4. 개발 서버 실행
```bash
npm run dev
```

### 5. 테스트 실행
```bash
# 모든 테스트 실행
npx playwright test registration-guest.spec.ts

# 헤드리드 모드 (브라우저 표시)
npx playwright test registration-guest.spec.ts --headed

# UI 모드 (대화형)
npx playwright test registration-guest.spec.ts --ui

# 디버그 모드
npx playwright test registration-guest.spec.ts --debug
```

---

## 테스트 시나리오 요약

### 시나리오 1: 새로운 비회원 등록
**테스트 케이스**: 4개
1. 이메일 입력 후 포커스 아웃 → 토스트 확인 (새 등록)
2. 비밀번호 필드 표시 확인
3. 비밀번호 입력 후 다음 단계 진행
4. 비밀번호 길이 유효성 검사

**검증 기능**:
- 이메일 포커스 아웃 시 Firestore 쿼리 실행
- 비밀번호 필드 렌더링 (guest mode)
- 익명 계정 업그레이드 및 PENDING 등록 생성
- 비밀번호 길이 검사 (최소 6자)

---

### 시나리오 2: 이탈 후 재등록 (세션 복구)
**테스트 케이스**: 3개
1. 등록 중간에 다른 페이지로 이탈
2. 다시 등록 페이지 접속 → 세션 자동 로그아웃
3. 같은 이메일+비밀번호 입력 → 기존 등록 계속

**검증 기능**:
- localStorage 자동 저장
- 페이지 언마운트 시 세션 로그아웃
- sessionStorage 초기화
- 기존 등록 조회 및 비밀번호 모달 표시
- Cloud Function을 통한 비회원 로그인
- 모든 폼 데이터 복구

---

### 시나리오 3: 데이터 복구 (페이지 새로고침)
**테스트 케이스**: 5개
1. 기본 정보 입력 후 페이지 새로고침
2. 저장된 데이터가 복구되는지 확인
3. 만료된 데이터 처리 (24시간 경과)
4. 빈 데이터 저장 방지
5. 성공 완료 시 데이터 정리

**검증 기능**:
- localStorage에 데이터 자동 저장
- 페이지 로드 시 데이터 복구
- 24시간 유효성 검사
- 만료된 데이터 삭제
- 빈 데이터 처리 방지
- 완료 후 데이터 정리

---

### 부록: 오류 시나리오
**테스트 케이스**: 3개
1. 비밀번호 약함 (5자 미만)
2. 필수 필드 누락
3. 복구 실패 (비밀번호 불일치)

**검증 기능**:
- Firebase Auth 오류 처리 (auth/weak-password)
- 폼 유효성 검사 및 오류 토스트
- Cloud Function 실패 시 사용자 피드백

---

## 코드 참고 위치

### RegistrationPage.tsx
| 기능 | 라인 |
|--------|------|
| 이메일 포커스 아웃 핸들러 (`handleEmailBlur`) | 342-364 |
| 비밀번호 필드 렌더링 | 1301-1316 |
| localStorage 저장 useEffect | 133-143 |
| localStorage 로드 useEffect | 147-183 |
| 완료 시 데이터 정리 useEffect | 186-191 |
| 언마운트 시 로그아웃 cleanup | 776-787 |
| 익명 계정 업그레이드 | 516-573 |
| 비밀번호 약함 오류 처리 | 583-589 |

### useNonMemberAuth.ts
| 기능 | 라인 |
|--------|------|
| 세션 복구 (`useLayoutEffect`) | 28-99 |
| 로그인 함수 (`login`) | 101-172 |
| 로그아웃 함수 (`logout`) | 174-179 |

### sessionManager.ts
| 기능 | 설명 |
|--------|--------|
| 세션 유틸리티 함수들 | 세션 관리 헬퍼 |

---

## 테스트 실행 결과 해석

### 성공 지표
- ✅ 모든 테스트 케이스 통과 (15/15)
- ✅ 모든 검증 포인트 충족
- ✅ 예상된 토스트 메시지 올바르게 표시됨
- ✅ localStorage/sessionStorage 데이터 올바르게 저장/로드됨
- ✅ 세션 관리 정상 동작

### 실패 지표
- ❌ 테스트 케이스 실패
- ❌ 토스트 메시지 표시되지 않음
- ❌ 비밀번호 필드 보이지 않음
- ❌ 세션 초기화 안됨
- ❌ 기존 등록 복구 안됨
- ❌ localStorage 데이터 저장/로드 실패

---

## 문서 참고

| 문서 | 내용 | 대상 |
|-------|---------|--------|
| `registration-guest-test-specification.md` | 상세 시나리오 정의 | QA 엔지니어, 개발자 |
| `registration-guest-test-verification-report.md` | 테스트 검증 분석 | QA 엔지니어, 테스터 |
| `registration-guest.spec.ts` | 실행 가능한 테스트 코드 | 자동화 엔지니어 |
| `registration-guest-test-deployment-guide.md` (본 문서) | 배포 가이드 | 모든 사용자 |

---

## 다음 단계

### 테스트 실행
```bash
npx playwright test registration-guest.spec.ts
```

### 결과 보고서 확인
```bash
npx playwright test registration-guest.spec.ts --reporter=html
npx playwright show-report
```

### CI/CD 통합 (선택 사항)
```yaml
# .github/workflows/e2e-tests.yml 예시
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx playwright install
      - run: npx playwright test
```

---

## 지원 필요 시

### 일반적인 이슈
1. **Playwright 설치 실패**
   - 해결: `npm cache clean --force` 후 재설치

2. **테스트 타임아웃**
   - 해결: 테스트 설정의 `testTimeout` 증가

3. **Firestore 연결 실패**
   - 해결: Firebase Emulator 사용 또는 환경 변수 확인

4. **로컬 서버 접속 불가**
   - 해결: `npm run dev` 실행 상태 확인

### 문의처
- **이슈 트래커**: 프로젝트 이슈 트래커 (GitHub, Jira 등)
- **팀 채널**: 개발 팀 Slack/Teams

---

## 버전 정보
- **버전**: 1.0
- **작성일**: 2026-01-26
- **작성자**: AI Agent (Sisyphus - Ultrawork Mode)
- **프로젝트**: eRegi
- **테스트 프레임워크**: Playwright
- **언어**: TypeScript

---

## 라이센스
본 테스트 코드와 문서는 프로젝트 라이센스를 따릅니다.
