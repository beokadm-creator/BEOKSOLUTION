import axios from 'axios';

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
export async function getTemplates(senderKey: string) {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/senders/${senderKey}/templates`;

        const response = await axios.get(url, {
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
    } catch (error) {
        console.error('NHN AlimTalk getTemplates error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

/**
 * 특정 템플릿 상세 조회
 * @param senderKey - 발신 프로필 키
 * @param templateCode - 템플릿 코드
 * @returns Promise<TemplateDetailResponse>
 */
export async function getTemplateDetail(senderKey: string, templateCode: string) {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/senders/${senderKey}/templates/${templateCode}`;

        const response = await axios.get(url, {
            headers: getHeaders(),
        });

        return {
            success: true,
            data: response.data,
        };
    } catch (error) {
        console.error('NHN AlimTalk getTemplateDetail error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

/**
 * 알림톡 발송
 * @param params - 발송 파라미터
 * @returns Promise<SendResponse>
 * 
 * API 문서: https://docs.toast.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-api-guide/#_26
 */
export interface AlimTalkSendParams {
    senderKey: string;                    // 발신 프로필 키 (필수)
    templateCode: string;                 // 템플릿 코드 (필수)
    recipientNo: string;                  // 수신번호 (필수, 예: 01012345678)
    content: string;                      // 내용 (필수, 템플릿과 일치해야 함)

    // 선택 파라미터
    recipientGroupingKey?: string;        // 수신자 그룹핑 키
    buttons?: Array<{                     // 버튼 정보
        ordering: number;                   // 버튼 순서
        type: 'WL' | 'AL' | 'DS' | 'BK' | 'MD' | 'BC' | 'BT' | 'AC'; // 버튼 타입
        name: string;                       // 버튼명
        linkMo?: string;                    // 모바일 웹 링크
        linkPc?: string;                    // PC 웹 링크
        schemeIos?: string;                 // iOS 앱 링크
        schemeAndroid?: string;             // Android 앱 링크
    }>;

    // 대체 발송 정보
    isResend?: boolean;                   // 발송 실패 시 대체 발송 여부
    resendType?: 'SMS' | 'LMS' | 'MMS';  // 대체 발송 타입
    resendTitle?: string;                 // 대체 발송 제목 (LMS, MMS만)
    resendContent?: string;               // 대체 발송 내용
    resendSendNo?: string;                // 대체 발송 발신번호

    // 기타
    requestDate?: string;                 // 예약 발송 시간 (yyyy-MM-dd HH:mm)
    senderGroupingKey?: string;           // 발신 그룹핑 키
    recipientSeq?: number;                // 수신자 순번
}

export async function sendAlimTalk(params: AlimTalkSendParams) {
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

        const response = await axios.post(url, requestBody, {
            headers: getHeaders(),
        });

        return {
            success: true,
            data: response.data,
            recipient: params.recipientNo,
            templateCode: params.templateCode,
        };
    } catch (error) {
        console.error('NHN AlimTalk sendAlimTalk error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            recipient: params.recipientNo,
            templateCode: params.templateCode,
        };
    }
}

/**
 * 발송 결과 조회
 * @param requestId - 요청 ID (발송 시 받은 requestId)
 * @returns Promise<QueryResponse>
 * 
 * API 문서: https://docs.toast.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-api-guide/#_39
 */
export async function getMessageResult(requestId: string) {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/messages/${requestId}`;

        const response = await axios.get(url, {
            headers: getHeaders(),
        });

        return {
            success: true,
            data: response.data,
        };
    } catch (error) {
        console.error('NHN AlimTalk getMessageResult error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

/**
 * 발송 내역 조회 (날짜 범위)
 * @param params - 조회 파라미터
 * @returns Promise<QueryListResponse>
 */
export interface MessageQueryParams {
    requestDate?: string;           // 발송 날짜 (yyyy-MM-dd)
    startRequestDate?: string;      // 발송 날짜 시작값 (yyyy-MM-dd HH:mm:ss)
    endRequestDate?: string;        // 발송 날짜 종료값 (yyyy-MM-dd HH:mm:ss)
    startCreateDate?: string;       // 등록 날짜 시작값 (yyyy-MM-dd HH:mm:ss)
    endCreateDate?: string;         // 등록 날짜 종료값 (yyyy-MM-dd HH:mm:ss)
    recipientNo?: string;           // 수신번호
    senderKey?: string;             // 발신 프로필 키
    templateCode?: string;          // 템플릿 코드
    senderGroupingKey?: string;     // 발신 그룹핑 키
    recipientGroupingKey?: string;  // 수신자 그룹핑 키
    messageStatus?: string;         // 메시지 상태 (READY, COMPLETED, FAILED, CANCEL)
    resultCode?: string;            // 결과 코드
    pageNum?: number;               // 페이지 번호 (기본: 1)
    pageSize?: number;              // 조회 건수 (기본: 15, 최대: 1000)
}

export async function getMessageList(params: MessageQueryParams = {}) {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/messages`;

        const response = await axios.get(url, {
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
    } catch (error) {
        console.error('NHN AlimTalk getMessageList error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

/**
 * 발신 프로필 카테고리 조회
 * @returns Promise<CategoryResponse>
 */
export async function getSenderCategories() {
    try {
        const url = `${NHN_ALIMTALK_CONFIG.baseUrl}/alimtalk/v2.3/appkeys/${NHN_ALIMTALK_CONFIG.appKey}/sender/categories`;

        const response = await axios.get(url, {
            headers: getHeaders(),
        });

        return {
            success: true,
            data: response.data,
        };
    } catch (error) {
        console.error('NHN AlimTalk getSenderCategories error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

export default {
    getTemplates,
    getTemplateDetail,
    sendAlimTalk,
    getMessageResult,
    getMessageList,
    getSenderCategories,
    config: NHN_ALIMTALK_CONFIG,
};
