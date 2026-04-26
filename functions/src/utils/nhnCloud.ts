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

export interface BatchRecipient {
    recipientNo: string;
    templateParameter?: { [key: string]: string };
    recipientGroupingKey?: string;
}

export interface BatchAlimTalkSendResult {
    success: boolean;
    requestId?: string;
    totalCount: number;
    successCount: number;
    failCount: number;
    error?: string;
    rawResponse?: unknown;
}

export interface AlimTalkSendResult {
    success: boolean;
    requestId?: string;
    recipientSeq?: number;
    resultCode?: string;
    resultMessage?: string;
    error?: string;
    rawResponse?: unknown;
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
                requestId: response.data.message?.requestId,
                recipientSeq: response.data.message?.sendResults?.[0]?.recipientSeq,
                resultCode: response.data.message?.sendResults?.[0]?.resultCode?.toString(),
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
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const responseData = error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { header?: { resultMessage?: string } } } }).response?.data
            : undefined;
        console.error('[NHN Cloud AlimTalk] Send error:', responseData || message);
        return {
            success: false,
            error: responseData?.header?.resultMessage || message || 'Unknown error occurred',
            rawResponse: responseData
        };
    }
}

/**
 * Send AlimTalk to multiple recipients in a single API call
 * NHN Cloud supports up to 1,000 recipients per request, each with individual templateParameter
 */
export async function sendAlimTalkBatch(
    config: NHNCloudConfig,
    recipients: BatchRecipient[],
    templateCode: string
): Promise<BatchAlimTalkSendResult> {
    if (recipients.length === 0) {
        return { success: true, totalCount: 0, successCount: 0, failCount: 0 };
    }
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${config.appKey}/messages`;

        const requestBody = {
            senderKey: config.senderKey,
            templateCode,
            recipientList: recipients.map(r => ({
                recipientNo: r.recipientNo,
                templateParameter: r.templateParameter || {},
                recipientGroupingKey: r.recipientGroupingKey
            }))
        };

        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Secret-Key': config.secretKey
            },
            timeout: 30000 // 30s timeout per batch call
        });

        if (response.data.header.isSuccessful) {
            const sendResults: Array<{ resultCode: number }> = response.data.message?.sendResults || [];
            const successCount = sendResults.filter(r => r.resultCode === 0).length;
            const failCount = sendResults.length - successCount;
            return {
                success: true,
                requestId: response.data.message?.requestId,
                totalCount: recipients.length,
                successCount: successCount || recipients.length, // fallback if no detail
                failCount: failCount,
                rawResponse: response.data
            };
        } else {
            return {
                success: false,
                totalCount: recipients.length,
                successCount: 0,
                failCount: recipients.length,
                error: response.data.header.resultMessage,
                rawResponse: response.data
            };
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const responseData = error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { header?: { resultMessage?: string } } } }).response?.data
            : undefined;
        console.error('[NHN Cloud AlimTalk] Batch send error:', responseData || message);
        return {
            success: false,
            totalCount: recipients.length,
            successCount: 0,
            failCount: recipients.length,
            error: responseData?.header?.resultMessage || message || 'Unknown error',
            rawResponse: responseData
        };
    }
}

/**
 * Get AlimTalk template list
 */
export async function getTemplateList(config: NHNCloudConfig): Promise<any> {
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${config.appKey}/senders/${config.senderKey}/templates`;

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
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const responseData = error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { header?: { resultMessage?: string } } } }).response?.data
            : undefined;
        console.error('[NHN Cloud AlimTalk] Get templates error:', responseData || message);
        return {
            success: false,
            error: responseData?.header?.resultMessage || message || 'Unknown error occurred',
            details: responseData
        };
    }
}

/**
 * Get single AlimTalk template by code
 */
export async function getTemplate(config: NHNCloudConfig, templateCode: string): Promise<any> {
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${config.appKey}/senders/${config.senderKey}/templates/${templateCode}`;

        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Secret-Key': config.secretKey
            }
        });

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
    } catch (error: unknown) {
        console.error('[NHN API] Get template error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        const responseData = error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: unknown } }).response?.data
            : undefined;
        return {
            success: false,
            error: message,
            details: responseData
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
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const responseData = error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { header?: { resultMessage?: string } } } }).response?.data
            : undefined;
        console.error('[NHN Cloud AlimTalk] Get send history error:', responseData || message);
        return {
            success: false,
            error: responseData?.header?.resultMessage || message || 'Unknown error occurred'
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
    } catch (error: unknown) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

export default {
    sendAlimTalk,
    getTemplateList,
    getSendHistory,
    validateConfig
};
