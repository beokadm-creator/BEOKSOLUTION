"use strict";
/**
 * NHN Cloud AlimTalk 사용 예제
 *
 * 이 파일은 NHN Cloud AlimTalk API 사용법을 보여주는 예제입니다.
 * 실제 프로젝트에서는 이 코드를 참고하여 구현하세요.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationCode = sendVerificationCode;
exports.sendRegistrationConfirmation = sendRegistrationConfirmation;
const nhnAlimTalk_1 = require("./nhnAlimTalk");
// ============================================
// 1. 템플릿 목록 조회 예제
// ============================================
async function exampleGetTemplates() {
    const senderKey = 'YOUR_SENDER_KEY'; // 카카오톡 채널의 발신 프로필 키
    const result = await (0, nhnAlimTalk_1.getTemplates)(senderKey);
    if (result.success) {
        console.log('템플릿 목록:', result.data);
        // 응답 예시:
        // {
        //   header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        //   templateListResponse: {
        //     templates: [
        //       {
        //         templateCode: 'TEMPLATE001',
        //         templateName: '회원가입 인증',
        //         templateContent: '안녕하세요. 인증번호는 #{code}입니다.',
        //         templateMessageType: 'BA', // BA: 기본형, EX: 부가정보형, AD: 광고추가형
        //         templateEmphasizeType: 'NONE', // NONE, TEXT, IMAGE
        //         templateStatus: 'APR', // APR: 승인, REG: 등록, REQ: 검수요청, REJ: 반려
        //         buttons: [...],
        //         ...
        //       }
        //     ],
        //     totalCount: 10
        //   }
        // }
    }
    else {
        console.error('템플릿 조회 실패:', result.error);
    }
}
// ============================================
// 2. 특정 템플릿 상세 조회 예제
// ============================================
async function exampleGetTemplateDetail() {
    const senderKey = 'YOUR_SENDER_KEY';
    const templateCode = 'TEMPLATE001';
    const result = await (0, nhnAlimTalk_1.getTemplateDetail)(senderKey, templateCode);
    if (result.success) {
        console.log('템플릿 상세:', result.data);
    }
    else {
        console.error('템플릿 상세 조회 실패:', result.error);
    }
}
// ============================================
// 3. 기본 알림톡 발송 예제
// ============================================
async function exampleSendBasicAlimTalk() {
    var _a, _b;
    const params = {
        senderKey: 'YOUR_SENDER_KEY',
        templateCode: 'TEMPLATE001',
        recipientNo: '01012345678', // 하이픈 없이
        content: '안녕하세요. 인증번호는 123456입니다.', // 템플릿 내용과 정확히 일치해야 함
    };
    const result = await (0, nhnAlimTalk_1.sendAlimTalk)(params);
    if (result.success) {
        console.log('발송 성공:', result.data);
        // 응답 예시:
        // {
        //   header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        //   message: {
        //     requestId: '20230101000000AbCdEfGhIjKlMnOpQrSt',
        //     senderGroupingKey: 'SenderGroupingKey',
        //     sendResults: [
        //       {
        //         recipientSeq: 1,
        //         recipientNo: '01012345678',
        //         resultCode: 0,
        //         resultMessage: 'SUCCESS',
        //         recipientGroupingKey: 'RecipientGroupingKey'
        //       }
        //     ]
        //   }
        // }
        // requestId를 저장해두면 나중에 발송 결과를 조회할 수 있습니다
        const requestId = (_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.requestId;
        if (requestId) {
            console.log('Request ID:', requestId);
        }
    }
    else {
        console.error('발송 실패:', result.error);
    }
}
// ============================================
// 4. 버튼이 있는 알림톡 발송 예제
// ============================================
async function exampleSendAlimTalkWithButtons() {
    const params = {
        senderKey: 'YOUR_SENDER_KEY',
        templateCode: 'TEMPLATE002',
        recipientNo: '01012345678',
        content: '안녕하세요. 회원가입이 완료되었습니다.',
        buttons: [
            {
                ordering: 1,
                type: 'WL', // WL: 웹링크
                name: '홈페이지 바로가기',
                linkMo: 'https://example.com', // 모바일 웹 링크
                linkPc: 'https://example.com', // PC 웹 링크
            },
            {
                ordering: 2,
                type: 'AL', // AL: 앱링크
                name: '앱에서 보기',
                schemeIos: 'myapp://home',
                schemeAndroid: 'myapp://home',
            },
        ],
    };
    const result = await (0, nhnAlimTalk_1.sendAlimTalk)(params);
    if (result.success) {
        console.log('버튼 포함 발송 성공:', result.data);
    }
    else {
        console.error('발송 실패:', result.error);
    }
}
// ============================================
// 5. 대체 발송(SMS/LMS) 포함 알림톡 발송 예제
// ============================================
async function exampleSendAlimTalkWithResend() {
    const params = {
        senderKey: 'YOUR_SENDER_KEY',
        templateCode: 'TEMPLATE001',
        recipientNo: '01012345678',
        content: '안녕하세요. 인증번호는 123456입니다.',
        // 대체 발송 설정
        isResend: true,
        resendType: 'SMS',
        resendContent: '[대체발송] 인증번호는 123456입니다.',
        resendSendNo: '01012345678', // 발신번호 (등록된 번호여야 함)
    };
    const result = await (0, nhnAlimTalk_1.sendAlimTalk)(params);
    if (result.success) {
        console.log('대체발송 설정 포함 발송 성공:', result.data);
    }
    else {
        console.error('발송 실패:', result.error);
    }
}
// ============================================
// 6. 예약 발송 예제
// ============================================
async function exampleSendScheduledAlimTalk() {
    const params = {
        senderKey: 'YOUR_SENDER_KEY',
        templateCode: 'TEMPLATE001',
        recipientNo: '01012345678',
        content: '안녕하세요. 예약된 메시지입니다.',
        requestDate: '2026-02-10 10:00', // yyyy-MM-dd HH:mm 형식
    };
    const result = await (0, nhnAlimTalk_1.sendAlimTalk)(params);
    if (result.success) {
        console.log('예약 발송 성공:', result.data);
    }
    else {
        console.error('예약 발송 실패:', result.error);
    }
}
// ============================================
// 7. 발송 결과 조회 예제
// ============================================
async function exampleGetMessageResult() {
    const requestId = '20230101000000AbCdEfGhIjKlMnOpQrSt'; // 발송 시 받은 requestId
    const result = await (0, nhnAlimTalk_1.getMessageResult)(requestId);
    if (result.success) {
        console.log('발송 결과:', result.data);
        // 응답 예시:
        // {
        //   header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        //   message: {
        //     requestId: '20230101000000AbCdEfGhIjKlMnOpQrSt',
        //     recipientSeq: 1,
        //     plusFriendId: '@플러스친구',
        //     senderKey: 'xxxxx',
        //     templateCode: 'TEMPLATE001',
        //     recipientNo: '01012345678',
        //     content: '메시지 내용',
        //     requestDate: '2023-01-01 00:00:00',
        //     receiveDate: '2023-01-01 00:00:05',
        //     createDate: '2023-01-01 00:00:00',
        //     resendStatus: 'NONE', // NONE, RSC(대체발송), RSF(대체발송실패)
        //     resendStatusName: '대체발송 없음',
        //     messageStatus: 'COMPLETED', // READY, COMPLETED, FAILED, CANCEL
        //     resultCode: '1000', // 1000: 성공
        //     resultCodeName: '성공'
        //   }
        // }
    }
    else {
        console.error('발송 결과 조회 실패:', result.error);
    }
}
// ============================================
// 8. 발송 내역 조회 예제 (날짜 범위)
// ============================================
async function exampleGetMessageList() {
    const result = await (0, nhnAlimTalk_1.getMessageList)({
        startRequestDate: '2026-02-01 00:00:00',
        endRequestDate: '2026-02-09 23:59:59',
        pageNum: 1,
        pageSize: 50,
        // 선택적 필터
        // recipientNo: '01012345678',
        // templateCode: 'TEMPLATE001',
        // messageStatus: 'COMPLETED',
    });
    if (result.success) {
        console.log('발송 내역:', result.data);
        // 응답 예시:
        // {
        //   header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        //   messageSearchResultResponse: {
        //     messages: [
        //       {
        //         requestId: '...',
        //         recipientSeq: 1,
        //         plusFriendId: '@플러스친구',
        //         templateCode: 'TEMPLATE001',
        //         recipientNo: '01012345678',
        //         content: '메시지 내용',
        //         requestDate: '2026-02-01 10:00:00',
        //         messageStatus: 'COMPLETED',
        //         resultCode: '1000',
        //         ...
        //       }
        //     ],
        //     totalCount: 100
        //   }
        // }
    }
    else {
        console.error('발송 내역 조회 실패:', result.error);
    }
}
// ============================================
// 9. 발신 프로필 카테고리 조회 예제
// ============================================
async function exampleGetSenderCategories() {
    const result = await (0, nhnAlimTalk_1.getSenderCategories)();
    if (result.success) {
        console.log('발신 프로필 카테고리:', result.data);
    }
    else {
        console.error('카테고리 조회 실패:', result.error);
    }
}
// ============================================
// 10. 실제 사용 예제: 회원가입 인증번호 발송
// ============================================
async function sendVerificationCode(phoneNumber, verificationCode, senderKey, templateCode) {
    var _a, _b;
    // 템플릿 내용 예시: "안녕하세요. 인증번호는 #{code}입니다."
    // 실제 발송 시에는 #{code}를 실제 값으로 치환해야 합니다
    const content = `안녕하세요. 인증번호는 ${verificationCode}입니다.`;
    const params = {
        senderKey,
        templateCode,
        recipientNo: phoneNumber.replace(/-/g, ''), // 하이픈 제거
        content,
        // 대체 발송 설정 (알림톡 발송 실패 시 SMS로 발송)
        isResend: true,
        resendType: 'SMS',
        resendContent: `[인증번호] ${verificationCode}`,
        resendSendNo: '01085491646', // 등록된 발신번호
    };
    const result = await (0, nhnAlimTalk_1.sendAlimTalk)(params);
    if (result.success) {
        console.log(`인증번호 발송 성공: ${phoneNumber}`);
        return {
            success: true,
            requestId: (_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.requestId,
        };
    }
    else {
        console.error(`인증번호 발송 실패: ${phoneNumber}`, result.error);
        return {
            success: false,
            error: result.error,
        };
    }
}
// ============================================
// 11. 실제 사용 예제: 행사 등록 완료 알림
// ============================================
async function sendRegistrationConfirmation(phoneNumber, userName, eventName, eventDate, badgeUrl, senderKey, templateCode) {
    // 템플릿 내용 예시:
    // "#{name}님, #{event} 등록이 완료되었습니다.\n일시: #{date}\n아래 버튼을 눌러 참가증을 확인하세요."
    var _a, _b;
    const content = `${userName}님, ${eventName} 등록이 완료되었습니다.\n일시: ${eventDate}\n아래 버튼을 눌러 참가증을 확인하세요.`;
    const params = {
        senderKey,
        templateCode,
        recipientNo: phoneNumber.replace(/-/g, ''),
        content,
        buttons: [
            {
                ordering: 1,
                type: 'WL',
                name: '참가증 확인',
                linkMo: badgeUrl,
                linkPc: badgeUrl,
            },
        ],
        // 대체 발송
        isResend: true,
        resendType: 'LMS',
        resendTitle: '행사 등록 완료',
        resendContent: `${userName}님, ${eventName} 등록이 완료되었습니다.\n일시: ${eventDate}\n참가증: ${badgeUrl}`,
        resendSendNo: '01085491646',
    };
    const result = await (0, nhnAlimTalk_1.sendAlimTalk)(params);
    if (result.success) {
        console.log(`등록 완료 알림 발송 성공: ${phoneNumber}`);
        return {
            success: true,
            requestId: (_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.requestId,
        };
    }
    else {
        console.error(`등록 완료 알림 발송 실패: ${phoneNumber}`, result.error);
        return {
            success: false,
            error: result.error,
        };
    }
}
// ============================================
// 버튼 타입 설명
// ============================================
/*
버튼 타입 (type):
- WL: 웹 링크 (linkMo, linkPc 필요)
- AL: 앱 링크 (schemeIos, schemeAndroid 필요)
- DS: 배송 조회
- BK: 봇 키워드
- MD: 메시지 전달
- BC: 상담톡 전환
- BT: 봇 전환
- AC: 채널 추가

메시지 상태 (messageStatus):
- READY: 발송 준비
- COMPLETED: 발송 완료
- FAILED: 발송 실패
- CANCEL: 발송 취소

결과 코드 (resultCode):
- 1000: 성공
- 기타: 실패 (각 코드별 의미는 NHN Cloud 문서 참조)
*/
exports.default = {
    exampleGetTemplates,
    exampleGetTemplateDetail,
    exampleSendBasicAlimTalk,
    exampleSendAlimTalkWithButtons,
    exampleSendAlimTalkWithResend,
    exampleSendScheduledAlimTalk,
    exampleGetMessageResult,
    exampleGetMessageList,
    exampleGetSenderCategories,
    sendVerificationCode,
    sendRegistrationConfirmation,
};
//# sourceMappingURL=nhnAlimTalk.examples.js.map