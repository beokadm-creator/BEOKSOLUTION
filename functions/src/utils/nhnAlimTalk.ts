import axios from 'axios';

// NHN Cloud Notification (AlimTalk) Configuration
// TODO: Replace with actual keys when issued
const NHN_CONFIG = {
    appKey: 'YOUR_NHN_APP_KEY',
    secretKey: 'YOUR_NHN_SECRET_KEY',
    senderKey: 'YOUR_SENDER_KEY'
};

/**
 * Send AlimTalk message using NHN Cloud API v2.3
 * @param {string} recipient - Recipient phone number
 * @param {string} templateCode - Template code
 * @param {Object} templateParameters - Template parameters/variables for substitution
 * @param {Object} options - Optional settings (buttons, etc.)
 * @returns {Promise<Object>} - API response
 */
interface AlimTalkButton {
    type: string;
    name: string;
    linkMobile: string;
    linkPc?: string;
}

interface AlimTalkOptions {
    buttons?: AlimTalkButton[];
    resendParameter?: Record<string, unknown>;
}

interface AlimTalkResult {
    success: boolean;
    data?: unknown;
    recipient: string;
    templateCode: string;
    message?: string;
    error?: string;
    details?: unknown;
}

interface AlimTalkTemplatesResult {
    success: boolean;
    data?: { templates?: unknown[] };
    error?: string;
}

export async function sendAlimTalk(
    recipient: string,
    templateCode: string,
    templateParameters: { [key: string]: string },
    options: AlimTalkOptions = {}
): Promise<AlimTalkResult> {
    try {
        // 1. Prepare Request Body
        const requestBody = {
            senderKey: NHN_CONFIG.senderKey,
            templateCode: templateCode,
            recipientList: [
                {
                    recipientNo: recipient,
                    templateParameter: templateParameters,
                    buttons: options.buttons || undefined
                }
            ],
            // Use configured resend/failover if provided, or default behavior
            resendParameter: options.resendParameter // Can be passed if specific failover text is needed
        };

        // 2. Send Request
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${NHN_CONFIG.appKey}/messages`;

        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Secret-Key': NHN_CONFIG.secretKey
            }
        });

        return {
            success: true,
            data: response.data,
            recipient,
            templateCode,
            message: 'AlimTalk sent via NHN Cloud successfully'
        };

    } catch (error: unknown) {
        console.error('NHN AlimTalk send error:', error);

        // Normalize error return
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
            const err = error as Record<string, unknown>;
            if (err.response && typeof err.response === 'object') {
                const response = err.response as Record<string, unknown>;
                if (response.data && typeof response.data === 'object') {
                    const data = response.data as Record<string, unknown>;
                    if (data.header && typeof data.header === 'object') {
                        const header = data.header as Record<string, unknown>;
                        errorMessage = String(header.resultMessage || errorMessage);
                    }
                }
            }
        }

        return {
            success: false,
            error: errorMessage,
            recipient,
            templateCode,
            details: error
        };
    }
}

/**
 * Get AlimTalk templates from NHN Cloud
 * @returns {Promise<AlimTalkTemplatesResult>} - Template list
 */
export async function getAlimTalkTemplates(): Promise<AlimTalkTemplatesResult> {
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${NHN_CONFIG.appKey}/senders/${NHN_CONFIG.senderKey}/templates`;

        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Secret-Key': NHN_CONFIG.secretKey
            }
        });

        // NHN Response structure:
        // { header: {...}, templateListResponse: { templates: [...] } }

        if (response.data?.header?.isSuccessful) {
            return {
                success: true,
                data: response.data.templateListResponse // Return the inner object containing 'templates' array
            };
        } else {
            throw new Error(response.data?.header?.resultMessage || 'API call failed');
        }

    } catch (error) {
        const err = error as { response?: { data?: { header?: { resultMessage?: string } } }; message?: string };
        console.error('Get NHN AlimTalk templates error:', err?.response?.data || err.message);
        return {
            success: false,
            error: err?.response?.data?.header?.resultMessage || err.message || 'Unknown error'
        };
    }
}

export default {
    sendAlimTalk,
    getAlimTalkTemplates,
    config: NHN_CONFIG
};
