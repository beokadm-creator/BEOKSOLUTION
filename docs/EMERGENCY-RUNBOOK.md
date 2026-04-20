# 🚨 BEOKSOLUTION EMERGENCY RUNBOOK 🚨

이 문서는 라이브 행사(이벤트) 운영 중 발생할 수 있는 긴급 상황과 그 대응 방법을 담고 있습니다.
행사 기간 중 이슈 발생 시, 아래의 템플릿과 명령어를 즉시 복사하여 대응하십시오.

---

## ⛔ 절대 금지 사항 (라이브 중)

1. **백엔드 함수 전체 재배포 주의** (업데이트됨: P0-1 완료 후 안전화)
   - 명령어: `firebase deploy --only functions` ⚠️ (주의 필요, 더 이상 절대 금지는 아님)
   - 현재 상태: P0-1 정리 완료로 45개 함수가 모두 배포되었고 주석 처리된 export는 없습니다.
   - 그래도 라이브 중 전체 배포를 할 때는 반드시 먼저 `cd functions && npm run build`로 컴파일 성공을 확인하세요.
   - 핀셋 배포(`--only functions:<함수명>`)가 여전히 가장 안전합니다.

2. **CI/CD 자동 배포 사고 방지**
   - GitHub Actions의 `firebase-deploy-beok.yml` 워크플로우는 삭제되었으니 안심하세요.
   - 만약 누군가 실수로 다시 추가한다면 main 브랜치 머지 시마다 백엔드를 강제 덮어씁니다.
   - `npm run deploy:prod` 스크립트는 에러를 발생시키도록 차단되어 있습니다.

---

## 🛠️ 긴급 복구 명령어 모음 (1분 컷)

### 1. 프론트엔드/UI만 배포해야 할 때 (안전함)
```bash
npm run build && npm run deploy:live
```
*(백엔드를 건드리지 않으므로 안심하고 사용)*

### 2. 백엔드 함수 특정 1개만 "핀셋" 배포해야 할 때 (가장 안전함)
만약 결제나 출결 관련 함수 중 하나만 급하게 수정해서 올려야 한다면 아래 명령어 템플릿을 사용하세요.
```bash
# 기본 템플릿
firebase deploy --only functions:<함수명> --project eregi-8fc1e

# 예시: 알림톡 발송 함수만 배포
firebase deploy --only functions:bulkSendNotifications --project eregi-8fc1e
```

### 3. Firestore 인덱스 에러가 발생했을 때
Firestore 콘솔에서 수동으로 인덱스를 만들었는데 로컬 프로젝트와 동기화가 안 되어 에러가 날 경우:
```bash
# 서버의 인덱스를 로컬로 가져와 동기화 후 바로 배포
firebase firestore:indexes --project eregi-8fc1e > firestore.indexes.json
firebase deploy --only firestore:indexes --project eregi-8fc1e
```

### 4. 함수 CORS 에러 → 핀셋 배포
특정 함수만 CORS 에러를 반환할 때:
```bash
# 해당 함수만 핀셋 재배포
firebase deploy --only functions:<함수명> --project eregi-8fc1e
# 예시: 결제 함수 CORS 에러
firebase deploy --only functions:confirmNicePayment --project eregi-8fc1e
```

### 5. 알림톡 미발송 → 트리거 함수 배포 확인
```bash
# Step 1: 알림 관련 함수가 배포되어 있는지 확인
firebase functions:list --project eregi-8fc1e | grep -i "notif\|alim\|badge"

# Step 2: 누락된 함수가 있다면 핀셋 배포
firebase deploy --only functions:sendBadgeNotification --project eregi-8fc1e
firebase deploy --only functions:bulkSendNotifications --project eregi-8fc1e
```

### 6. Firestore 룰 전파 지연
- 룰 배포 후 최대 10분 동안 전파 지연이 발생할 수 있습니다.
- 룰 변경 후 "권한 없음" 에러가 발생하면 10분간 기다렸다가 재시도하세요.
- 방어 코드: society admin resolution 로직에는 try-catch와 재시도를 구현해두세요.

### 7. 번역 패널 점멸 / 렌더링 안 됨
- sessionId 필터가 번역 스트림에서 올바르게 동작하는지 확인하세요.
- 임시 해결책: 번역 패널을 새 창에서 직접 URL로 여세요.

---

## 🚨 과거 사고 및 해결 사례

### 사고 1: "권한이 없습니다" (Missing or insufficient permissions) 무한 루프
**현상**: 슈퍼 어드민 계정임에도 불구하고 권한 없음 에러가 발생하며 페이지에 접근 불가.
**원인**: 브라우저 `sessionStorage`의 토큰이 만료/꼬였으나, 캐시가 새로고침되지 않아 발생.
**해결책**:
1. 관리자 브라우저에서 개발자 도구(F12) 열기
2. `Application` (애플리케이션) 탭 이동
3. 좌측 `Storage` -> `Session Storage` 클릭 후 도메인 우클릭 -> `Clear`(지우기)
4. 브라우저 강제 새로고침 (`Ctrl+Shift+R` / `Cmd+Shift+R`) 후 재로그인

### 사고 2: 아무 짓도 안 했는데 백엔드 함수가 날아감
**현상**: 어제까지 잘 되던 결제/알림톡 기능이 갑자기 멈추고 콘솔에서 함수가 사라짐.
**원인**: GitHub Actions에 등록된 `firebase-deploy-beok.yml`이 main 브랜치 머지 시마다 백엔드를 강제 덮어쓰면서 인덱싱 오류를 일으킴. (현재는 워크플로우 삭제로 원천 차단됨, `deploy:prod` 스크립트도 에러 발생으로 차단됨)
**해결책**:
만약 누군가 수동으로 `firebase deploy --only functions`를 쳐서 함수가 날아갔다면, 당황하지 말고 `docs/functions_snapshot_post_cleanup_final.txt`를 열어 원래 있던 45개 함수 목록을 확인한 뒤 핀셋 배포(`--only functions:<함수명>`)로 하나씩 살려냅니다.

### 사고 3: 일괄 퇴장 시 체류 시간이 "0분"으로 기록됨
**현상**: 관리자가 18:00에 일괄 퇴장을 눌렀는데 사용자들의 체류 시간이 0분으로 나옴.
**원인**: 퇴장 버튼을 누른 시간(예: 4월 18일)의 룰을 가져와서 시작점과 종료점이 꼬임.
**해결책**:
1. **근본 해결 완료**: 입장 시간 기준으로 룰을 가져오도록 로직이 패치되었습니다.
2. **복구 버튼 삭제**: "0분 오류 복원" 버튼은 더 이상 필요 없어 코드에서 제거되었습니다 (commit ad786162).
3. 만약 과거의 0분 데이터를 수동으로 복원해야 한다면 Firestore의 로그 컬렉션을 기반으로 재계산해야 합니다.

### 사고 4: KST 타임존 불일치
**현상**: UTC와 KST의 날짜 불일치로 체류 시간이 잘못 계산됨.
**원인**: 날짜 비교 시 UTC 기준과 KST 기준이 혼용되어 duration miscalculation 발생.
**해결책**:
1. **표준화 완료**: 모든 날짜 계산은 `src/utils/dateUtils.ts`의 `getKstToday()`를 사용하여 KST로 통일하세요.
2. **룰 매칭**: 항상 입장 시간 기준으로 룰을 매칭합니다 (사고 3의 해결책과 동일).

### 사고 5: CI/CD 자동 배포 사고
**현상**: GitHub Actions 워크플로우가 main 브랜치 머지 시마다 함수를 자동 배포하여 라이브 중 함수 삭제.
**원인**: `.github/workflows/firebase-deploy-beok.yml`이 PR 머지 시마다 `firebase deploy --only functions`를 실행.
**해결책**:
1. **워크플로우 삭제**: 현재는 자동 배포 워크플로우가 삭제되었습니다.
2. **스크립트 차단**: `npm run deploy:prod`는 에러를 발생시키도록 설정되어 있습니다.
3. 만약 자동 배포를 재도입해야 한다면 PR 배포용 스테이징 프로젝트를 별도로 사용하세요.

### 사고 6: 번역 스트림 렌더링 이슈
**현상**: 실시간 번역 패널이 점멸하거나 렌더링되지 않음.
**원인**: sessionId 필터가 스트림에서 올바르게 매칭되지 않음.
**해결책**:
1. **필터 로직 수정**: sessionId 필터가 올바르게 스트림을 필터링하는지 확인하세요.
2. **임시 해결책**: 번역 패널을 새 창에서 직접 URL로 여세요.

---

## 📋 이벤트 사전 준비 체크리스트

### T-7일: 전체 함수 배포 + 스모크 테스트
- 백엔드 함수 전체 재배포 (`cd functions && npm run build && firebase deploy --only functions`)
- `firebase functions:list --project eregi-8fc1e`로 45개 함수가 모두 배포되었는지 확인
- 핵심 경로 수동 테스트: 등록/QR/배지/알림톡/번역

### T-1일: 인덱스 drift 확인 + 룰 배포 여유
- 인덱스 drift 확인: `bash scripts/check-deploy-drift.sh` (P2-1에서 생성 예정)
- Firestore 룰 배포 (전파 지연 10분 고려하여 여유 있게)

### T-0 당일 아침: 핵심 경로 수동 테스트
- QR 스캐너: 개발자 테스트용 QR을 스캔해서 `ENTER` 로그 확인
- 배지 발급: 인포데스크 메뉴에서 테스트 계정 배지 프린트 확인
- 외부 등록: 등록 페이지(`.../reg`)에서 폼 제출 후 Firestore 데이터 확인
- 알림톡: 테스트 발송 후 수신 여부 확인
- 번역: 실시간 번역 패널 렌더링 확인

### T-0 당일: 핀셋 배포만
- 긴급 수정 시에만 `firebase deploy --only functions:<함수명>` 사용
- 전체 배포 금지

### T+1: 사후 정리
- `docs/DEPLOY-LOG.md`에 배포 이력 기록 (향후 생성 예정)

---

## 📊 배포 이력 추적

모든 배포 이력은 `docs/DEPLOY-LOG.md`에 기록합니다 (향후 생성 예정).
이 문서에는 다음 정보가 포함됩니다:
- 배포 일시
- 배포된 함수 목록
- 배포 이유
- 배포 후 이슈 여부

---

## ✅ 스모크 테스트 (행사 시작 전)

행사 시작(오전 8시) 30분 전, 아래 5가지를 수동으로 한 번씩 테스트하십시오.

1. **QR 스캐너**: 개발자 테스트용 QR을 스캐너로 찍어서 `ENTER` 로그가 찍히는지 확인
2. **배지 발급**: 인포데스크 메뉴에서 테스트 계정 배지 프린트 명령이 정상 작동하는지 확인
3. **외부 등록**: 등록 페이지(`.../reg`)에서 폼을 제출하여 Firestore에 데이터가 꽂히는지 확인
4. **알림톡 발송**: 테스트 사용자에게 알림톡을 발송하고 수신 여부 확인
5. **함수 생존 확인**: 터미널에서 `firebase functions:list --project eregi-8fc1e`를 쳐서 45개의 함수가 모두 살아있는지 스냅샷(`docs/functions_snapshot_post_cleanup_final.txt`)과 비교
