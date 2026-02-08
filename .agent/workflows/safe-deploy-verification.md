---
description: 라이브 환경 안전 배포 및 검증 워크플로우
---

# 라이브 환경 안전 배포 및 검증 워크플로우

## 1단계: 현재 변경사항 커밋

```bash
git add .
git commit -m "fix: 등록 완료 후 홈 버튼 즉시 클릭 시 타이밍 이슈 해결

- ConferenceWideTemplate: 로딩 상태 처리 개선 (loading || (!config && !error))
- useTranslation: Firestore 쿼리 병렬 실행으로 성능 개선 (Promise.allSettled)
- 예상 로딩 시간 50-70% 단축"
```

## 2단계: 테스트 브랜치 생성 및 배포

```bash
# 테스트 브랜치 생성
git checkout -b hotfix/registration-timing-fix

# Firebase Hosting 프리뷰 채널로 배포
firebase hosting:channel:deploy test-timing-fix --expires 1d
```

이렇게 하면 **임시 URL**이 생성됩니다 (예: `https://eregi-project--test-timing-fix-xxxxx.web.app`)

## 3단계: 프리뷰 URL에서 테스트

1. 생성된 프리뷰 URL 접속
2. 실제 라이브 데이터로 등록 플로우 테스트
3. 문제 없으면 다음 단계 진행

## 4단계: 라이브 배포

```bash
# main 브랜치로 병합
git checkout main
git merge hotfix/registration-timing-fix

# 라이브 배포
npm run build
firebase deploy --only hosting

# 또는 functions도 함께 배포 필요시
firebase deploy
```

## 5단계: 배포 후 모니터링

1. 라이브 사이트에서 즉시 테스트
2. 문제 발생 시 롤백:
   ```bash
   firebase hosting:rollback
   ```

## 대안: Canary 배포 (점진적 배포)

Firebase Hosting의 트래픽 분할 기능 사용:
```bash
# 10%의 트래픽만 새 버전으로
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL TARGET_SITE_ID:live --weight 0.1
```
