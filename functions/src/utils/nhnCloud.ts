import axios from 'axios';

/**
 * NHN Cloud KakaoTalk Bizmessage API Integration
 * API Documentation: https://docs.nhncloud.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-api-guide/
 */

export interface NHNCloudConfig {
    appKey: string;
    secretKey: string;
    senderKey: string;
}

export interface AlimTalkSendParams {
    recipientNo: string;  // 수신자 전화번호 (예: 01012345678)
    templateCode: string;  // 템플릿 코드
    templateParameter?: { [key: string]: string };  // 템플릿 치환 변수
    recipientGroupingKey?: string;  // 수신자 그룹핑 키
}

export interface AlimTalkSendResult {
    success: boolean;
    requestId?: string;
    recipientSeq?: number;
    resultCode?: string;
    resultMessage?: string;
    error?: string;
    rawResponse?: any;
}

/**
 * Send AlimTalk message via NHN Cloud
 */
export async function sendAlimTalk(
    config: NHNCloudConfig,
    params: AlimTalkSendParams
): Promise<AlimTalkSendResult> {
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${config.appKey}/messages`;

        const requestBody = {
            senderKey: config.senderKey,
            templateCode: params.templateCode,
            recipientList: [
                {
                    recipientNo: params.recipientNo,
                    templateParameter: params.templateParameter || {},
                    recipientGroupingKey: params.recipientGroupingKey
                }
            ]
        };

        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Secret-Key': config.secretKey
            }
        });

        if (response.data.header.isSuccessful) {
            return {
                success: true,
                requestId: response.data.body.data.requestId,
                recipientSeq: response.data.body.data.recipientList?.[0]?.recipientSeq,
                resultCode: response.data.body.data.recipientList?.[0]?.resultCode,
                resultMessage: 'AlimTalk sent successfully',
                rawResponse: response.data
            };
        } else {
            return {
                success: false,
                resultCode: response.data.header.resultCode,
                resultMessage: response.data.header.resultMessage,
                error: response.data.header.resultMessage,
                rawResponse: response.data
            };
        }
    } catch (error: any) {
        console.error('[NHN Cloud AlimTalk] Send error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.header?.resultMessage || error.message || 'Unknown error occurred',
            rawResponse: error.response?.data
        };
    }
}

/**
 * Get AlimTalk template list
 */
export async function getTemplateList(config: NHNCloudConfig): Promise<any> {
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${config.appKey}/senders/${config.senderKey}/templates`;

        console.log(`[NHN API] Request URL: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Secret-Key': config.secretKey
            },
            params: {
                pageNum: 1,
                pageSize: 1000
            }
        });

        console.log('[NHN API] Response:', JSON.stringify(response.data, null, 2));

        if (response.data.header && response.data.header.isSuccessful) {
            // API 응답 구조: templateListResponse.templates
            const templates = response.data.templateListResponse?.templates || response.data.body?.data || [];
            return {
                success: true,
                templates: templates,
                rawResponse: response.data
            };
        } else {
            const errorMsg = response.data.header?.resultMessage || 'Unknown error from NHN';
            console.error('[NHN API] API Error:', errorMsg);
            return {
                success: false,
                error: errorMsg,
                rawResponse: response.data
            };
        }
    } catch (error: any) {
        console.error('[NHN Cloud AlimTalk] Get templates error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.header?.resultMessage || error.message || 'Unknown error occurred',
            details: error.response?.data
        };
    }
}

/**
 * Get single AlimTalk template by code
 */
export async function getTemplate(config: NHNCloudConfig, templateCode: string): Promise<any> {
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${config.appKey}/senders/${config.senderKey}/templates/${templateCode}`;

        console.log(`[NHN API] Get Template Request: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Secret-Key': config.secretKey
            }
        });

        console.log('[NHN API] Get Template Response:', JSON.stringify(response.data, null, 2));

        if (response.data.header && response.data.header.isSuccessful) {
            return {
                success: true,
                template: response.data.body?.data,
                rawResponse: response.data
            };
        } else {
            return {
                success: false,
                error: response.data.header?.resultMessage,
                rawResponse: response.data
            };
        }
    } catch (error: any) {
        console.error('[NHN API] Get template error:', error);
        return {
            success: false,
            error: error.message,
            details: error.response?.data
        };
    }
}

/**
 * Get AlimTalk send history
 */
export async function getSendHistory(
    config: NHNCloudConfig,
    requestId: string
): Promise<any> {
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${config.appKey}/messages/${requestId}`;

        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Secret-Key': config.secretKey
            }
        });

        if (response.data.header.isSuccessful) {
            return {
                success: true,
                data: response.data.body.data
            };
        } else {
            return {
                success: false,
                error: response.data.header.resultMessage
            };
        }
    } catch (error: any) {
        console.error('[NHN Cloud AlimTalk] Get send history error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.header?.resultMessage || error.message || 'Unknown error occurred'
        };
    }
}

/**
 * Validate NHN Cloud configuration
 */
export async function validateConfig(config: NHNCloudConfig): Promise<{ valid: boolean; error?: string }> {
    try {
        // Try to get template list to validate credentials
        const result = await getTemplateList(config);
        return {
            valid: result.success,
            error: result.error
        };
    } catch (error: any) {
        return {
            valid: false,
            error: error.message
        };
    }
}

export default {
    sendAlimTalk,
    getTemplateList,
    getSendHistory,
    validateConfig
};
