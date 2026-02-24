"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSenderCategories = exports.getMessageList = exports.getMessageResult = exports.sendAlimTalk = exports.getTemplateDetail = exports.getTemplates = void 0;
/* eslint-disable */
const axios_1 = __importDefault(require("axios"));
/**
 * NHN Cloud AlimTalk API Configuration
 * URL: https://api-alimtalk.cloud.toast.com
 */
const NHN_ALIMTALK_CONFIG = {
    baseUrl: 'https://api-alimtalk.cloud.toast.com',
    appKey: 'Ik6GEBC22p5Qliqk',
    secretKey: 'ajFUrusk8I7tgBQdrztuQvcf6jgWWcme',
};
/**
 * NHN Cloud API 공통 헤더 생성
 */
function getHeaders() {
    return {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Secret-Key': NHN_ALIMTALK_CONFIG.secretKey,
    };
}
/**
 * 템플릿 목록 조회
 * @param senderKey - 발신 프로필 키 (카카오톡 채널의 발신 프로필 키)
 * @returns Promise<TemplateListResponse>
 *
 * API 문서: https://docs.toast.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-api-guide/#_7
 */
async function getTemplates(senderKey) {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/senders/${senderKey}/templates`;
        const response = await axios_1.default.get(url, {
            headers: getHeaders(),
            params: {
            // 선택적 파라미터
            // templateCode: 'TEMPLATE001', // 특정 템플릿만 조회
            // templateName: '템플릿명', // 템플릿명으로 검색
            // templateStatus: 'APR', // 템플릿 상태 (APR: 승인, REG: 등록, REQ: 검수요청, REJ: 반려, REP: 신고)
            // pageNum: 1,
            // pageSize: 15,
            },
        });
        return {
            success: true,
            data: response.data,
        };
    }
    catch (error) {
        console.error('NHN AlimTalk getTemplates error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
exports.getTemplates = getTemplates;
/**
 * 특정 템플릿 상세 조회
 * @param senderKey - 발신 프로필 키
 * @param templateCode - 템플릿 코드
 * @returns Promise<TemplateDetailResponse>
 */
async function getTemplateDetail(senderKey, templateCode) {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/senders/${senderKey}/templates/${templateCode}`;
        const response = await axios_1.default.get(url, {
            headers: getHeaders(),
        });
        return {
            success: true,
            data: response.data,
        };
    }
    catch (error) {
        console.error('NHN AlimTalk getTemplateDetail error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
exports.getTemplateDetail = getTemplateDetail;
async function sendAlimTalk(params) {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/messages`;
        const requestBody = {
            senderKey: params.senderKey,
            templateCode: params.templateCode,
            requestDate: params.requestDate || undefined,
            senderGroupingKey: params.senderGroupingKey || undefined,
            createUser: 'system',
            recipientList: [
                {
                    recipientNo: params.recipientNo,
                    content: params.content,
                    buttons: params.buttons || undefined,
                    recipientGroupingKey: params.recipientGroupingKey || undefined,
                    recipientSeq: params.recipientSeq || undefined,
                    isResend: params.isResend || false,
                    resendType: params.resendType || undefined,
                    resendTitle: params.resendTitle || undefined,
                    resendContent: params.resendContent || undefined,
                    resendSendNo: params.resendSendNo || undefined,
                },
            ],
        };
        const response = await axios_1.default.post(url, requestBody, {
            headers: getHeaders(),
        });
        return {
            success: true,
            data: response.data,
            recipient: params.recipientNo,
            templateCode: params.templateCode,
        };
    }
    catch (error) {
        console.error('NHN AlimTalk sendAlimTalk error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            recipient: params.recipientNo,
            templateCode: params.templateCode,
        };
    }
}
exports.sendAlimTalk = sendAlimTalk;
/**
 * 발송 결과 조회
 * @param requestId - 요청 ID (발송 시 받은 requestId)
 * @returns Promise<QueryResponse>
 *
 * API 문서: https://docs.toast.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-api-guide/#_39
 */
async function getMessageResult(requestId) {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/messages/${requestId}`;
        const response = await axios_1.default.get(url, {
            headers: getHeaders(),
        });
        return {
            success: true,
            data: response.data,
        };
    }
    catch (error) {
        console.error('NHN AlimTalk getMessageResult error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
exports.getMessageResult = getMessageResult;
async function getMessageList(params = {}) {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/messages`;
        const response = await axios_1.default.get(url, {
            headers: getHeaders(),
            params: {
                pageNum: params.pageNum || 1,
                pageSize: params.pageSize || 15,
                ...params,
            },
        });
        return {
            success: true,
            data: response.data,
        };
    }
    catch (error) {
        console.error('NHN AlimTalk getMessageList error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
exports.getMessageList = getMessageList;
/**
 * 발신 프로필 카테고리 조회
 * @returns Promise<CategoryResponse>
 */
async function getSenderCategories() {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/sender/categories`;
        const response = await axios_1.default.get(url, {
            headers: getHeaders(),
        });
        return {
            success: true,
            data: response.data,
        };
    }
    catch (error) {
        console.error('NHN AlimTalk getSenderCategories error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
exports.getSenderCategories = getSenderCategories;
exports.default = {
    getTemplates,
    getTemplateDetail,
    sendAlimTalk,
    getMessageResult,
    getMessageList,
    getSenderCategories,
    config: NHN_ALIMTALK_CONFIG,
};
//# sourceMappingURL=nhnAlimTalk.js.map