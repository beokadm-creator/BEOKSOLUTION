# eRegi V2 고도화 및 V1 제거 완료 보고

## 1. [Destruction] V1 레거시 완전 제거
- **Server**: `functions/src` 내 `stt.ts` 등 레거시 파일 부재 확인 및 `index.ts` 내 V1 관련 임포트 정리 완료.
- **Client**: `LiveConsole.tsx`, `Overlay.tsx` 등 V1 UI 컴포넌트 제거 확인.
- **빌드 검증**: V1 제거 후 V2 단독 빌드(Client & Functions) 성공.

## 2. [Security] AdminGuard 취약점 패치
- **로직 변경**: 단순 `auth` 파라미터 존재 확인 로직 폐기.
- **서버 검증 도입**: `functions/src/index.ts`에 `verifyAccessLink` (HMAC-SHA256 서명 + TTL + CID 검증) 함수 구현.
- **클라이언트 적용**: `AdminGuard.tsx`에서 서버 함수 호출을 통해 토큰 유효성 검증 후 세션 승인.
- **격리(Isolation)**: 토큰 내 `cid`와 현재 접속 URL의 `cid` 불일치 시 접근 차단 로직 적용.

## 3. [Expansion] L3(Vendor) 기능 확장
- **Excel 다운로드**: `VendorDashboard.tsx`에 전체 방문객 데이터(리드)를 조회하여 엑셀(.xlsx)로 추출하는 기능 구현.
- **데이터 무결성**: 10개 제한 없이 전체 데이터를 쿼리하도록 로직 분리.

## 4. [Hardware] 프린터 브릿지 연동
- **Bixolon 연동**: `useBixolon.ts` 훅을 실제 Bixolon Web Print API (`http://localhost:18080/WebPrintSDK`)와 통신하도록 업데이트.
- **오류 처리**: 하드웨어 미연동 시 개발 모드(Mock)로 자동 폴백되도록 예외 처리 추가.

모든 과제가 완료되었으며, 시스템은 V2 아키텍처로 안전하게 구동됩니다.