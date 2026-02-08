# 🚀 eRegi Monitoring System Deployment Guide

## 📋 Overview

eRegi 시스템 관제 장치가 성공적으로 구현되었습니다. 이 가이드를 따라 배포 및 설정을 완료하세요.

---

## ✅ 구현 완료된 기능

### Phase 1: 런타임 에러 감지 ✅
- [x] Firebase Performance Monitoring SDK 통합
- [x] Firestore 에러 로그 컬렉션 구조 설계
- [x] GlobalErrorBoundary에 에러 로깅 통합
- [x] 에러 중복 제거 및 카운팅 (Cloud Function)
- [x] 즉각적 이메일 알림 (Critical/High severity)

### Phase 2: 데이터 무결성 감지 ✅
- [x] Registrations 트리거 (결제 금액, 상태 검증)
- [x] Members 트리거 (회원 코드 사용 검증)
- [x] 비정상 데이터 자동 감지 및 알림

### Phase 3: 성능 모니터링 ✅
- [x] Web Vitals 자동 수집 (LCP, INP, CLS, FCP, TTFB)
- [x] API 응답 시간 추적 유틸리티
- [x] 성능 저하 자동 감지

### Phase 4: 알림 시스템 ✅
- [x] Nodemailer + Gmail SMTP 설정
- [x] 이메일 발송 Cloud Function
- [x] 일일 에러 리포트 (매일 오전 9시 KST)
- [x] 주간 성능 리포트 (매주 월요일 오전 9시 KST)

---

## 🔧 배포 단계

### Step 1: Firebase Functions 배포

```bash
# Functions 디렉토리로 이동
cd functions

# 의존성 설치 (이미 완료됨)
npm install

# TypeScript 컴파일
npm run build

# Cloud Functions 배포
firebase deploy --only functions
```

**배포될 함수:**
- `logError` - 에러 로그 저장
- `logPerformance` - 성능 메트릭 저장
- `monitorRegistrationIntegrity` - 등록 데이터 무결성 감시
- `monitorMemberCodeIntegrity` - 회원 코드 무결성 감시
- `dailyErrorReport` - 일일 에러 리포트 (Scheduled)
- `weeklyPerformanceReport` - 주간 성능 리포트 (Scheduled)

### Step 2: Firestore 보안 규칙 배포

```bash
# Firestore 규칙 및 인덱스 배포
firebase deploy --only firestore:rules,firestore:indexes
```

**변경 사항:**
- `logs/**` 컬렉션 추가 (Super Admin 전용 접근)

### Step 3: React 앱 배포

```bash
# 프로젝트 루트로 이동
cd ..

# 의존성 설치
npm install

# 프로덕션 빌드
npm run build

# Firebase Hosting 배포
firebase deploy --only hosting
```

---

## ⚙️ 설정 필수 사항

### 1. Gmail SMTP 설정 (중요!)

**Gmail 앱 비밀번호 생성:**

1. Google 계정 설정 보안으로 이동
2. 2단계 인증 활성화
3. "앱 비밀번호" 생성
   - 앱: "메일"
   - 기기: "기타" → "eRegi Monitoring"

**Firebase Functions 환경 변수 설정:**

```bash
# Firebase Console → Functions → 환경 변수 설정
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
ADMIN_EMAIL=admin@eregi.co.kr
```

또는 `.runtimeconfig.json` 파일 생성:

```json
{
  "email": {
    "user": "your-email@gmail.com",
    "password": "your-app-password",
    "from": "eRegi System <noreply@eregi.co.kr>",
    "admin": "admin@eregi.co.kr"
  }
}
```

### 2. Firebase 프로젝트 설정 확인

**Performance Monitoring 활성화:**
1. Firebase Console → 프로젝트 선택
2. Performance 탭으로 이동
3. "Performance Monitoring 사용" 클릭

---

## 📊 사용 방법

### 에러 모니터링 확인

**Firebase Console:**
1. Firestore Database → `logs/errors/{날짜}`
2. 최근 에러 목록 확인
3. 필터: 심각도, 카테고리

**일일 리포트:**
- 매일 오전 9시에 자동 발송
- 총 에러 수, Critical/High 에러 수
- 상위 10개 에러 패턴

### 성능 모니터링 확인

**Firebase Console:**
1. Performance 탭
2. Web Vitals 대시보드 확인

**Firestore:**
1. `logs/performance/{날짜}` 컬렉션
2. 성능 메트릭 상세 조회

### 데이터 무결성 알림

**Firestore:**
1. `logs/data_integrity/{날짜}` 컬렉션
2. 감지된 이상 징후 확인

---

## 🧪 테스트 시나리오

### 1. 에러 로깅 테스트

```typescript
// 브라우저 콘솔에서 실행
import { logError } from '@/utils/errorLogger';

// 테스트 에러 발생
const testError = new Error('This is a test error');
await logError(testError, {
  component: 'TestComponent',
  action: 'TestAction',
});
```

**예상 결과:**
- Firebase Console → `logs/errors/오늘날짜`에 에러 기록
- Critical/High 심각도면 이메일 수신

### 2. 데이터 무결성 테스트

```javascript
// Firebase Console에서 테스트
// 1. registrations에 음수 amount로 문서 생성
db.collection('conferences/test/registrations').add({
  amount: -1000,
  paymentStatus: 'PAID',
  email: 'test@example.com'
});

// 예상: logs/data_integrity에 알림 생성
```

### 3. 성능 모니터링 테스트

```typescript
// 앱에서 사용자 행동 시뮬레이션
// 1. 페이지 로드
// 2. Firebase Console → Performance 탭에서 메트릭 확인
// 3. logs/performance 컬렉션에 데이터 저장 확인
```

---

## 📱 모니터링 대시보드 (선택사항)

빠른 확인을 위해 Firebase Console을 사용하세요:

1. **Firestore Database**
   - `logs/errors/{날짜}` - 에러 로그
   - `logs/performance/{날짜}` - 성능 메트릭
   - `logs/data_integrity/{날짜}` - 데이터 무결성 알림

2. **Performance Monitoring**
   - Web Vitals 대시보드
   - 페이지 로드 시간
   - 네트워크 요청 시간

3. **Cloud Functions**
   - 로그 확인
   - 함수 실행 시간
   - 에러 추적

---

## 🔄 유지 보수

### 로그 보관 정책

90일 이상 된 로그 자동 삭제 (Scheduled Function):

```typescript
// functions/src/utils/cleanup.ts
export const cleanupOldLogs = functions.pubsub
    .schedule('0 2 1 * *') // 매월 1일 새벽 2시
    .onRun(async (context) => {
        // 90일 이상 된 로그 삭제
        // ...
    });
```

### 알림 설정 변경

이메일 수신 주소 변경:
```bash
EMAIL_USER=new-email@gmail.com
EMAIL_PASSWORD=new-app-password
ADMIN_EMAIL=new-admin@eregi.co.kr
```

---

## 🎯 완료 체크리스트

배포 전 확인:

- [ ] Firebase Functions 배포 완료
- [ ] Firestore 보안 규칙 배포 완료
- [ ] React 앱 배포 완료
- [ ] Gmail SMTP 설정 완료 (EMAIL_USER, EMAIL_PASSWORD)
- [ ] Admin email 설정 완료 (ADMIN_EMAIL)
- [ ] Firebase Performance Monitoring 활성화
- [ ] 테스트 에러 발생시켜 로그 저장 확인
- [ ] 일일 리포트가 다음날 오전 9시에 도착하는지 확인

---

## 🆘 문제 해결

### 이메일이 전송되지 않음

1. Gmail SMTP 설정 확인
2. 앱 비밀번호가 올바른지 확인
3. Firebase Functions 로그 확인

### 에러가 로깅되지 않음

1. Cloud Functions 로그 확인
2. Firestore 쓰기 권한 확인
3. 에러 분류 로직 확인

### 성능 메트릭 수집 안됨

1. WebVitalsMonitor 컴포넌트가 App.tsx에 있는지 확인
2. 브라우저 콘솔 에러 확인
3. Firebase Performance Monitoring 활성화 확인

---

## 📞 지원

문제 발생 시:
1. Firebase Functions 로그 확인
2. Firestore Database 규칙 확인
3. 이 문서의 문제 해결 섹션 참조

---

**배포 준비 완료!** 🚀

`firebase deploy --only functions,firestore,hosting` 명령어로 전체 배포를 실행하세요.
