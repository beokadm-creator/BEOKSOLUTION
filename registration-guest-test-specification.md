# 비회원 등록 시나리오 테스트 사양서

## 개요
본 문서는 eRegi 비회원 등록 흐름에 대한 E2E 테스트 시나리오를 정의합니다.

## 테스트 환경
- **도구**: Playwright (브라우저 자동화)
- **언어**: TypeScript
- **범위**: 비회원 등록 (guest mode)
- **테스트 URL 패턴**: `/{slug}/register?mode=guest`

---

## 시나리오 1: 새로운 비회원 등록

### 목표
새로운 비회원이 이메일을 입력 후 포커스를 잃을 때 비밀번호 입력 안내 토스트가 표시되고, 비밀번호 입력란이 보이는지 확인합니다.

### 사전 조건
- 등록 페이지 접속 (`?mode=guest` 파라미터 필요)
- 이전에 동일 이메일로 등록된 기록 없음

### 테스트 단계

#### 1.1 이메일 입력 후 포커스 아웃 → 토스트 확인
| 단계 | 동작 | 예상 결과 |
|------|------|----------|
| 1 | 등록 페이지 접속 | Step 0 (이용약관) 표시됨 |
| 2 | 모든 필수 약관 동의 | Step 0 유효성 검사 통과 |
| 3 | '다음' 버튼 클릭 | Step 1 (기본 정보)로 이동 |
| 4 | 이메일 필드에 유효한 이메일 입력 | 이메일 값 저장됨 |
| 5 | 다른 필드 클릭하여 포커스 아웃 | `onBlur` 이벤트 발생 |
| 6 | `handleEmailBlur` 함수 실행 | Firestore에서 동일 이메일의 PENDING 등록 조회 |
| 7 | 조회 결과 없음 (새 등록) | 토스트 메시지 **없음** |

**검증 포인트**:
- 새로운 이메일인 경우 토스트가 표시되지 않아야 함
- `handleEmailBlur` 함수가 정상적으로 호출되어야 함
- Firestore 쿼리가 정상적으로 실행되어야 함

#### 1.2 비밀번호 필드 표시 확인
| 단계 | 동작 | 예상 결과 |
|------|------|----------|
| 1 | Step 1 (기본 정보) 페이지 로드 | 모든 기본 정보 필드 표시됨 |
| 2 | `mode === 'guest'` 확인 | Guest 모드임 |
| 3 | 비밀번호 필드 렌더링 확인 | 비밀번호 입력란 보임 |
| 4 | 라벨 텍스트 확인 | "비회원 조회 비밀번호 (필수)" 또는 "Guest Check Password (Required)" |
| 5 | 플레이스홀더 텍스트 확인 | "비회원 신청 내역 조회시 사용할 비밀번호" |

**검증 포인트**:
- 비밀번호 필드가 `type="password"`로 렌더링되어야 함
- 필수 표시가 있어야 함
- 플레이스홀더와 도움말 텍스트가 표시되어야 함
- `formData.simplePassword` 상태와 연결되어야 함

#### 1.3 비밀번호 입력 후 다음 단계 진행
| 단계 | 동작 | 예상 결과 |
|------|------|----------|
| 1 | 이름, 소속, 전화번호 필드 입력 | 각 필드에 값 저장됨 |
| 2 | 비밀번호 필드에 6자 이상 입력 | `formData.simplePassword` 값 설정됨 |
| 3 | '다음' 버튼 클릭 | Step 2로 이동 |
| 4 | 유효성 검사 수행 | 모든 필수 필드가 채워졌는지 확인 |
| 5 | 익명 계정 업그레이드 시도 | `EmailAuthProvider.credential`로 계정 연결 |
| 6 | Firestore에 PENDING 등록 생성 | `conferences/{confId}/registrations/{uid}` 문서 생성 |
| 7 | 성공 토스트 표시 | "비회원 계정이 생성되었습니다." 또는 "Non-member account created successfully." |

**검증 포인트**:
- 비밀번호 길이 검사 (최소 6자)
- 익명 계정 업그레이드 성공 여부
- PENDING 등록 문서가 Firestore에 생성되는지 확인
- `password` 필드가 등록 문서에 저장되는지 확인
- 성공 토스트가 표시되는지 확인

---

## 시나리오 2: 이탈 후 재등록 (세션 복구)

### 목표
등록 중간에 다른 페이지로 이탈했다가 다시 등록 페이지에 접속하면 세션이 자동 로그아웃되고, 같은 이메일+비밀번호로 기존 등록을 계속할 수 있는지 확인합니다.

### 사전 조건
- 이전에 Step 1까지 진행한 PENDING 등록이 존재
- 사용자가 이메일과 비밀번호를 기억함

### 테스트 단계

#### 2.1 등록 중간에 다른 페이지로 이탈
| 단계 | 동작 | 예상 결과 |
|------|------|----------|
| 1 | 등록 페이지 접속 (guest 모드) | 익명 계정 생성됨 |
| 2 | Step 0: 약관 동의 | `agreements` 상태 업데이트됨 |
| 3 | Step 1: 기본 정보 입력 (이름, 이메일, 전화번호, 소속, 비밀번호) | `formData` 상태 업데이트됨 |
| 4 | '다음' 버튼 클릭 | PENDING 등록 생성됨 |
| 5 | 브라우저에서 다른 URL로 이동 | RegistrationPage 언마운트 트리거 |
| 6 | `useEffect` 클린업 함수 실행 | `logoutNonMember()` 호출됨 |
| 7 | `clearNonMemberSessions()` 실행 | sessionStorage에서 `SESSION_KEYS.NON_MEMBER` 제거됨 |
| 8 | 비회원 세션 초기화 | `nonMemberRef.current = null` |

**검증 포인트**:
- 페이지 언마운트 시 `logoutNonMember()`가 호출되는지 확인
- `clearNonMemberSessions()`가 호출되는지 확인
- 세션 데이터가 정상적으로 초기화되는지 확인

#### 2.2 다시 등록 페이지 접속 → 세션 자동 로그아웃
| 단계 | 동작 | 예상 결과 |
|------|------|----------|
| 1 | 등록 페이지 재접속 (`/{slug}/register?mode=guest`) | RegistrationPage 재마운트 |
| 2 | `useNonMemberAuth` hook 실행 | `useLayoutEffect`에서 세션 복구 시도 |
| 3 | `sessionStorage.getItem(SESSION_KEYS.NON_MEMBER)` 실행 | 이전 세션이 존재하지 않음 (초기화됨) |
| 4 | `setNonMember(null)` 호출 | 비회원 세션 상태가 null |
| 5 | `nonMemberRef.current = null` | 참조도 null로 초기화 |
| 6 | `setLoading(false)` 실행 | 로딩 상태 종료 |
| 7 | 사용자에게 새로운 등록 환경 제공 | 이전 데이터 없이 깨끗한 상태 |

**검증 포인트**:
- `useNonMemberAuth`의 `useLayoutEffect`가 올바르게 동작하는지 확인
- 세션이 초기화되었으므로 자동 복구가 일어나지 않는지 확인
- 사용자가 새로운 등록을 시작할 수 있는 상태인지 확인

#### 2.3 같은 이메일+비밀번호 입력 → 기존 등록 계속
| 단계 | 동작 | 예상 결과 |
|------|------|----------|
| 1 | Step 0: 약관 동의 완료 | 유효성 검사 통과 |
| 2 | Step 1로 이동 | 기본 정보 입력 폼 표시 |
| 3 | 이전과 동일한 이메일 입력 | `formData.email` 값 설정 |
| 4 | 이메일 필드 포커스 아웃 | `handleEmailBlur` 호출 |
| 5 | Firestore 쿼리 실행 | `conferences/{confId}/registrations`에서 동일 이메일의 PENDING 등록 조회 |
| 6 | 등록 레코드 발견 | `snap.empty === false` |
| 7 | 토스트 표시 | "이전에 작성하신 신청서가 있습니다. 비밀번호를 입력하여 불러오세요." |
| 8 | `setShowPasswordModal(true)` 실행 | 비밀번호 입력 모달 표시됨 |
| 9 | 모달에서 비밀번호 입력 | `resumePassword` 상태 설정 |
| 10 | '불러오기' 버튼 클릭 | `handleResumeRegistration` 실행 |
| 11 | `useNonMemberAuth.login(email, password, confId)` 호출 | Cloud Function `resumeGuestRegistration` 호출 |
| 12 | 인증 성공 | `responseData.registrationId` 반환 |
| 13 | `sessionStorage.setItem(...)` 실행 | 새로운 세션 저장 |
| 14 | `setNonMember(newSession)` 실행 | 비회원 세션 상태 업데이트 |
| 15 | `resumeRegistration(currentUser.uid)` 호출 | 저장된 등록 데이터 불러옴 |
| 16 | 폼 데이터 복원 | `setFormData`, `setAgreements`, `setIsVerified` 등 호출 |
| 17 | `setCurrentStep(saved.currentStep)` 실행 | 이전 단계로 이동 |
| 18 | 성공 토스트 표시 | "저장된 데이터를 불러왔습니다." |
| 19 | `setShowPasswordModal(false)` | 모달 닫힘 |

**검증 포인트**:
- 이메일 포커스 아웃 시 토스트가 올바르게 표시되는지 확인
- 비밀번호 모달이 올바르게 렌더링되는지 확인
- Cloud Function 호출이 성공하는지 확인
- 세션이 올바르게 저장되는지 확인
- 모든 폼 데이터가 올바르게 복원되는지 확인
- 현재 단계가 올바르게 복원되는지 확인
- 사용자가 이전 단계에서 계속할 수 있는지 확인

---

## 시나리오 3: 데이터 복구 (페이지 새로고침)

### 목표
기본 정보 입력 후 페이지를 새로고침하면 저장된 데이터가 복구되는지 확인합니다.

### 사전 조건
- 등록 페이지 접속
- localStorage에 저장할만큼의 기본 정보 입력

### 테스트 단계

#### 3.1 기본 정보 입력 후 페이지 새로고침
| 단계 | 동작 | 예상 결과 |
|------|------|----------|
| 1 | 등록 페이지 접속 (guest 모드) | 초기 상태로 시작 |
| 2 | Step 0: 약관 동의 | `agreements` 상태 업데이트 |
| 3 | Step 1로 이동 | 기본 정보 입력 폼 표시 |
| 4 | 이름 입력: "홍길동" | `formData.name = "홍길동"` |
| 5 | 이메일 입력: "test@example.com" | `formData.email = "test@example.com"` |
| 6 | 전화번호 입력: "010-1234-5678" | `formData.phone = "010-1234-5678"` |
| 7 | 소속 입력: "서울대학교병원" | `formData.affiliation = "서울대학교병원"` |
| 8 | 비밀번호 입력: "test1234" | `formData.simplePassword = "test1234"` |
| 9 | `useEffect` 트리거 | `formData` 변경 감지 |
| 10 | `getStorageKey()` 실행 | `"registration_form_{confId}_guest"` 키 생성 |
| 11 | `localStorage.setItem(storageKey, JSON.stringify(...))` 실행 | 데이터 저장됨 |
| 12 | 저장 데이터 구조 | `{ formData, currentStep, selectedGradeId, timestamp }` |
| 13 | 브라우저 새로고침 (F5 또는 Ctrl+R) | 페이지 리로드 |

**검증 포인트**:
- `useEffect`가 `formData`, `currentStep`, `selectedGradeId`, `confId`, `mode` 변경 시 실행되는지 확인
- localStorage에 올바른 데이터 구조로 저장되는지 확인
- 타임스탬프가 저장되는지 확인
- 저장된 데이터가 정상적으로 직렬화되는지 확인

#### 3.2 저장된 데이터가 복구되는지 확인
| 단계 | 동작 | 예상 결과 |
|------|------|----------|
| 1 | 페이지 리로드 완료 | RegistrationPage 재마운트 |
| 2 | `useEffect` (마운트 시) 실행 | `confId && mode === 'guest'` 확인 |
| 3 | `getStorageKey()` 실행 | 저장된 키와 동일 |
| 4 | `localStorage.getItem(storageKey)` 실행 | 저장된 데이터 가져옴 |
| 5 | `JSON.parse(saved)` 실행 | 데이터 파싱 |
| 6 | 타임스탬프 검증 | `Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000` |
| 7 | 24시간 이내인지 확인 | `isRecent = true` |
| 8 | `parsed.formData` 확인 | 이전에 입력한 데이터 존재 |
| 9 | `Object.values(parsed.formData).some(v => v && v.toString().trim() !== '')` 실행 | 데이터 유무 확인 |
| 10 | `hasData = true` | 저장된 데이터가 있음 |
| 11 | `setFormData(parsed.formData)` 실행 | 폼 데이터 복원 |
| 12 | `setCurrentStep(parsed.currentStep)` 실행 | 이전 단계로 복원 |
| 13 | `setSelectedGradeId(parsed.selectedGradeId)` 실행 | 선택한 등급 복원 |
| 14 | 토스트 표시 | "저장된 신청서가 불러와졌습니다." 또는 "Saved application loaded." |
| 15 | 입력 필드 확인 | 모든 필드에 이전 값들이 표시됨 |
| 16 | 현재 단계 확인 | 이전 단계로 이동해 있음 |

**검증 포인트**:
- localStorage에서 데이터가 올바르게 로드되는지 확인
- 24시간 유효성 검사가 올바르게 동작하는지 확인
- 빈 데이터가 저장된 경우 복원되지 않는지 확인
- 폼 데이터가 올바르게 복원되는지 확인
- 현재 단계가 올바르게 복원되는지 확인
- 사용자에게 알림 토스트가 표시되는지 확인
- 복원된 데이터가 입력 필드에 올바르게 표시되는지 확인

#### 3.3 만료된 데이터 처리
| 단계 | 동작 | 예상 결과 |
|------|------|----------|
| 1 | localStorage에 25시간 전 타임스탬프의 데이터 저장 | 오래된 데이터 |
| 2 | 페이지 새로고침 | 리로드 |
| 3 | `localStorage.getItem()` 실행 | 오래된 데이터 가져옴 |
| 4 | `Date.now() - parsed.timestamp` 계산 | 25시간 이상 경과 |
| 5 | `isRecent = false` | 데이터 만료됨 |
| 6 | `localStorage.removeItem(storageKey)` 실행 | 만료된 데이터 삭제 |
| 7 | 새로운 빈 상태로 시작 | 초기 폼 상태 |

**검증 포인트**:
- 24시간이 지난 데이터가 삭제되는지 확인
- 만료된 데이터가 복원되지 않는지 확인
- 빈 데이터가 저장된 경우 localStorage에서 제거되는지 확인

#### 3.4 성공 완료 시 데이터 정리
| 단계 | 동작 | 예상 결과 |
|------|------|----------|
| 1 | 등록 완료까지 진행 | Step 4 (Complete) 도달 |
| 2 | `currentStep === 4` 감지 | 완료 단계 |
| 3 | `useEffect` 실행 | 완료 감지 |
| 4 | `localStorage.removeItem(storageKey)` 실행 | 저장된 데이터 삭제 |
| 5 | 재접속 시도 | 빈 상태로 시작 |

**검증 포인트**:
- 완료 후 localStorage가 정리되는지 확인
- 사용자가 재접속 시 빈 상태로 시작하는지 확인

---

## 테스트 검증 기준

### 성공 기준
- 모든 테스트 케이스가 통과할 것
- 모든 검증 포인트가 충족될 것
- 예상된 토스트 메시지가 올바른 시점에 표시될 것
- localStorage/sessionStorage 데이터가 올바르게 저장/로드될 것
- 페이지 간 전환 시 세션이 올바르게 관리될 것
- 데이터 복구가 정확하고 완전하게 이루어질 것

### 실패 기준
- 토스트가 표시되지 않거나 잘못된 시점에 표시될 때
- 비밀번호 필드가 올바르게 표시되지 않을 때
- 세션이 자동 로그아웃되지 않을 때
- 기존 등록이 복구되지 않을 때
- localStorage 데이터가 저장/로드되지 않을 때
- 페이지 새로고침 시 데이터가 손실될 때
- 만료된 데이터가 복구될 때

---

## 테스트 실행 방법

### 사전 준비
1. Playwright 설치: `npm install -D @playwright/test`
2. Playwright 브라우저 설치: `npx playwright install`
3. 테스트 설정 파일 생성: `playwright.config.ts`

### 실행 명령어
```bash
# 모든 테스트 실행
npx playwright test

# 헤드리드 모드 실행
npx playwright test --headed

# 특정 테스트 파일만 실행
npx playwright test registration-guest.spec.ts

# UI 모드 실행
npx playwright test --ui

# 디버그 모드 실행
npx playwright test --debug
```

### 테스트 보고서
```bash
# HTML 보고서 생성
npx playwright test --reporter=html

# 보고서 열기
npx playwright show-report
```

---

## 기술적 참고 사항

### 코드 참고 위치
- **등록 페이지**: `src/pages/RegistrationPage.tsx`
  - 이메일 포커스 아웃 핸들러: `handleEmailBlur` (라인 342-364)
  - 비밀번호 필드 렌더링: 라인 1301-1316
  - localStorage 저장: 라인 133-143
  - localStorage 로드: 라인 147-183
  - 데이터 정리: 라인 186-191
  - 언마운트 시 로그아웃: 라인 776-787

- **비회원 인증 Hook**: `src/hooks/useNonMemberAuth.ts`
  - 세션 복구: 라인 28-99
  - 로그인 함수: 라인 101-172
  - 로그아웃 함수: 라인 174-179

- **세션 관리**: `src/utils/sessionManager.ts`
  - 세션 유틸리티 함수들

### 주요 상태 변수
- `formData`: 이름, 이메일, 전화번호, 소속, 면허번호, 비밀번호
- `agreements`: 약관 동의 상태
- `currentStep`: 현재 등록 단계
- `selectedGradeId`: 선택한 등급
- `showPasswordModal`: 비밀번호 입력 모달 표시 상태
- `resumePassword`: 복구 시 입력할 비밀번호

### 스토리지 키
- **localStorage**: `registration_form_{confId}_{mode}`
- **sessionStorage**: `SESSION_KEYS.NON_MEMBER`

### Firestore 쿼리
```typescript
// 이메일로 PENDING 등록 조회
query(
  collection(db, `conferences/${confId}/registrations`),
  where('email', '==', email),
  where('status', '==', 'PENDING')
)
```

### Cloud Function
- **resumeGuestRegistration**: 비회원 로그인 및 등록 복구

---

## 테스트 커버리지

### 커버되는 기능
- [x] 이메일 포커스 아웃 시 토스트 표시
- [x] 비밀번호 필드 렌더링
- [x] 비밀번호 입력 및 유효성 검사
- [x] 익명 계정 업그레이드
- [x] PENDING 등록 생성
- [x] 페이지 언마운트 시 세션 로그아웃
- [x] 세션 자동 복구 방지
- [x] 기존 등록 조회 및 복구
- [x] localStorage 자동 저장
- [x] localStorage 데이터 복구
- [x] 만료 데이터 처리
- [x] 완료 시 데이터 정리

### 커버되지 않는 기능
- [ ] 결제 흐름 (별도 시나리오 필요)
- [ ] 회원 인증 흐름 (별도 시나리오 필요)
- [ ] 멤버코드 검증 (별도 시나리오 필요)
- [ ] 등록 후 관리자 확인 페이지 (별도 시나리오 필요)

---

## 부록: 오류 시나리오

### 오류 1: 이메일 중복 (기존 회원)
| 상황 | 예상 동작 |
|------|----------|
| 기존 회원의 이메일로 등록 시도 | "이미 사용 중인 이메일입니다. 다른 이메일을 사용하거나 기존 계정으로 로그인해주세요." 토스트 |

### 오류 2: 비밀번호 약함
| 상황 | 예상 동작 |
|------|----------|
| 5자 미만 비밀번호 입력 | "비밀번호가 너무 약합니다. 6자 이상 입력해주세요." 토스트 |

### 오류 3: 유효하지 않은 이메일
| 상황 | 예상 동작 |
|------|----------|
| 잘못된 이메일 형식 입력 | "유효하지 않은 이메일 형식입니다." 토스트 |

### 오류 4: 복구 실패 (비밀번호 불일치)
| 상황 | 예상 동작 |
|------|----------|
| 잘못된 비밀번호로 복구 시도 | "등록된 이메일 정보를 찾을 수 없거나 비밀번호가 일치하지 않습니다." 토스트 |

---

## 문서 버전
- **버전**: 1.0
- **작성일**: 2026-01-26
- **최종 수정**: 2026-01-26
- **작성자**: AI Agent (Sisyphus - Ultrawork Mode)
