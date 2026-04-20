# eRegi 배포 이력 (Deployment Log)

이 문서는 eRegi 프로젝트의 모든 배포 기록을 추적합니다. 배포 시마다 이 로그를 업데이트하세요.

## 사용 지침

### 언제 기록해야 하나요?
- 백엔드 함수 배포 후 (전체 또는 핀셋)
- 프론트엔드 호스팅 배포 후
- Firestore 룰/인덱스 배포 후
- 긴급 핫픽스 배포 후

### 배포 확인 방법
```bash
# 배포된 함수 목록 확인
firebase functions:list --project eregi-8fc1e

# 호스팅 채널 확인
firebase hosting:channel:list --project eregi-8fc1e

# 드리프트 체크 (배포 전 실행 권장)
bash scripts/check-deploy-drift.sh
```

### 빠른 참조 명령어
```bash
# 전체 함수 배포 (라이브 중 주의)
cd functions && npm run build && firebase deploy --only functions --project eregi-8fc1e

# 핀셋 배포 (가장 안전)
firebase deploy --only functions:<함수명> --project eregi-8fc1e

# 프론트엔드만 배포
npm run build && firebase deploy --only hosting --project eregi-8fc1e

# Firestore 인덱스 동기화
firebase firestore:indexes --project eregi-8fc1e > firestore.indexes.json
firebase deploy --only firestore:indexes --project eregi-8fc1e
```

---

## 템플릿 (미래 기록용)

| 날짜 | 배포 유형 | 배포 대상 | 배포 사유 | 배포된 함수 | 이슈 여부 | 작업자 |
|------|-----------|-----------|-----------|-------------|-----------|--------|
| YYYY-MM-DD | functions / functions:target / hosting / firestore:rules / firestore:indexes | eregi-8fc1e | 사유 설명 | 함수명 또는 N/A | 없음 / 있음 | 작업자 |

---

## 배포 이력 (Historical Log)

| 날짜 | 배포 유형 | 배포 대상 | 배포 사유 | 배포된 함수 | 이슈 여부 | 작업자 |
|------|-----------|-----------|-----------|-------------|-----------|--------|
| 2026-04-02 | functions | eregi-8fc1e | v1.0.0 기준 태그 (commit 35aaeed) | 전체 (기준) | 없음 | - |
| 2026-04-15~16 | functions + hosting | eregi-8fc1e | 행사 전 사전 배포 (T-7일 체크리스트) | 전체 함수 + 프론트엔드 | 없음 | - |
| 2026-04-16~18 | functions:target (핀셋) | eregi-8fc1e | 라이브 행사 중 출결/번역 핫픽스 | confirmNicePayment, bulkSendNotifications 등 | 있음 (일시적) | - |
| 2026-04-19 | functions | eregi-8fc1e | 행사 종료 후 정리 (P0-1) - Node 22 런타임, 45개 함수 | 전체 (45개) | 없음 | - |
| 2026-04-19 | firestore:indexes | eregi-8fc1e | 인덱스 드리프트 동기화 (P0-2) | 28개 인덱스 | 없음 | - |
| 2026-04-19 | firestore:rules | eregi-8fc1e | Firestore 룰 배포 (P0-3) | N/A | 없음 | - |
| 2026-04-19 | hosting | eregi-8fc1e | 프론트엔드 모듈화 및 크래시 수정 배포 | N/A | 없음 | - |
| 2026-04-20 | docs | - | DEPLOY-LOG.md 생성 (이 문서) | N/A | 없음 | Sisyphus |

---

## 비고

- **2026-04-19**: P0-1 정리 완료로 더 이상 주석 처리된 export가 없으며, 45개 함수가 모두 배포됨
- **CI/CD 자동 배포 삭제**: 2026-04-16에 GitHub Actions 워크플로우 삭제로 자동 배포 사고 원천 차단
- **핀셋 배포 권장**: 라이브 행사 중에는 전체 배포 대신 핀셋 배포(`--only functions:<함수명>`) 사용

---

## 참고 문서

- `docs/EMERGENCY-RUNBOOK.md` - 긴급 상황 대응 매뉴얼
- `docs/functions_snapshot_post_cleanup_final.txt` - 45개 함수 레퍼런스 스냅샷
- `scripts/check-deploy-drift.sh` - 드리프트 감지 스크립트
- `AGENTS.md` - 배포 가드레일 (LIVE EVENT PROTECTION 섹션)
