---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 1273
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

# 배포 안전성 확보 계획

## 🚨 문제 상황
NHN 알림톡 변경 작업 후 배포 시 사이트 접근 불가 → 롤백 발생

## 📋 현재 상태 분석

### 롤백 버전 vs 작업 버전 차이
```bash
# 최근 5개 커밋에서 추가된 주요 변경사항
- functions/src/monitoring/* (새로운 모니터링 시스템)
- functions/src/migrations/* (외부 참석자 마이그레이션)
- functions/src/utils/email.ts (이메일 유틸리티)
- src/components/admin/ExternalAttendeeMigration.tsx
- src/pages/admin/SuperAdminPage.tsx (대폭 수정)
- firestore.rules (보안 규칙 추가)
```

## 🛡️ 배포 안전성 확보 방안

### Phase 1: 즉시 적용 (긴급)

#### 1.1 배포 전 필수 체크리스트 자동화
```bash
# .github/workflows/pre-deploy-check.yml 생성
```

#### 1.2 스테이징 환경 구축
- Firebase Hosting Preview Channels 활용
- 프로덕션 배포 전 필수 테스트

#### 1.3 점진적 배포 (Canary Deployment)
- Firebase Hosting 가중치 기반 트래픽 분할
- 10% → 50% → 100% 단계적 배포

### Phase 2: 중기 대책 (1주일 내)

#### 2.1 자동화된 E2E 테스트
```typescript
// tests/critical-paths.spec.ts
- 홈페이지 접근
- 로그인 플로우
- 등록 페이지 접근
- 결제 프로세스
```

#### 2.2 헬스체크 엔드포인트
```typescript
// functions/src/health.ts
export const healthCheck = functions.https.onRequest((req, res) => {
  // 주요 서비스 상태 확인
  // - Firestore 연결
  // - 외부 API 연결 (AlimTalk, Payment)
  // - 필수 환경 변수 존재 여부
});
```

#### 2.3 롤백 자동화
```bash
# scripts/rollback.sh
#!/bin/bash
# 원클릭 롤백 스크립트
```

### Phase 3: 장기 대책 (1개월 내)

#### 3.1 Feature Flag 시스템
```typescript
// Firebase Remote Config 활용
const featureFlags = {
  useNHNAlimTalk: false,  // 기능별 on/off
  enableExternalAttendee: true,
  enableMonitoring: true
};
```

#### 3.2 모니터링 및 알림
- Firebase Performance Monitoring
- Error Tracking (Sentry 등)
- 실시간 알림 (Slack, Email)

#### 3.3 Blue-Green Deployment
- 두 개의 독립적인 환경 유지
- 무중단 전환

## 📝 NHN 알림톡 안전 배포 계획

### Step 1: 환경 변수 분리
```env
# .env.production
VITE_ALIMTALK_PROVIDER=aligo  # 또는 nhn
```

### Step 2: 추상화 레이어 구축
```typescript
// functions/src/services/notification.service.ts
interface NotificationProvider {
  sendAlimTalk(params: AlimTalkParams): Promise<Result>;
}

class AligoProvider implements NotificationProvider { }
class NHNProvider implements NotificationProvider { }

// 환경 변수에 따라 프로바이더 선택
const provider = process.env.ALIMTALK_PROVIDER === 'nhn' 
  ? new NHNProvider() 
  : new AligoProvider();
```

### Step 3: 단계적 전환
1. **Week 1**: NHN Provider 구현 및 테스트 환경 검증
2. **Week 2**: 스테이징에서 실제 데이터로 테스트
3. **Week 3**: 프로덕션에 Feature Flag로 배포 (off 상태)
4. **Week 4**: 10% 트래픽으로 테스트 → 점진적 확대

## 🔍 배포 전 필수 확인사항

### 빌드 검증
- [ ] `npm run build` 성공
- [ ] `npm run type-check` 성공
- [ ] `npm run lint` 성공
- [ ] `npm run test` 성공

### 기능 검증
- [ ] 로컬에서 `npm run dev` 정상 작동
- [ ] 주요 페이지 접근 가능 (/, /home, /conference/*)
- [ ] 로그인/로그아웃 정상 작동
- [ ] 등록 플로우 정상 작동

### 환경 검증
- [ ] 모든 환경 변수 설정 확인
- [ ] Firebase Functions 환경 변수 동기화
- [ ] API 키 유효성 확인

### 배포 후 검증
- [ ] 프로덕션 URL 접근 확인
- [ ] 브라우저 콘솔 에러 없음
- [ ] Firebase Functions 로그 에러 없음
- [ ] 5분간 모니터링 후 이상 없음

## 🚀 안전한 배포 프로세스

```bash
# 1. 로컬 검증
npm run build
npm run preview  # 빌드된 파일로 로컬 서버 실행

# 2. 스테이징 배포
firebase hosting:channel:deploy staging

# 3. 스테이징 테스트 (자동화)
npm run test:e2e -- --base-url=https://staging-url

# 4. 프로덕션 배포 (승인 필요)
firebase deploy --only hosting,functions

# 5. 즉시 헬스체크
curl https://your-domain.com/health

# 6. 5분간 모니터링
# - Firebase Console에서 에러 로그 확인
# - Performance 메트릭 확인
# - 실제 사용자 접근 테스트

# 7. 문제 발생 시 즉시 롤백
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live
```

## 📊 모니터링 대시보드

### 필수 메트릭
1. **가용성**: Uptime (목표: 99.9%)
2. **응답 시간**: Page Load Time (목표: < 3초)
3. **에러율**: Error Rate (목표: < 0.1%)
4. **사용자 영향**: Active Users 추이

### 알림 설정
- 에러율 > 1% → 즉시 알림
- 응답 시간 > 5초 → 경고
- Uptime < 99% → 긴급 알림

## 🔧 롤백 버전과 작업 버전 통합 전략

### 우선순위 1: 안정성 확보
1. 현재 프로덕션에서 정상 작동하는 기능은 절대 건드리지 않음
2. 새 기능은 Feature Flag로 감싸서 배포
3. 데이터베이스 마이그레이션은 backward-compatible하게

### 우선순위 2: 점진적 통합
```bash
# 안전한 순서
1. 모니터링 시스템 (읽기 전용, 영향 최소)
2. 이메일 유틸리티 (독립적 기능)
3. 외부 참석자 마이그레이션 (Feature Flag)
4. NHN 알림톡 (Feature Flag + Canary)
```

## 📅 실행 계획

### Week 1: 기반 구축
- [ ] 배포 자동화 스크립트 작성
- [ ] 헬스체크 엔드포인트 구현
- [ ] E2E 테스트 핵심 시나리오 작성

### Week 2: 스테이징 환경
- [ ] Firebase Hosting Preview Channels 설정
- [ ] 스테이징 자동 배포 파이프라인 구축
- [ ] 모니터링 대시보드 설정

### Week 3: Feature Flag 시스템
- [ ] Firebase Remote Config 설정
- [ ] 코드에 Feature Flag 적용
- [ ] 관리자 UI에서 Feature Flag 제어 가능하도록

### Week 4: NHN 알림톡 재배포
- [ ] NHN Provider 구현
- [ ] Feature Flag로 감싸서 배포
- [ ] 10% 트래픽으로 테스트
- [ ] 점진적 확대

## 🎯 성공 기준

1. **배포 성공률**: 95% 이상
2. **롤백 빈도**: 월 1회 미만
3. **다운타임**: 연간 4시간 미만 (99.95% uptime)
4. **배포 소요 시간**: 30분 이내
5. **문제 감지 시간**: 5분 이내

## 📚 참고 자료

- [Firebase Hosting Preview Channels](https://firebase.google.com/docs/hosting/test-preview-deploy)
- [Feature Flags Best Practices](https://martinfowler.com/articles/feature-toggles.html)
- [Blue-Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
