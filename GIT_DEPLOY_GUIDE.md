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
