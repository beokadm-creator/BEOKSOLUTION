# 🚨 Optional Add-ons Feature - Rollback Runbook

## 🎯 QUICK ROLLBACK (5초 내 완료)

### ✅ **즉시 기능 OFF (가장 빠른 롤백)**

```bash
# Firebase Console → Remote Config
1. https://console.firebase.google.com → 프로젝트 선택
2. Remote Config → 매개변수 탭
3. optional_addons_enabled 찾기
4. 값: false 로 변경
5. 변경사항 게시

⏱️ 소요 시간: 5초
```

**결과**: 
- AddonSelector 컴포넌트가 자동으로 숨김
- 기존 등록 흐름으로 즉시 복귀
- 데이터는 그대로 보존 (안전)

---

## 📊 ROLLBACK 단계별 가이드

### 레벨 1: UI 비활성화 (사용자 영향 제거)

**상황**: 사용자 화면에 문제 발생

**조치**:
1. Firebase Remote Config → `optional_adds_enabled = false`
2. 30초 내 모든 사용자에게 적용
3. AddonSelector 더 이상 표시 안됨

**검증**: 브라우저 개발자 도구 → Application → Remote Config 확인

---

### 레벨 2: 코드 롤백 (마지막 배포 버전으로 복귀)

**상황**: 심각한 버그, 데이터 손상 가능

**전제조**:
- 최근 커밋 있어야 함 (git log 확인)
```bash
git log --oneline -10
```

**단계**:

#### Option A: 마지막 안정 커밋으로 되돌리기
```bash
# 1. 롤백할 커밋 확인
git log --oneline

# 2. 되돌아갈 커밋 체크아웃
git checkout <commit-hash>

# 3. Firebase 배포
firebase deploy --only hosting,functions

# 4. Remote Config 확인
# optional_addons_enabled = false (이미 완료됐어야 함)
```

#### Option B: 브루-그린 백업 사용 (배포 중인 경우)
```bash
# 이전 버전의 라이브 채널로 복귀
firebase hosting:clone eregi:live eregi:live-backup-<timestamp>

# Functions 버전 되돌리기 (Cloud Run)
gcloud run services update-traffic api-functions \
  --to-revisions PREVIOUS_REVISION=100 \
  --region=us-central1
```

---

### 레벨 3: 데이터 롤백 (Firestore 데이터 수정)

**상황**: 옵션 데이터가 잘못 저장됨

**⚠️ 주의**: 데이터 롤백은 매우 위험하며 신중하게 진행하세요.

#### 시나리오 1: 특정 등록의 옵션만 삭제
```javascript
// Firebase Console → Firestore → conferences/{confId}/registrations/{regId}
// 문서 편집 → options 필드 삭제
// baseAmount, optionsTotal은 유지
```

#### 시나리오 2: 모든 등록에서 옵션 데이터 제거 (일괄 삭제)

**Cloud Function 실행** (최후 수단):
```bash
# Firebase Console → Functions → logs 탭
# migrateRegistrationsForOptionsCallable 직접 호출하거나
# 아래 스크립트 실행

# 또는 Firebase CLI
firebase functions:config:get sdkconfig # 확인
```

**수동으로 특정 컬렉션 삭제 (위험):
```bash
# Firestore 컬렉션별로 삭제 (conference_options, registration_options)
# Firebase Console → Firestore → 컬렉션 선택 → 삭제
```

---

## 🔍 문제 진단 체크리스트

### 롤백 전 확인사항

- [ ] 사용자에게 영향 중인 기능인가? → 즉시 레벨 1
- [ ] 데이터 손상 가능성 있는가? → 레벨 3 고려
- [ ] 최근 커밋 있는가? → 레벨 2 시도
- [ **[중요]**] 백업 데이터 있는가? → 항상 백업 후 조치

### 롤백 후 검증사항

1. **UI 확인**
   - [ ] AddonSelector 표시 안되는지 확인
   - [ ] 결제 금액이 기존과 같은지 확인
   
2. **데이터 확인**
   - [ ] Firestore에서 options 필드 확인
   - [ ] baseAmount, optionsTotal 계산 정확 확인
   
3. **결제 확인**
   - [ ] 새로운 등록 시 옵션 선택 불가능한지 확인
   - [ ] 기존 등록 정상 작동하는지 확인

---

## 🛡️ 사전 예방 조치 (완료됨)

✅ **이미 완료된 안전장치**:

1. **기능 플래그**: Remote Config로 즉시 OFF 가능
2. **스키마 호환성**: Registration.amount 필드 유지 (하위호환)
3. **데이터 분리**: baseAmount, optionsTotal로 분리 저장
4. **확장 필드**: 선택적 필드로 설계 (기존 코드 영향 없음)
5. **마이그레이션 스크립트**: 기존 데이터 보존하며 새 필드 추가
6. **배포 전 테스트**: 프리뷰 채널로 검증 후 라이브 배포

---

## 📞 긴급 연락망

### 결정권자
- 개발팀 리드: [연락처]
- Firebase 프로젝트 소유자: [소유자 이메일]
- DevOps 담당자: [연락처]

### 문제 보고시 필요 정보
1. 발생 시간 (KST)
2. 영향 받는 사용 수 (대략)
3. 에러 메시지 전체 (스크린샷)
4. 현재 진행하던 작업
5. 마지막 성공한 작업 (git commit hash)

---

## 📝 롤백 후 복구 절차

### 복구 시나리오: UI 문제 해결 후

1. **근본 원인 파악** (버그 리포트, 로그 분석)
2. **코드 수정** (dev 브랜치에서 수정 후 테스트)
3. **테스트** (스테이징 환경에서 검증)
4. **프리뷰 채널 배포** (새 버전 테스트)
5. **확인 후 라이브 배포**
6. **Remote Config 재활성** (`optional_addons_enabled = true`)

---

## 🎓 교훈: 롤백 비용보다 예방이 낫다

**롤백에 드는 비용**:
- 사용자 불만 → 신뢰도 하락
- 데이터 복구 → 시간 소요
- 서비스 중단 → 매출 손실
- 팀 마모 → 사기 저하

**예방 비용** (현재 투자):
- 기능 플래그 → 5초 해결 ✅
- 테스트 → 버그 조기 발견
- 점진적 롤아웃 → 영향 최소화
- 백업 → 데이터 안전 ✅

---

## ⚡ 긴급시 실행 명령어 (복사해서 사용하세요)

### 즉시 롤백 (사용자 화면 이상)
```bash
# 1. Remote Config OFF
firebase remoteconfig:get --project YOUR_PROJECT_ID
# Firebase Console에서 직접 설정
```

### 코드 롤백
```bash
# 최근 안정 커밋으로 복귀
git checkout HEAD~1

# Firebase 재배포
firebase deploy --only hosting,functions
```

---

**마지막 업데이트**: 2026년 2월 19일
**버전**: v1.0.0-addons-feature
**담당자**: AI Agent (Sisyphus)
**승인자**: [관리자 승인 필요]
