# NHN Cloud AlimTalk API 통합 가이드

NHN Cloud의 AlimTalk API를 사용하여 카카오톡 알림톡을 발송하는 방법을 안내합니다.

## 📋 목차

1. [API 키 정보](#api-키-정보)
2. [시작하기 전에](#시작하기-전에)
3. [파일 구조](#파일-구조)
4. [주요 기능](#주요-기능)
5. [빠른 시작](#빠른-시작)
6. [API 사용 예제](#api-사용-예제)
7. [테스트 방법](#테스트-방법)
8. [주의사항](#주의사항)
9. [문제 해결](#문제-해결)

---

## 🔑 API 키 정보

```
URL: https://api-alimtalk.cloud.toast.com
Appkey: Ik6GEBC22p5Qliqk
SecretKey: ajFUrusk8I7tgBQdrztuQvcf6jgWWcme
```

⚠️ **보안 주의**: 이 키들은 민감한 정보이므로 Git에 커밋하지 마세요. 환경 변수로 관리하는 것을 권장합니다.

---

## 🚀 시작하기 전에

### 1. 발신 프로필 키(Sender Key) 확인

NHN Cloud 콘솔에서 발신 프로필 키를 확인해야 합니다:

1. [NHN Cloud Console](https://console.toast.com) 로그인
2. **Notification > KakaoTalk Bizmessage** 메뉴 이동
3. **발신 프로필 관리** 탭에서 발신 프로필 키 확인

### 2. 템플릿 등록

알림톡을 발송하려면 먼저 템플릿을 등록하고 승인받아야 합니다:

1. NHN Cloud 콘솔에서 **템플릿 관리** 메뉴 이동
2. **템플릿 등록** 버튼 클릭
3. 템플릿 정보 입력 (템플릿명, 내용, 버튼 등)
4. 검수 요청 후 승인 대기 (보통 1-2일 소요)

### 3. 발신번호 등록 (대체 발송용)

대체 발송(SMS/LMS)을 사용하려면 발신번호를 등록해야 합니다:

1. **Notification > SMS** 메뉴 이동
2. **발신번호 관리** 탭에서 발신번호 등록
3. 인증 절차 완료

---

## 📁 파일 구조

```
functions/src/utils/
├── nhnAlimTalk.ts           # 핵심 API 함수들
├── nhnAlimTalk.examples.ts  # 사용 예제 모음
├── nhnAlimTalk.test.ts      # 테스트 스크립트
└── aligo.ts                 # 기존 Aligo API (참고용)
```

---

## 🎯 주요 기능

### 1. 템플릿 관리
- `getTemplates(senderKey)` - 템플릿 목록 조회
- `getTemplateDetail(senderKey, templateCode)` - 템플릿 상세 조회

### 2. 메시지 발송
- `sendAlimTalk(params)` - 알림톡 발송
  - 기본 발송
  - 버튼 포함 발송
  - 대체 발송 (SMS/LMS) 설정
  - 예약 발송

### 3. 발송 내역 조회
- `getMessageResult(requestId)` - 특정 메시지 결과 조회
- `getMessageList(params)` - 발송 내역 목록 조회

### 4. 기타
- `getSenderCategories()` - 발신 프로필 카테고리 조회

---

## ⚡ 빠른 시작

### 1. 기본 사용법

```typescript
import { sendAlimTalk } from './utils/nhnAlimTalk';

// 알림톡 발송
const result = await sendAlimTalk({
  senderKey: 'YOUR_SENDER_KEY',
  templateCode: 'TEMPLATE001',
  recipientNo: '01012345678',
  content: '안녕하세요. 테스트 메시지입니다.',
});

if (result.success) {
  console.log('발송 성공!', result.data);
} else {
  console.error('발송 실패:', result.error);
}
```

### 2. 템플릿 조회

```typescript
import { getTemplates } from './utils/nhnAlimTalk';

const result = await getTemplates('YOUR_SENDER_KEY');

if (result.success) {
  const templates = result.data?.templateListResponse?.templates || [];
  templates.forEach(template => {
    console.log(`${template.templateName} (${template.templateCode})`);
  });
}
```

---

## 📚 API 사용 예제

자세한 예제는 `nhnAlimTalk.examples.ts` 파일을 참고하세요.

### 예제 1: 회원가입 인증번호 발송

```typescript
import { sendAlimTalk } from './utils/nhnAlimTalk';

async function sendVerificationCode(phoneNumber: string, code: string) {
  const result = await sendAlimTalk({
    senderKey: 'YOUR_SENDER_KEY',
    templateCode: 'VERIFY_CODE',
    recipientNo: phoneNumber.replace(/-/g, ''),
    content: `안녕하세요. 인증번호는 ${code}입니다.`,
    
    // 대체 발송 설정
    isResend: true,
    resendType: 'SMS',
    resendContent: `[인증번호] ${code}`,
    resendSendNo: '01085491646',
  });
  
  return result;
}
```

### 예제 2: 행사 등록 완료 알림 (버튼 포함)

```typescript
async function sendEventConfirmation(
  phoneNumber: string,
  userName: string,
  eventName: string,
  badgeUrl: string
) {
  const result = await sendAlimTalk({
    senderKey: 'YOUR_SENDER_KEY',
    templateCode: 'EVENT_CONFIRM',
    recipientNo: phoneNumber.replace(/-/g, ''),
    content: `${userName}님, ${eventName} 등록이 완료되었습니다.`,
    buttons: [
      {
        ordering: 1,
        type: 'WL',
        name: '참가증 확인',
        linkMo: badgeUrl,
        linkPc: badgeUrl,
      },
    ],
  });
  
  return result;
}
```

### 예제 3: 예약 발송

```typescript
async function sendScheduledMessage() {
  const result = await sendAlimTalk({
    senderKey: 'YOUR_SENDER_KEY',
    templateCode: 'REMINDER',
    recipientNo: '01012345678',
    content: '내일 행사가 있습니다. 잊지 마세요!',
    requestDate: '2026-02-10 09:00', // yyyy-MM-dd HH:mm
  });
  
  return result;
}
```

---

## 🧪 테스트 방법

### 1. 테스트 스크립트 설정

`nhnAlimTalk.test.ts` 파일을 열고 설정값을 수정하세요:

```typescript
const TEST_CONFIG = {
  senderKey: 'YOUR_SENDER_KEY_HERE',      // 실제 발신 프로필 키
  testPhoneNumber: '01012345678',          // 테스트용 수신 번호
  testTemplateCode: 'TEMPLATE001',         // 실제 템플릿 코드
};
```

### 2. 테스트 실행

```bash
# 템플릿 목록 조회 테스트 (안전)
npx ts-node functions/src/utils/nhnAlimTalk.test.ts

# 또는 Firebase Functions 환경에서
cd functions
npm run build
node lib/utils/nhnAlimTalk.test.js
```

### 3. 단계별 테스트 권장 순서

1. ✅ **템플릿 목록 조회** - 발신 프로필 키 확인
2. ✅ **템플릿 상세 조회** - 템플릿 내용 확인
3. ✅ **발송 내역 조회** - 기존 발송 내역 확인
4. ⚠️ **알림톡 발송** - 실제 메시지 발송 (주의!)

---

## ⚠️ 주의사항

### 1. 템플릿 내용 일치

발송하는 `content`는 등록된 템플릿 내용과 **정확히 일치**해야 합니다.

```typescript
// ❌ 잘못된 예
템플릿: "안녕하세요. 인증번호는 #{code}입니다."
발송: "안녕하세요. 인증번호는 123456입니다."  // #{code} 부분만 치환

// ✅ 올바른 예
템플릿: "안녕하세요. 인증번호는 #{code}입니다."
발송: "안녕하세요. 인증번호는 123456입니다."  // 전체 내용 일치
```

### 2. 전화번호 형식

전화번호는 **하이픈 없이** 입력해야 합니다.

```typescript
// ❌ 잘못된 예
recipientNo: '010-1234-5678'

// ✅ 올바른 예
recipientNo: '01012345678'
```

### 3. 버튼 타입

버튼 타입에 따라 필수 필드가 다릅니다:

- `WL` (웹링크): `linkMo`, `linkPc` 필요
- `AL` (앱링크): `schemeIos`, `schemeAndroid` 필요

### 4. 대체 발송

대체 발송을 사용하려면:
- 발신번호가 NHN Cloud SMS에 등록되어 있어야 함
- `resendSendNo`에 등록된 발신번호 입력

### 5. 요금

- 알림톡: 건당 약 8-15원 (템플릿 타입에 따라 다름)
- 대체 발송 SMS: 건당 약 20원
- 대체 발송 LMS: 건당 약 50원

---

## 🔧 문제 해결

### 문제 1: 템플릿 조회 시 404 에러

**원인**: 잘못된 발신 프로필 키 또는 Appkey

**해결**:
1. NHN Cloud 콘솔에서 발신 프로필 키 재확인
2. `nhnAlimTalk.ts`의 `appKey` 확인

### 문제 2: 발송 시 "템플릿 내용 불일치" 에러

**원인**: 발송 내용이 템플릿과 정확히 일치하지 않음

**해결**:
1. 템플릿 상세 조회로 정확한 내용 확인
2. 변수 부분(#{변수명})을 실제 값으로 정확히 치환
3. 공백, 줄바꿈까지 정확히 일치시키기

### 문제 3: 대체 발송이 작동하지 않음

**원인**: 발신번호 미등록 또는 잘못된 번호

**해결**:
1. NHN Cloud SMS 콘솔에서 발신번호 등록 확인
2. `resendSendNo`에 정확한 번호 입력 (하이픈 없이)

### 문제 4: 401 Unauthorized 에러

**원인**: 잘못된 SecretKey

**해결**:
1. NHN Cloud 콘솔에서 SecretKey 재확인
2. `nhnAlimTalk.ts`의 `secretKey` 업데이트

---

## 📖 참고 자료

- [NHN Cloud AlimTalk API 가이드](https://docs.toast.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-api-guide/)
- [NHN Cloud Console](https://console.toast.com)
- [카카오 비즈니스 채널 관리자센터](https://business.kakao.com)

---

## 🔄 Aligo에서 마이그레이션

기존 Aligo API를 사용하고 있다면:

1. `aligo.ts`의 함수 호출을 `nhnAlimTalk.ts`로 변경
2. 파라미터 형식 조정 (NHN Cloud 형식에 맞게)
3. 응답 데이터 구조 변경 반영

**주요 차이점**:

| 항목 | Aligo | NHN Cloud |
|------|-------|-----------|
| API 형식 | Form Data | JSON |
| 인증 방식 | apikey + userid | X-Secret-Key 헤더 |
| 템플릿 변수 | 자동 치환 | 수동 치환 필요 |
| 응답 구조 | 단순 | 계층적 (header + data) |

---

## 💡 팁

1. **개발 환경에서는 테스트 템플릿 사용**: 실제 서비스 템플릿과 별도로 테스트용 템플릿을 만들어 사용하세요.

2. **requestId 저장**: 발송 시 받은 `requestId`를 데이터베이스에 저장하면 나중에 발송 결과를 추적할 수 있습니다.

3. **에러 로깅**: 발송 실패 시 에러 정보를 로깅하여 문제를 빠르게 파악하세요.

4. **발송 전 검증**: 전화번호 형식, 템플릿 내용 일치 여부를 발송 전에 검증하세요.

5. **대체 발송 활용**: 알림톡 발송 실패 시 SMS로 대체 발송되도록 설정하면 도달률을 높일 수 있습니다.

---

## 📞 문의

문제가 발생하거나 질문이 있으면:
- NHN Cloud 고객센터: support@toast.com
- 카카오 비즈니스 고객센터: 1544-4293

---

**마지막 업데이트**: 2026-02-09
