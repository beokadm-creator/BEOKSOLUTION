# 분산 키오스크 AUTO 모드 및 수강시간 계산 검증 및 수정 계획

## 1. 분석 결과 (Current State Analysis)
- **동시성 처리 (Concurrency)**: `AttendanceScannerPage.tsx`와 `exitLogger.ts` 모두 Firestore의 `runTransaction`을 사용하여 데이터를 업데이트하므로, 여러 대의 키오스크에서 동시에 같은 참가자를 스캔하더라도 데이터 덮어쓰기나 충돌 문제가 발생하지 않습니다.
- **AUTO 모드 동작**: 참가자의 현재 상태(`INSIDE`/`OUTSIDE`)와 현재 구역(`currentZone`), 그리고 스캔한 키오스크의 구역을 비교하여 **입장(ENTER)**, **퇴장(EXIT)**, **구역 이동(Zone Switch)**을 자동으로 판별하고 있어 논리적으로 올바릅니다.
- **🚨 심각한 버그 (UTC 날짜 계산 오류)**: 
  - `AttendanceScannerPage.tsx`와 `exitLogger.ts`에서 체류 시간을 계산할 때 `toISOString().split('T')[0]`를 사용하고 있습니다. 이는 UTC 기준이므로 한국 시간(KST) 오전 9시 이전에는 **전날 날짜**로 계산되어 수강 시간이 정상적으로 누적되지 않는 치명적인 문제가 있습니다.
  - `StandAloneBadgePage.tsx`의 실시간 타이머 계산 또한 브라우저의 로컬 타임존에 의존하고 있어, 해외 타임존 기기에서 접근 시 오작동할 수 있습니다.

## 2. 변경 계획 (Proposed Changes)

### 2.1 KST 기준 시간 계산 버그 수정
- **대상 파일**: 
  - `src/pages/admin/AttendanceScannerPage.tsx`
  - `functions/src/attendance/exitLogger.ts`
  - `src/pages/StandAloneBadgePage.tsx`
- **수정 내용**: 
  - `toISOString()`을 사용하기 전에 한국 시간 오프셋(+9시간)을 적용하거나, 명시적으로 `+09:00` 타임존을 사용하여 날짜 문자열(`YYYY-MM-DD`)을 추출하도록 수정합니다.
  - 로컬 타임존에 의존하던 Date 객체 파싱을 KST 기준으로 고정합니다.

### 2.2 AUTO 모드 및 수강시간 검증 테스트 작성 (Verification)
- **대상 파일**: `kiosk_attendance.test.ts` (신규 작성)
- **내용**: 여러 대의 키오스크(Room A, Room B 등)가 AUTO 모드로 작동하는 환경을 시뮬레이션하는 통합 테스트(Jest)를 작성합니다.
  - **시나리오 1**: 사용자가 Room A에 입장 후 시간 경과 뒤 퇴장 (정상 누적 확인)
  - **시나리오 2**: 사용자가 Room A에 입장 후, 퇴장 없이 곧바로 Room B 키오스크에 스캔 (Zone Switch 동작 및 Room A 체류시간 누적 확인)
  - **시나리오 3**: 점심시간/휴식시간이 겹칠 때 해당 시간이 정확히 차감되는지 확인
  - **시나리오 4**: UTC/KST 경계 시간(예: 오전 8시)에 입장/퇴장 시 날짜가 꼬이지 않고 정확히 계산되는지 확인

## 3. 검증 단계 (Verification Steps)
1. 위 파일들의 UTC 버그를 수정합니다.
2. `kiosk_attendance.test.ts`를 실행(`npx jest kiosk_attendance`)하여 모든 다중 사용자/다중 키오스크 시나리오가 PASS 하는지 확인합니다.
3. 테스트 통과 시 분산 환경에서의 AUTO 모드 로직의 안정성이 검증된 것으로 간주합니다.