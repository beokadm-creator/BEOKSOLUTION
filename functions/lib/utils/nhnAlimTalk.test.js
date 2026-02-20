"use strict";
/**
 * NHN Cloud AlimTalk API 테스트 스크립트
 *
 * 사용법:
 * 1. 발신 프로필 키(senderKey)를 NHN Cloud 콘솔에서 확인하여 입력
 * 2. 원하는 테스트 함수의 주석을 해제하고 실행
 *
 * 실행 방법:
 * npx ts-node functions/src/utils/nhnAlimTalk.test.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const nhnAlimTalk_1 = require("./nhnAlimTalk");
// ============================================
// 설정값 (실제 값으로 변경하세요)
// ============================================
const TEST_CONFIG = {
    // NHN Cloud 콘솔에서 확인한 발신 프로필 키
    senderKey: 'YOUR_SENDER_KEY_HERE',
    // 테스트용 수신 번호 (본인 번호 권장)
    testPhoneNumber: '01012345678',
    // 테스트용 템플릿 코드 (실제 등록된 템플릿 코드)
    testTemplateCode: 'TEMPLATE001',
};
// ============================================
// 테스트 함수들
// ============================================
/**
 * 1. 템플릿 목록 조회 테스트
 */
async function testGetTemplates() {
    var _a, _b;
    console.log('\n========== 템플릿 목록 조회 테스트 ==========');
    const result = await (0, nhnAlimTalk_1.getTemplates)(TEST_CONFIG.senderKey);
    if (result.success) {
        console.log('✅ 성공!');
        console.log('응답 데이터:', JSON.stringify(result.data, null, 2));
        // 템플릿 목록 출력
        const templates = ((_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.templateListResponse) === null || _b === void 0 ? void 0 : _b.templates) || [];
        console.log(`\n총 ${templates.length}개의 템플릿:`);
        templates.forEach((template, index) => {
            var _a;
            const tpl = template;
            console.log(`\n[${index + 1}] ${tpl.templateName}`);
            console.log(`  - 코드: ${tpl.templateCode}`);
            console.log(`  - 상태: ${tpl.templateStatus}`);
            console.log(`  - 내용: ${(_a = tpl.templateContent) === null || _a === void 0 ? void 0 : _a.substring(0, 50)}...`);
        });
    }
    else {
        console.error('❌ 실패:', result.error);
    }
}
/**
 * 2. 특정 템플릿 상세 조회 테스트
 */
async function testGetTemplateDetail() {
    console.log('\n========== 템플릿 상세 조회 테스트 ==========');
    const result = await (0, nhnAlimTalk_1.getTemplateDetail)(TEST_CONFIG.senderKey, TEST_CONFIG.testTemplateCode);
    if (result.success) {
        console.log('✅ 성공!');
        console.log('응답 데이터:', JSON.stringify(result.data, null, 2));
    }
    else {
        console.error('❌ 실패:', result.error);
    }
}
/**
 * 3. 기본 알림톡 발송 테스트
 */
async function testSendBasicAlimTalk() {
    var _a, _b;
    console.log('\n========== 기본 알림톡 발송 테스트 ==========');
    console.log('⚠️  실제 메시지가 발송됩니다!');
    const result = await (0, nhnAlimTalk_1.sendAlimTalk)({
        senderKey: TEST_CONFIG.senderKey,
        templateCode: TEST_CONFIG.testTemplateCode,
        recipientNo: TEST_CONFIG.testPhoneNumber,
        content: '테스트 메시지입니다.', // 실제 템플릿 내용과 일치해야 함
    });
    if (result.success) {
        console.log('✅ 발송 성공!');
        console.log('응답 데이터:', JSON.stringify(result.data, null, 2));
        const requestId = (_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.requestId;
        if (requestId) {
            console.log(`\n📝 Request ID: ${requestId}`);
            console.log('이 ID로 발송 결과를 조회할 수 있습니다.');
        }
    }
    else {
        console.error('❌ 발송 실패:', result.error);
    }
}
/**
 * 4. 발송 결과 조회 테스트
 */
async function testGetMessageResult() {
    var _a;
    console.log('\n========== 발송 결과 조회 테스트 ==========');
    // 실제 requestId로 변경하세요
    const requestId = 'YOUR_REQUEST_ID_HERE';
    const result = await (0, nhnAlimTalk_1.getMessageResult)(requestId);
    if (result.success) {
        console.log('✅ 성공!');
        console.log('응답 데이터:', JSON.stringify(result.data, null, 2));
        const message = (_a = result.data) === null || _a === void 0 ? void 0 : _a.message;
        if (message) {
            console.log('\n발송 상태:', message.messageStatus);
            console.log('결과 코드:', message.resultCode);
            console.log('결과 메시지:', message.resultCodeName);
        }
    }
    else {
        console.error('❌ 실패:', result.error);
    }
}
/**
 * 5. 발송 내역 조회 테스트 (최근 7일)
 */
async function testGetMessageList() {
    var _a, _b, _c, _d;
    console.log('\n========== 발송 내역 조회 테스트 ==========');
    // 최근 7일 내역 조회
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const formatDate = (date) => {
        return date.toISOString().slice(0, 19).replace('T', ' ');
    };
    const result = await (0, nhnAlimTalk_1.getMessageList)({
        startRequestDate: formatDate(startDate),
        endRequestDate: formatDate(endDate),
        pageNum: 1,
        pageSize: 10,
    });
    if (result.success) {
        console.log('✅ 성공!');
        const messages = ((_b = (_a = result.data) === null || _a === void 0 ? void 0 : _a.messageSearchResultResponse) === null || _b === void 0 ? void 0 : _b.messages) || [];
        const totalCount = ((_d = (_c = result.data) === null || _c === void 0 ? void 0 : _c.messageSearchResultResponse) === null || _d === void 0 ? void 0 : _d.totalCount) || 0;
        console.log(`\n총 ${totalCount}건의 발송 내역 (최근 10건 표시):`);
        messages.forEach((msg, index) => {
            const message = msg;
            console.log(`\n[${index + 1}]`);
            console.log(`  Request ID: ${message.requestId}`);
            console.log(`  수신번호: ${message.recipientNo}`);
            console.log(`  템플릿: ${message.templateCode}`);
            console.log(`  발송일시: ${message.requestDate}`);
            console.log(`  상태: ${message.messageStatus} (${message.resultCodeName})`);
        });
    }
    else {
        console.error('❌ 실패:', result.error);
    }
}
/**
 * 6. 발신 프로필 카테고리 조회 테스트
 */
async function testGetSenderCategories() {
    console.log('\n========== 발신 프로필 카테고리 조회 테스트 ==========');
    const result = await (0, nhnAlimTalk_1.getSenderCategories)();
    if (result.success) {
        console.log('✅ 성공!');
        console.log('응답 데이터:', JSON.stringify(result.data, null, 2));
    }
    else {
        console.error('❌ 실패:', result.error);
    }
}
// ============================================
// 메인 실행 함수
// ============================================
async function main() {
    console.log('🚀 NHN Cloud AlimTalk API 테스트 시작\n');
    console.log('설정값:');
    console.log(`  - Sender Key: ${TEST_CONFIG.senderKey}`);
    console.log(`  - Test Phone: ${TEST_CONFIG.testPhoneNumber}`);
    console.log(`  - Template Code: ${TEST_CONFIG.testTemplateCode}`);
    try {
        // 원하는 테스트 함수의 주석을 해제하고 실행하세요
        // 1. 템플릿 목록 조회 (안전 - 조회만 함)
        await testGetTemplates();
        // 2. 템플릿 상세 조회 (안전 - 조회만 함)
        // await testGetTemplateDetail();
        // 3. 기본 알림톡 발송 (주의 - 실제 발송됨!)
        // await testSendBasicAlimTalk();
        // 4. 발송 결과 조회 (안전 - 조회만 함)
        // await testGetMessageResult();
        // 5. 발송 내역 조회 (안전 - 조회만 함)
        // await testGetMessageList();
        // 6. 발신 프로필 카테고리 조회 (안전 - 조회만 함)
        // await testGetSenderCategories();
        console.log('\n✅ 모든 테스트 완료!');
    }
    catch (error) {
        console.error('\n❌ 테스트 중 오류 발생:', error);
    }
}
// 스크립트 실행
if (require.main === module) {
    main().catch(console.error);
}
exports.default = {
    testGetTemplates,
    testGetTemplateDetail,
    testSendBasicAlimTalk,
    testGetMessageResult,
    testGetMessageList,
    testGetSenderCategories,
};
//# sourceMappingURL=nhnAlimTalk.test.js.map