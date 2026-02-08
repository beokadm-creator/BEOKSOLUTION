import axios from 'axios';

interface AligoResponse {
  success: boolean;
  code?: string;
  message?: string;
  data?: unknown;
  channelId?: string;
  error?: string;
  recipient?: string;
  templateCode?: string;
}

interface AlimTalkVariables {
  message?: string;
  name?: string;
  button?: unknown;
  fsubject?: string;
  fmessage?: string;
  [key: string]: string | undefined | unknown;
}

// Platform-level Aligo credentials (hardcoded as requested)
const ALIGO_CONFIG = {
  apikey: 'xv04ghl3hpm5tajg34kv6bn0ug31h767',
  userid: 'lldbsehll',
  sender: '010-8549-1646',
  senderkey: '211f5ad50182e6b507fb33f419a3218b8f426f23'
};

/**
 * Send AlimTalk message using platform credentials
 * @param {string} recipient - Recipient phone number (with country code, no hyphens)
 * @param {string} templateCode - Template code to use
 * @param {Object} variables - Template variables to substitute
 * @param {string} channelId - Kakao Channel ID for sending
 * @returns {Promise<Object>} - API response
 */
export async function sendAlimTalk(
  recipient: string,
  templateCode: string,
  variables: AlimTalkVariables,
  channelId: string
): Promise<AligoResponse> {
  try {
    // Prepare the complete data for Aligo API
    const formData = new URLSearchParams();
    formData.append('apikey', ALIGO_CONFIG.apikey);
    formData.append('userid', ALIGO_CONFIG.userid);
    formData.append('senderkey', ALIGO_CONFIG.senderkey);
    formData.append('tpl_code', templateCode);
    formData.append('sender', ALIGO_CONFIG.sender);
    formData.append('receiver_1', recipient);
    formData.append('subject_1', '');
    formData.append('message_1', variables.message || '');
    formData.append('senddate', new Date().toISOString().replace(/[-T:]/g, '').substring(0, 14));
    formData.append('recvname', variables.name || '');
    formData.append('button', variables.button ? JSON.stringify(variables.button) : '');
    formData.append('failover', 'Y');
    formData.append('fsubject', variables.fsubject || '');
    formData.append('fmessage', variables.fmessage || '');

    const response = await axios.post('https://kakaoapi.aligo.in/akv10/alimtalk/send', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      success: true,
      data: response.data,
      channelId,
      recipient,
      templateCode,
      message: 'AlimTalk sent successfully'
    };

  } catch (error: unknown) {
    const currentIp = await getPublicIp();
    console.error('AlimTalk send error:', error, 'Server IP:', currentIp);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `${message} (Server IP: ${currentIp})`,
      channelId,
      recipient,
      templateCode
    };
  }
}

/**
 * Get remaining AlimTalk credits
 * @returns {Promise<Object>} - Credit information
 */
export async function getAlimTalkRemain(): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const formData = new URLSearchParams();
    formData.append('apikey', ALIGO_CONFIG.apikey);
    formData.append('userid', ALIGO_CONFIG.userid);

    const response = await axios.post('https://kakaoapi.aligo.in/akv10/payment/remain', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Get AlimTalk remain error:', error);
    return {
      success: false,
      error: err.message || 'Unknown error occurred'
    };
  }
}

/**
 * Get AlimTalk send history
 * @param {string} channelId - Kakao Channel ID
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Results per page (default: 50, max: 500)
 * @returns {Promise<Object>} - Send history
 */
export async function getAlimTalkHistory(
  channelId: string,
  page: number = 1,
  limit: number = 50
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const formData = new URLSearchParams();
    formData.append('apikey', ALIGO_CONFIG.apikey);
    formData.append('userid', ALIGO_CONFIG.userid);
    formData.append('page', page.toString());
    formData.append('limit', limit.toString());
    formData.append('start_date', ''); // Default to recent
    formData.append('enddate', ''); // Default to recent

    const response = await axios.post('https://kakaoapi.aligo.in/akv10/history/list', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('Get AlimTalk history error:', error);
    return {
      success: false,
      error: err.message || 'Unknown error occurred'
    };
  }
}

/**
 * Get AlimTalk templates
 * @returns {Promise<Object>} - Template list
 */
export async function getAlimTalkTemplates(): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const formData = new URLSearchParams();
    formData.append('apikey', ALIGO_CONFIG.apikey);
    formData.append('userid', ALIGO_CONFIG.userid);
    formData.append('senderkey', ALIGO_CONFIG.senderkey);

    const response = await axios.post('https://kakaoapi.aligo.in/akv10/template/list', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    const err = error as { code?: string; message?: string };
    const currentIp = await getPublicIp(); // Fetch IP on error for debugging
    console.error('Get AlimTalk templates error:', error, 'Server IP:', currentIp);
    return {
      success: false,
      error: `[${err.code || 'ERR'}] ${err.message} (Server IP: ${currentIp})`
    };
  }
}

/**
 * Helper to get current public IP (Cloud Function instance IP)
 */
async function getPublicIp(): Promise<string> {
  try {
    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 2000 });
    return response.data.ip;
  } catch {
    return 'unknown';
  }
}

export default {
  sendAlimTalk,
  getAlimTalkRemain,
  getAlimTalkHistory,
  getAlimTalkTemplates,
  getPublicIp, // Exporting for direct check if needed
  config: ALIGO_CONFIG
};