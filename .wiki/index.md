# eRegi (BEOKSOLUTION) — 학회 등록/컨퍼런스 운영 플랫폼

> 실제 프로젝트명: eRegi / Repo: BEOKSOLUTION

## Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind (~60K lines)
- **Backend**: Firebase Cloud Functions
- **DB**: Firestore
- **인증**: Firebase Auth

## 핵심 기능
- 학회/컨퍼런스 등록 플로우
- 관리자 대시보드 (학회, 컨퍼런스, 벤더)
- 결제 연동 (Cloud Functions)
- 배지/프린트 워크플로우
- 멀티테넌트 도메인 라우팅
- 출석 스캐너
- 초록(Abstract) 관리
- 후원사/벤더 관리

## 주요 페이지
| 영역 | 페이지 |
|------|--------|
| 참가자 | RegistrationPage, LandingPage, ProgramPage, ConferenceBadgePage |
| 관리자 | DashboardPage, RegistrationListPage, BadgeManagementPage, AttendanceLivePage, StatisticsPage, AgendaManager, SponsorManager |
| 벤더 | VendorDashboard, VendorScannerPage, VendorSettingsPage |
| 초록 | AbstractSubmissionPage, AbstractManagerPage |

## Key Files
- `src/pages/` — 전체 페이지
- `src/services/` — audit, notices
- `functions/src/` — Cloud Functions (attendance, audit, auth, badge, migrations)
- `firebase.json`, `firestore.rules`, `storage.rules`

## 문서 구조
- `AGENTS.md` — AI 에이전트 규칙 (precedence 80)
- `MANDATORY_WORKFLOW.md` — 필수 워크플로우 (precedence 100)
- `docs/` — 시스템 아키텍처, 개발 가이드, 멀티테넌트 가이드

## 레거시/정리 필요 파일
### 루트 디렉토리 임시 파일 (삭제 대상)
- `Sample_LabelPrinter.html`, `atest.html`, `fix-participations.html`, `response.html`
- `build_output.txt`, `deploy_log.txt~4`, `git_log.txt`, `logs.txt`
- `typescript-errors.txt`, `userhub_lint_errors.txt`
- `fix-test-registration.js`, `recover-participations.js`
- `oldHub.ts`, `old_rules.txt`
- `tmp_check_rules.js`, `tmp_debug_baek.js`, `tmp_debug_user.js`
- `comprehensive_report_kadd_2026spring (4).xlsx`

### 임시/백업 디렉토리 (삭제 대상)
- `backup/`, `dist-live/`, `glm-1.0.3/`
- `src-old-91a3e3b/`

### Functions 백업
- `functions/src/index.ts.backup`
