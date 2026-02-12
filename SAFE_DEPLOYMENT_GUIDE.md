# 안전한 배포 실행 가이드

## 🎯 목적
이 가이드는 NHN 알림톡 변경과 같은 주요 기능 변경 시 사이트 접근 불가 문제를 방지하기 위한 실행 가이드입니다.

## 📋 즉시 실행 가능한 대책

### 1. 배포 전 필수 체크 실행

```bash
# 배포 전 안전성 체크
npm run pre-deploy
```

이 명령어는 다음을 자동으로 확인합니다:
- ✅ 주요 파일 존재 여부
- ✅ Firebase 설정 유효성
- ✅ 환경 변수 설정
- ✅ TypeScript 타입 체크
- ✅ ESLint 검사
- ✅ 프로덕션 빌드 성공 여부
- ✅ Functions 빌드 성공 여부

**모든 체크를 통과해야만 배포를 진행하세요.**

### 2. 안전한 배포 프로세스

```bash
# 안전한 배포 (스테이징 → 프로덕션)
npm run deploy:safe
```

이 명령어는 다음 단계를 자동으로 수행합니다:
1. 배포 전 체크 실행
2. Git 상태 확인
3. 스테이징 환경 배포 (Preview Channel)
4. 사용자 확인 대기
5. 프로덕션 배포
6. 배포 후 헬스체크

### 3. 수동 단계별 배포 (권장)

더 안전한 방법은 단계별로 수동 실행하는 것입니다:

#### Step 1: 배포 전 체크
```bash
npm run pre-deploy
```

#### Step 2: 스테이징 배포
```bash
npm run deploy:staging
```

스테이징 URL이 출력되면 다음을 테스트하세요:
- [ ] 홈페이지 접근 (`/`)
- [ ] 로그인/로그아웃
- [ ] 컨퍼런스 페이지 (`/conference/2026spring`)
- [ ] 등록 페이지
- [ ] 결제 프로세스
- [ ] 관리자 페이지

#### Step 3: 프로덕션 배포
```bash
npm run deploy:prod
```

#### Step 4: 배포 후 확인
```bash
# 헬스체크 (배포 후 30초 대기 후 실행)
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/healthCheck
```

## 🚨 긴급 롤백

배포 후 문제가 발생하면 즉시 롤백하세요:

```bash
# 이전 버전으로 롤백
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live
```

또는 Firebase Console에서:
1. Hosting 섹션으로 이동
2. "Release history" 탭 선택
3. 이전 버전 선택 후 "Rollback" 클릭

## 📊 배포 후 모니터링 (필수)

배포 후 최소 5-10분간 다음을 모니터링하세요:

### 1. Firebase Console
- Functions 로그: https://console.firebase.google.com/project/_/functions/logs
- Hosting 상태: https://console.firebase.google.com/project/_/hosting

### 2. 실제 사이트 접근 테스트
```bash
# 프로덕션 URL 접근
curl -I https://your-domain.com

# 주요 페이지 확인
curl https://your-domain.com/
curl https://your-domain.com/conference/2026spring
```

### 3. 브라우저 콘솔 확인
- 브라우저에서 F12 → Console 탭
- 에러 메시지가 없는지 확인

## 🔧 NHN 알림톡 안전 배포 계획

현재 Aligo를 사용 중이므로, NHN으로 전환 시 다음 단계를 따르세요:

### Phase 1: 준비 (1주)
1. NHN Cloud 계정 및 API 키 발급
2. `functions/src/services/notificationService.ts`의 `NHNProvider` 구현 완료
3. 테스트 환경에서 NHN API 호출 테스트

### Phase 2: Feature Flag 설정 (1일)
1. Firestore에 Feature Flag 초기화:
```javascript
// Firebase Console → Firestore → _config/feature_flags 문서 생성
{
  useNHNAlimTalk: false,
  useAligoAlimTalk: true,
  // ... 기타 플래그
}
```

2. 코드에서 Feature Flag 사용:
```typescript
// 기존 코드 수정
import { sendAlimTalk } from './services/notificationService';

// 자동으로 Feature Flag에 따라 Aligo 또는 NHN 사용
await sendAlimTalk({
  phone: '01012345678',
  templateCode: 'REGISTRATION_COMPLETE',
  variables: { name: '홍길동' }
});
```

### Phase 3: 스테이징 테스트 (2-3일)
1. 스테이징 환경에서 `useNHNAlimTalk: true` 설정
2. 실제 알림톡 발송 테스트
3. 수신 확인 및 로그 검증

### Phase 4: 프로덕션 배포 (1일)
1. 안전한 배포 프로세스로 배포
2. 프로덕션에서 `useNHNAlimTalk: false` 유지 (Aligo 계속 사용)
3. 배포 후 모니터링

### Phase 5: 점진적 전환 (1주)
1. 프로덕션에서 `useNHNAlimTalk: true`로 변경
2. 실시간 모니터링
3. 문제 발생 시 즉시 `useNHNAlimTalk: false`로 복구

## ✅ 체크리스트

### 배포 전
- [ ] `npm run pre-deploy` 통과
- [ ] Git 커밋 완료
- [ ] 변경 사항 문서화
- [ ] 롤백 계획 준비

### 배포 중
- [ ] 스테이징 테스트 완료
- [ ] 주요 기능 동작 확인
- [ ] 에러 로그 없음

### 배포 후
- [ ] 프로덕션 사이트 접근 확인
- [ ] 헬스체크 통과
- [ ] 5분간 모니터링
- [ ] 사용자 피드백 확인

## 📞 문제 발생 시

1. **즉시 롤백**
   ```bash
   firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live
   ```

2. **로그 확인**
   - Firebase Console → Functions → Logs
   - 브라우저 Console (F12)

3. **Feature Flag 비활성화** (NHN 알림톡 문제 시)
   - Firestore → `_config/feature_flags` → `useNHNAlimTalk: false`

4. **이슈 기록**
   - 문제 상황 문서화
   - 에러 로그 저장
   - 재발 방지 대책 수립

## 🎓 학습 포인트

이번 롤백 사태에서 배운 교훈:
1. **배포 전 체크가 필수**: 빌드, 타입체크, 린트를 자동화
2. **스테이징 환경 활용**: 프로덕션 배포 전 반드시 테스트
3. **Feature Flag 사용**: 새 기능을 안전하게 on/off
4. **모니터링 강화**: 배포 후 즉시 문제 감지
5. **빠른 롤백 준비**: 문제 발생 시 즉시 복구

## 📚 추가 자료

- [배포 안전성 확보 계획](./DEPLOYMENT_SAFETY_PLAN.md)
- [Firebase Hosting 문서](https://firebase.google.com/docs/hosting)
- [Firebase Functions 문서](https://firebase.google.com/docs/functions)
