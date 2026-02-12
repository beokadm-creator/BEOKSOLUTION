# 🔄 Aligo → NHN Cloud 알림톡 마이그레이션 가이드

## 📋 작업 완료 현황

### ✅ 완료된 작업

1. **NHN Cloud 유틸리티 생성**
   - `functions/src/utils/nhnCloud.ts` 생성
   - NHN Cloud API 연동 함수 구현
   - 템플릿 조회, 발송 이력 조회 기능 포함

2. **Infrastructure 설정 UI 변경**
   - `src/pages/admin/InfraPage.tsx` 수정
   - Aligo 설정 → NHN Cloud 설정으로 변경
   - 필드: `appKey`, `secretKey`, `senderKey`

3. **Notification Service 업데이트**
   - `functions/src/services/notificationService.ts` 수정
   - Aligo Provider 제거
   - NHN Provider 실제 API 호출 구현
   - `societyId` 파라미터 추가

### ⚠️ 남은 작업

1. **알림톡 발송 호출 부분 수정**
   - `functions/src/badge/index.ts` - 배지 발급 시 알림톡 발송
   - 기타 알림톡 발송 코드에 `societyId` 추가

2. **checkAlimTalkConfig 함수 수정**
   - `functions/src/alimtalk/checkConfig.ts`
   - Aligo 설정 확인 → NHN Cloud 설정 확인으로 변경

3. **Aligo 관련 코드 제거**
   - `functions/src/utils/aligo.ts` 삭제
   - `index.ts`에서 Aligo import 제거

4. **Functions 빌드 및 배포**

5. **Frontend 빌드 및 배포**

---

## 🎯 다음 단계: 알림톡 발송 코드 수정

### 1. badge/index.ts 수정

**현재 코드**:
```typescript
const { sendAlimTalk } = require('../utils/aligo');
await sendAlimTalk(phone, templateCode, variables, channelId);
```

**변경 후**:
```typescript
const { sendAlimTalk } = require('../services/notificationService');
await sendAlimTalk({
    phone,
    templateCode,
    variables
}, societyId);
```

### 2. societyId 가져오기

배지 발급 시 `conferenceId`에서 `societyId`를 가져와야 합니다:

```typescript
// Conference 문서에서 societyId 가져오기
const confSnap = await admin.firestore().collection('conferences').doc(conferenceId).get();
const societyId = confSnap.data()?.societyId;

if (!societyId) {
    throw new Error('Society ID not found');
}
```

---

## 📝 NHN Cloud 설정 방법

### 1. NHN Cloud Console 접속
1. https://console.nhncloud.com 로그인
2. KakaoTalk Bizmessage 서비스 활성화

### 2. 필요한 정보 확인
- **App Key**: Console → KakaoTalk Bizmessage → App Key 복사
- **Secret Key**: Console → KakaoTalk Bizmessage → Secret Key 생성/복사
- **Sender Key**: 카카오 채널 발신 프로필 키 (카카오톡 채널 관리자에서 확인)

### 3. Infrastructure 설정 입력
1. https://kadd.eregi.co.kr/admin/society/infra 접속
2. Notification Service 섹션에 입력:
   - App Key
   - Secret Key
   - Sender Key
3. "Save Configuration" 클릭

---

## 🔍 NHN Cloud vs Aligo 차이점

| 항목 | Aligo | NHN Cloud |
|------|-------|-----------|
| **API 방식** | Form Data (x-www-form-urlencoded) | JSON (application/json) |
| **인증** | API Key + User ID | App Key + Secret Key |
| **발신 프로필** | Sender Key (하드코딩) | Sender Key (Firestore 설정) |
| **템플릿 코드** | tpl_code | templateCode |
| **수신자** | receiver_1 | recipientNo |
| **변수** | message_1 등 | templateParameter (객체) |
| **응답** | ResultCode | header.isSuccessful |

---

## 🚀 배포 순서

### 1. Functions 배포
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### 2. Frontend 배포
```bash
npm run build
firebase deploy --only hosting
```

### 3. 설정 입력
- Infrastructure 페이지에서 NHN Cloud 설정 입력

### 4. 테스트
- 배지 발급 테스트
- 알림톡 발송 확인

---

## ⚠️ 주의사항

1. **템플릿 코드 변경 필요**
   - Aligo 템플릿 코드와 NHN Cloud 템플릿 코드가 다를 수 있음
   - NHN Cloud Console에서 템플릿 등록 및 승인 필요

2. **발신 프로필 키 확인**
   - 카카오톡 채널 관리자에서 발신 프로필 키 확인
   - NHN Cloud Console에 등록된 발신 프로필과 일치해야 함

3. **테스트 환경**
   - NHN Cloud는 별도 테스트 환경 없음
   - 실제 발송 전 템플릿 승인 필요

4. **비용**
   - Aligo: 선불 충전 방식
   - NHN Cloud: 후불 과금 방식

---

## 📞 문제 해결

### 발송 실패 시
1. Infrastructure 설정 확인 (App Key, Secret Key, Sender Key)
2. 템플릿 코드 확인 (NHN Cloud Console에서 승인된 템플릿인지)
3. 발신 프로필 키 확인 (카카오 채널과 일치하는지)
4. Functions 로그 확인 (`firebase functions:log`)

### 설정 확인 방법
- 슈퍼어드민 → 모니터링 → 알림톡 설정 확인
- 학회 선택 후 "확인" 버튼 클릭

---

## 📚 참고 문서

- [NHN Cloud AlimTalk API 가이드](https://docs.nhncloud.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-api-guide/)
- [카카오 비즈니스 메시지 가이드](https://business.kakao.com/info/bizmessage/)

---

**다음 작업**: `badge/index.ts` 수정 및 Functions 배포
