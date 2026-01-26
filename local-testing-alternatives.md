# 로컬 테스트 대안 가이드

Playwright 브라우저 설치 실패 시 사용할 수 있는 대안 방법들입니다.

---

## 방법 1: Jest 테스트 (브라우저 없음)

### 장점
- 브라우저 설치 필요 없음
- 빠른 실행 속도
- CI/CD 환경에서 안정적

### 단점
- UI 상호작용 테스트 불가
- 실제 브라우저 동작 검증 안됨

### 실행 방법
```bash
# 기존 Jest 테스트 실행
npm test

# 특정 테스트 파일만 실행
npm test registration-guest.spec.ts
```

---

## 방법 2: 수동 테스트 체크리스트

### 장점
- Playwright 설치 필요 없음
- 즉시 사용 가능
- QA 엔지니어에게 명확한 가이드 제공

### 단점
- 자동화되지 않음
- 인적 오류 가능성 높음

### 사용 방법

#### 체크리스트 파일: `manual-test-checklist.md`
1. 새로운 비회원 등록 시나리오
   - [ ] 등록 페이지 접속 (`?mode=guest`)
   - [ ] 이메일 입력 후 다른 필드 클릭 (포커스 아웃)
   - [ ] "비밀번호 입력하세요" 토스트가 **없음** (새 등록이므로)
   - [ ] 비밀번호 필드가 보이는지 확인
   - [ ] 비밀번호에 6자 이상 입력
   - [ ] "다음" 버튼 클릭
   - [ ] "비회원 계정이 생성되었습니다." 토스트 확인
   - [ ] Step 2로 이동했는지 확인

2. 이탈 후 재등록 시나리오
   - [ ] 등록 페이지 접속
   - [ ] 약관 동의 후 Step 1 이동
   - [ ] 기본 정보 입력 (이름, 이메일, 전화번호, 소속, 비밀번호)
   - [ ] "다음" 클릭
   - [ ] 브라우저에서 다른 URL로 이동 (예: 뒤로가기)
   - [ ] 다시 등록 페이지 접속
   - [ ] 세션이 초기화되었는지 확인 (이전 데이터 없음)
   - [ ] 동일한 이메일 입력
   - [ ] 이메일 포커스 아웃
   - [ ] "이전에 작성하신 신청서가 있습니다. 비밀번호를 입력하여 불러오세요." 토스트 확인
   - [ ] 비밀번호 입력 모달이 표시되는지 확인
   - [ ] 동일한 비밀번호 입력
   - [ ] "불러오기" 클릭
   - [ ] "저장된 데이터를 불러왔습니다." 토스트 확인
   - [ ] 이전에 입력한 데이터들이 폼에 복원되었는지 확인
   - [ ] 이전 단계로 이동했는지 확인

3. 데이터 복구 시나리오
   - [ ] 등록 페이지 접속
   - [ ] 기본 정보 입력 (이름, 이메일, 전화번호, 소속, 비밀번호)
   - [ ] 브라우저 개발자 도구 열기 (F12)
   - [ ] Application 탭 → Local Storage 확인
   - [ ] `registration_form_{confId}_guest` 키가 있는지 확인
   - [ ] 저장된 데이터 구조 확인 (`formData`, `currentStep`, `selectedGradeId`, `timestamp`)
   - [ ] 페이지 새로고침 (F5)
   - [ ] "저장된 신청서가 불러와졌습니다." 토스트 확인
   - [ ] 모든 입력 필드에 이전 값들이 표시되는지 확인

4. 만료된 데이터 처리 확인 (24시간 경과)
   - [ ] 개발자 도구 → Application 탭 → Local Storage
   - [ ] 저장된 데이터의 `timestamp` 값을 25시간 전으로 변경
   - [ ] 페이지 새로고침
   - [ ] 데이터가 복구되지 않는지 확인
   - [ ] Local Storage에서 데이터가 삭제되었는지 확인

5. 완료 시 데이터 정리 확인
   - [ ] 등록 완료까지 진행 (Step 4)
   - [ ] Local Storage에서 `registration_form_{confId}_guest` 키가 삭제되었는지 확인
   - [ ] 페이지 새로고침 시 빈 상태로 시작하는지 확인

---

## 방법 3: Playwright 설치 재시도 (대안 다운로드)

### 1. 프록시 환경 변수 설정
```bash
# PowerShell
$env:PLAYWRIGHT_DOWNLOAD_HOST="https://playwright.azureedge.net"

# CMD
set PLAYWRIGHT_DOWNLOAD_HOST=https://playwright.azureedge.net

# .env 파일에 추가
PLAYWRIGHT_DOWNLOAD_HOST=https://playwright.azureedge.net
```

### 2. 다시 시도
```bash
npx playwright install chromium
```

### 3. 수동 다운로드 및 설치
```bash
# 1. 설치 건너뛰기
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
npx playwright install

# 2. 브라우저 수동 다운로드
# https://playwright.azureedge.net/ 접속하여 Chromium 다운로드

# 3. 수동 설치
# 다운로드한 파일을:
# C:\Users\whhol\AppData\Local\ms-playwright\chromium-1208\playwright-win64.zip
# 경로에 복사

# 4. 압축 해제 및 설치
# 압축을 해제하여 chromium-1208 폴더 생성
```

---

## 방법 4: 브라우저에서 직접 테스트

### 개발 서버 실행
```bash
npm run dev
```

### 테스트 절차

#### 시나리오 1: 새로운 비회원 등록
1. 브라우저에서 `http://localhost:5173/kap_2026spring/register?mode=guest` 접속
2. 약관 동의 체크박스들 체크
3. "다음" 버튼 클릭
4. Step 1 (기본 정보)에서 다음 필드들 입력:
   - 이름: "테스트 사용자"
   - 이메일: "test1234@example.com" (새로운 이메일)
   - 전화번호: "010-1234-5678"
   - 소속: "서울대학교병원"
   - 비밀번호: "test1234"
5. 이메일 입력 필드에서 다른 필드 클릭 (포커스 아웃)
6. **검증**: "비밀번호 입력하세요" 토스트가 표시되지 않아야 함
7. **검증**: 비밀번호 필드가 보이는지 확인
8. "다음" 버튼 클릭
9. **검증**: "비회원 계정이 생성되었습니다." 토스트가 표시되는지 확인
10. **검증**: Step 2 (회원 인증)로 이동했는지 확인

#### 시나리오 2: 이탈 후 재등록
1. 시나리오 1의 단계 1-9 수행
2. 브라우저 주소창에 다른 URL 입력 (예: `http://localhost:5173/kap_2026spring`)
3. 등록 페이지로 다시 접속 (`http://localhost:5173/kap_2026spring/register?mode=guest`)
4. **검증**: 이전에 입력한 데이터들이 폼에 없어야 함 (세션 초기화)
5. **검증**: 약관 동의 체크박스들이 체크 해제되어 있어야 함
6. 약관 동의 체크
7. "다음" 버튼 클릭
8. 이메일 필드에 동일한 이메일 입력: "test1234@example.com"
9. 이메일 필드에서 다른 필드 클릭 (포커스 아웃)
10. **검증**: "이전에 작성하신 신청서가 있습니다. 비밀번호를 입력하여 불러오세요." 토스트가 표시되는지 확인
11. **검증**: 비밀번호 입력 모달이 표시되는지 확인
12. 모달에서 동일한 비밀번호 입력: "test1234"
13. "불러오기" 버튼 클릭
14. **검증**: "저장된 데이터를 불러왔습니다." 토스트가 표시되는지 확인
15. **검증**: 모달이 닫히는지 확인
16. **검증**: 이전에 입력한 데이터들이 폼에 복원되었는지 확인 (이름, 전화번호, 소속, 비밀번호)
17. **검증**: Step 2로 이동했는지 확인 (앞서 Step 2에 도달했으므로)

#### 시나리오 3: 데이터 복구
1. 등록 페이지 접속
2. 약관 동의 후 "다음" 클릭
3. Step 1 (기본 정보)에서 필드들 입력:
   - 이름: "테스트 사용자2"
   - 이메일: "test5678@example.com"
   - 전화번호: "010-5678-1234"
   - 소속: "연세대학교의과대학병원"
   - 비밀번호: "pass5678"
4. F5 키를 눌러 페이지 새로고침
5. **검증**: "저장된 신청서가 불러와졌습니다." 토스트가 표시되는지 확인
6. **검증**: 모든 입력 필드에 이전 값들이 표시되는지 확인
7. **검증**: 약관 동의 체크박스가 체크되어 있는지 확인
8. **검증**: 개발자 도구 → Local Storage에서 `registration_form_{confId}_guest` 키가 존재하는지 확인
9. 저장된 데이터의 `timestamp` 값을 25시간 전으로 수정
10. 페이지 새로고침 (F5)
11. **검증**: 데이터가 복구되지 않는지 확인
12. **검증**: Local Storage에서 데이터가 삭제되었는지 확인

---

## 방법 5: 브라우저 개발자 도구 검증

### localStorage 데이터 구조 검증
1. 브라우저에서 등록 페이지 접속
2. 개발자 도구 열기 (F12)
3. Application 탭 → Local Storage
4. `registration_form_{confId}_guest` 키 확인
5. 데이터 구조:
   ```json
   {
     "formData": {
       "name": "테스트 사용자",
       "email": "test@example.com",
       "phone": "010-1234-5678",
       "affiliation": "서울대학교병원",
       "licenseNumber": "",
       "simplePassword": "test1234"
     },
     "currentStep": 1,
     "selectedGradeId": "",
     "timestamp": 1737884800000
   }
   ```

### sessionStorage 데이터 검증
1. Application 탭 → Session Storage
2. 비회원 로그인 후 `SESSION_KEYS.NON_MEMBER` 키 확인
3. 데이터 구조:
   ```json
   {
     "registrationId": "user_uid_here",
     "email": "test@example.com",
     "name": "테스트 사용자",
     "cid": "kap_2026spring",
     "paymentStatus": "PENDING"
   }
   ```

### Firestore 데이터 검증 (Firebase Console)
1. Firebase Console 접속
2. Firestore Database → `conferences` → `kap_2026spring` → `registrations`
3. 사용자 UID로 문서 확인
4. 필드들:
   - `status: "PENDING"`
   - `paymentStatus: "PENDING"`
   - `password: "test1234"` (비회원 로그인용)
   - `userInfo`: 사용자 정보 객체
   - `createdAt`: 생성 타임스탬프
   - `updatedAt`: 업데이트 타임스탬프

---

## 테스트 결과 기록 템플릿

### 테스트 결과 기록
```markdown
## 로컬 테스트 결과 기록

**테스트 날짜**: 2026-01-26
**테스터**: [이름]
**테스트 방법**: [수동/브라우저/Jest]

### 시나리오 1: 새로운 비회원 등록

| 단계 | 기대 결과 | 실제 결과 | 통과 여부 |
|------|----------|----------|----------|
| 이메일 포커스 아웃 시 토스트 없음 | 토스트 없음 | [ ] |
| 비밀번호 필드 보임 | 보임 | [ ] |
| 비밀번호 6자 이상 입력 후 다음 진행 가능 | 가능 | [ ] |
| 계정 생성 성공 토스트 표시 | 표시됨 | [ ] |
| Step 2로 이동 | 이동됨 | [ ] |

### 시나리오 2: 이탈 후 재등록

| 단계 | 기대 결과 | 실제 결과 | 통과 여부 |
|------|----------|----------|----------|
| 페이지 이탈 시 세션 초기화 | 초기화됨 | [ ] |
| 재접속 시 빈 상태 | 빈 상태 | [ ] |
| 기존 등록 조회 시 토스트 표시 | 표시됨 | [ ] |
| 비밀번호 모달 표시 | 표시됨 | [ ] |
| 기존 등록 복구 성공 토스트 | 성공 | [ ] |
| 데이터 복원됨 | 복원됨 | [ ] |

### 시나리오 3: 데이터 복구

| 단계 | 기대 결과 | 실제 결과 | 통과 여부 |
|------|----------|----------|----------|
| 데이터 localStorage에 저장됨 | 저장됨 | [ ] |
| 새로고침 시 복구 토스트 표시 | 표시됨 | [ ] |
| 데이터 복원됨 | 복원됨 | [ ] |
| 24시간 경과 시 데이터 삭제됨 | 삭제됨 | [ ] |

### 이슈 및 버그
| 단계 | 설명 | 심각도 | 재현 가능성 |
|------|------|--------|----------|
|      |      |        |        |

### 총괄
- **총 테스트**: [ ]개
- **통과**: [ ]개
- **실패**: [ ]개
- **통과율**: [ ]%
```

---

## 추천 테스트 순서

### 1단계: 준비
1. 개발 서버 실행 (`npm run dev`)
2. Firebase Console 접속하여 실시간 데이터 모니터링
3. 브라우저 개발자 도구 준비 (F12)

### 2단계: 기본 기능 테스트
1. 시나리오 1: 새로운 비회원 등록
2. 각 단계마다 기대 결과와 실제 결과 비교
3. 이슈 발견 시 기록

### 3단계: 세션 관리 테스트
1. 시나리오 2: 이탈 후 재등록
2. sessionStorage/localStorage 데이터 확인
3. 세션 초기화 및 복구 동작 검증

### 4단계: 데이터 복구 테스트
1. 시나리오 3: 데이터 복구
2. localStorage 데이터 구조 확인
3. 만료 처리 확인

### 5단계: 기록 및 보고
1. 테스트 결과 기록 템플릿 사용하여 기록
2. 이슈 및 버그 상세 기록
3. 팀원들과 결과 공유

---

## 추가 자원

### Firebase Emulator 사용 (선택 사항)
```bash
# Firebase Emulator 설치
npm install -g firebase-tools

# Emulator 실행
firebase emulators:start

# 환경 변수 설정
$env:FIREBASE_AUTH_EMULATOR_HOST="localhost"
$env:FIRESTORE_EMULATOR_HOST="localhost"
```

### Chrome DevTools
- **LocalStorage Viewer**: Application → Local Storage
- **SessionStorage Viewer**: Application → Session Storage
- **Network Monitor**: Network 탭에서 API 호출 확인
- **Console**: 로그 및 오류 메시지 확인

### React DevTools (선택 사항)
```bash
npm install -D react-devtools
```

---

## 결론

Playwright 브라우저 설치에 문제가 있지만, 위의 다양한 방법으로 로컬에서 테스트를 수행할 수 있습니다.

**추천 순서**:
1. **수동 테스트 체크리스트** 사용 (즉시 가능)
2. **개발 서버 실행** + **브라우저 직접 테스트** (가장 직관적)
3. **개발자 도구로 데이터 검증** (정확한 데이터 확인)
4. **Jest 테스트** (단위 테스트, 빠른 피드백)
5. **Playwright 재설치** (나중에 자동화 테스트 필요 시)

이 방법들을 통해 모든 시나리오를 검증하고 버그를 조기에 발견할 수 있습니다.
