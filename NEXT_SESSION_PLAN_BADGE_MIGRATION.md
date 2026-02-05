# 배지 토큰 마이그레이션 및 알림톡 발송 구현 현황 및 계획

## ✅ 완료된 작업
1. **자동 알림톡 발송 구현**
   - `functions/src/badge/index.ts`의 `onRegistrationCreated` 트리거 수정 완료.
   - 등록 생성(결제 완료) 시 `UF_3270` 템플릿을 사용하여 알림톡 자동 발송.
   - 학회명, 행사명, 시작일, URL 등 변수 자동 치환 적용.
   - `functions/src/utils/aligo.ts` 수정: 템플릿 메시지 본문(`message_1`) 전송 가능하도록 수정.

2. **저장 로직 마이그레이션 (DB Write)**
   - `onRegistrationCreated`에서 레거시 필드 `registration.badgePrepToken` 업데이트 로직 제거.
   - 이제 토큰은 `badge_tokens` 컬렉션에만 저장됨 (SSOT 원칙 준수).

## 🚧 다음 세션 진행 과제 (TODO)

### 1. [Backend] 수동 발송 기능 구현
- **파일:** `functions/src/badge/index.ts`
- **목표:** 관리자가 재발송 요청 시에도 알림톡이 가야 함.
- **작업:** `resendBadgePrepToken` 함수에 `onRegistrationCreated`와 동일한 알림톡 발송 로직 붙여넣기.

### 2. [Frontend] 관리자 페이지 수동 발송 버튼 추가
- **파일:** `src/pages/admin/ExternalAttendeePage.tsx`
- **목표:** 외부 등록자 목록에서 특정 인원에게 바우처(알림톡)를 수동으로 보낼 수 있어야 함.
- **작업:**
  - 테이블 "관리" 컬럼에 "알림톡 발송(MessageCircle 아이콘 등)" 버튼 추가.
  - 버튼 클릭 시 `resendBadgePrepToken` (또는 `sendBadgeNotification` 별도 함수) 호출.

### 3. [Frontend] 조회 로직 마이그레이션 (DB Read)
- **파일:** `src/pages/admin/ExternalAttendeePage.tsx` 등
- **목표:** 레거시 필드(`badgePrepToken`)가 더 이상 생성되지 않으므로, 프론트엔드가 이를 의존하지 않도록 수정.
- **작업:**
  - 리스트 렌더링 시 `attendee.badgePrepToken` 유무로 토큰 상태를 판단하지 않도록 변경.
  - 필요 시 `badge_tokens` 컬렉션을 조회하거나, "발송" 버튼이 항상 활성화되도록 변경(누르면 조회 후 없으면 생성).

## 🛑 주의사항
- **Functions 배포 필수:** 수정된 백엔드 로직(`functions`)을 반드시 배포해야 합니다. (`firebase deploy --only functions`)
- **알림톡 템플릿:** 관리자 페이지에서 `CONFERENCE_REGISTER` 타입의 템플릿이 활성화되어 있어야 발송됩니다.
