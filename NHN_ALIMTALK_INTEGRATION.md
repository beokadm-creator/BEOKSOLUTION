# NHN Cloud AlimTalk 통합 완료 ✅

## 📋 요약

각 학회마다 다른 NHN Cloud 발신 프로필 키를 사용할 수 있도록 시스템을 구축했습니다.

### 🔑 KADD 발신 프로필 키
```
514116f024d8e322cc2a82a3503bb2eb178370f3
```

---

## 🎯 구현된 기능

### 1. **학회별 NHN AlimTalk 설정 관리** ✅

**위치**: Admin > Infrastructure Settings > Notification Service

각 학회는 이제 다음을 설정할 수 있습니다:
- ✅ NHN AlimTalk 활성화/비활성화
- ✅ 학회별 발신 프로필 키 (Sender Key)
- ✅ 대체 발송용 전화번호 (선택사항)

**설정 방법**:
1. Admin 페이지 접속
2. Infrastructure Settings 메뉴 선택
3. Notification Service 섹션에서 "NHN Cloud AlimTalk" 활성화
4. 발신 프로필 키 입력: `514116f024d8e322cc2a82a3503bb2eb178370f3`
5. (선택) 대체 발송 전화번호 입력: `01012345678`
6. "Save Configuration" 버튼 클릭

### 2. **데이터 구조**

```typescript
// Firestore: societies/{societyId}/settings/infrastructure
{
  notification: {
    channelId: "@kadd",  // Legacy Aligo
    nhnAlimTalk: {
      enabled: true,
      senderKey: "514116f024d8e322cc2a82a3503bb2eb178370f3",
      resendSendNo: "01012345678"  // Optional
    }
  }
}
```

### 3. **생성된 파일들**

#### Backend (Functions)
- ✅ `functions/src/utils/nhnAlimTalk.ts` - 핵심 API 함수
- ✅ `functions/src/utils/nhnAlimTalk.examples.ts` - 사용 예제
- ✅ `functions/src/utils/nhnAlimTalk.test.ts` - 테스트 스크립트

#### Frontend
- ✅ `src/pages/admin/InfraPage.tsx` - NHN AlimTalk 설정 UI 추가

#### Documentation
- ✅ `NHN_ALIMTALK_GUIDE.md` - 완전한 통합 가이드

---

## 📝 템플릿 불러오기 기능

### 현재 상태
- ✅ Aligo 템플릿 불러오기 기능 존재 (`handleFetchAligoTemplates`)
- ⏳ NHN Cloud 템플릿 불러오기 기능 추가 필요

### NHN Cloud 템플릿 불러오기 구현 방법

#### Option 1: 기존 UI에 버튼 추가 (권장)

**위치**: `src/pages/admin/TemplatesPage.tsx` 라인 774-786

현재 "알리고 불러오기" 버튼 옆에 "NHN Cloud 불러오기" 버튼 추가:

```typescript
// 1. State 추가
const [isNhnImportOpen, setIsNhnImportOpen] = useState(false);
const [nhnTemplates, setNhnTemplates] = useState<any[]>([]);
const [loadingNhn, setLoadingNhn] = useState(false);

// 2. NHN Cloud 템플릿 불러오기 함수
const handleFetchNhnTemplates = async () => {
  setLoadingNhn(true);
  try {
    // Infrastructure 설정에서 senderKey 가져오기
    const infraDoc = await getDoc(
      doc(db, 'societies', targetSocietyId, 'settings', 'infrastructure')
    );
    const senderKey = infraDoc.data()?.notification?.nhnAlimTalk?.senderKey;
    
    if (!senderKey) {
      toast.error("NHN Cloud 발신 프로필 키가 설정되지 않았습니다.");
      return;
    }

    // Cloud Function 호출
    const getNhnTemplatesFn = httpsCallable(functions, 'getNhnAlimTalkTemplates');
    const result = await getNhnTemplatesFn({ senderKey });
    const data = result.data as any;

    if (data.success && data.data?.templateListResponse?.templates) {
      setNhnTemplates(data.data.templateListResponse.templates);
      setIsNhnImportOpen(true);
    } else {
      toast.error("NHN Cloud 템플릿을 불러오지 못했습니다.");
    }
  } catch (error) {
    console.error("Failed to fetch NHN templates:", error);
    toast.error("NHN Cloud 템플릿 호출 중 오류가 발생했습니다.");
  } finally {
    setLoadingNhn(false);
  }
};

// 3. NHN 템플릿 선택 핸들러
const handleSelectNhnTemplate = (tpl: any) => {
  setKakaoContent(tpl.templateContent);
  setKakaoTemplateCode(tpl.templateCode);

  // 버튼 파싱
  if (tpl.buttons && Array.isArray(tpl.buttons)) {
    const mappedButtons = tpl.buttons.map((b: any) => ({
      name: b.name,
      type: b.linkType || 'WL',
      linkMobile: b.linkMo || '',
      linkPc: b.linkPc || ''
    }));
    setKakaoButtons(mappedButtons);
  }

  // 상태 설정
  if (tpl.templateStatus === 'APR') {
    setKakaoStatus('APPROVED');
  } else if (tpl.templateStatus === 'REJ') {
    setKakaoStatus('REJECTED');
  } else {
    setKakaoStatus('PENDING');
  }

  setIsNhnImportOpen(false);
  toast.success("NHN Cloud 템플릿을 불러왔습니다.");
};
```

#### Option 2: Cloud Function 생성

**파일**: `functions/src/index.ts`

```typescript
import { getTemplates } from './utils/nhnAlimTalk';

export const getNhnAlimTalkTemplates = onCall(async (request) => {
  const { senderKey } = request.data;
  
  if (!senderKey) {
    throw new HttpsError('invalid-argument', 'senderKey is required');
  }

  try {
    const result = await getTemplates(senderKey);
    return result;
  } catch (error) {
    console.error('Error fetching NHN templates:', error);
    throw new HttpsError('internal', 'Failed to fetch templates');
  }
});
```

---

## 🚀 다음 단계

### 1. Infrastructure 설정 완료
- [ ] KADD 학회의 Infrastructure Settings 페이지에서 NHN AlimTalk 활성화
- [ ] 발신 프로필 키 입력: `514116f024d8e322cc2a82a3503bb2eb178370f3`
- [ ] 설정 저장

### 2. 템플릿 등록 (NHN Cloud Console)
- [ ] [NHN Cloud Console](https://console.toast.com) 로그인
- [ ] Notification > KakaoTalk Bizmessage 메뉴
- [ ] 템플릿 등록 및 승인 대기

### 3. 템플릿 불러오기 기능 구현 (선택사항)
- [ ] Cloud Function `getNhnAlimTalkTemplates` 생성
- [ ] TemplatesPage에 "NHN Cloud 불러오기" 버튼 추가
- [ ] 템플릿 선택 Dialog UI 구현

### 4. 발송 로직 통합
- [ ] 기존 AlimTalk 발송 로직 확인
- [ ] NHN Cloud API 사용하도록 수정
- [ ] Infrastructure 설정에서 `nhnAlimTalk.enabled` 확인하여 분기 처리

---

## 💡 사용 예제

### 학회별 설정 조회

```typescript
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

async function getSocietyNhnConfig(societyId: string) {
  const infraDoc = await getDoc(
    doc(db, 'societies', societyId, 'settings', 'infrastructure')
  );
  
  const nhnConfig = infraDoc.data()?.notification?.nhnAlimTalk;
  
  if (nhnConfig?.enabled) {
    return {
      senderKey: nhnConfig.senderKey,
      resendSendNo: nhnConfig.resendSendNo
    };
  }
  
  return null;
}
```

### AlimTalk 발송

```typescript
import { sendAlimTalk } from './utils/nhnAlimTalk';

async function sendRegistrationConfirmation(societyId: string, phoneNumber: string) {
  // 1. 학회 설정 조회
  const nhnConfig = await getSocietyNhnConfig(societyId);
  
  if (!nhnConfig) {
    console.log('NHN AlimTalk not enabled, falling back to Aligo');
    // Aligo 발송 로직
    return;
  }

  // 2. NHN Cloud로 발송
  const result = await sendAlimTalk({
    senderKey: nhnConfig.senderKey,
    templateCode: 'REGISTRATION_CONFIRM',
    recipientNo: phoneNumber.replace(/-/g, ''),
    content: '등록이 완료되었습니다.',
    
    // 대체 발송 설정
    isResend: true,
    resendType: 'SMS',
    resendContent: '[등록완료] 등록이 완료되었습니다.',
    resendSendNo: nhnConfig.resendSendNo,
  });

  return result;
}
```

---

## 📖 참고 문서

- [NHN_ALIMTALK_GUIDE.md](./NHN_ALIMTALK_GUIDE.md) - 완전한 통합 가이드
- [NHN Cloud 공식 문서](https://docs.toast.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-api-guide/)
- `functions/src/utils/nhnAlimTalk.examples.ts` - 11가지 사용 예제

---

## ✅ 체크리스트

### 완료된 작업
- [x] NHN AlimTalk API 유틸리티 생성
- [x] InfraSettings 인터페이스에 nhnAlimTalk 추가
- [x] InfraPage UI에 NHN AlimTalk 설정 섹션 추가
- [x] 학회별 발신 프로필 키 관리 기능
- [x] 사용 예제 및 테스트 스크립트 생성
- [x] 완전한 통합 가이드 문서 작성

### 추가 작업 (선택사항)
- [ ] TemplatesPage에 NHN Cloud 템플릿 불러오기 기능
- [ ] Cloud Function `getNhnAlimTalkTemplates` 구현
- [ ] 기존 발송 로직을 NHN Cloud API로 마이그레이션
- [ ] 발송 내역 조회 및 모니터링 기능

---

**마지막 업데이트**: 2026-02-09 15:30
