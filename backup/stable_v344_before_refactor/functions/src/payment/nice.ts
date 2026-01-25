import * as crypto from 'crypto';
import axios from 'axios';
import { format } from 'date-fns';

/**
 * Generate Authentication Parameters for NicePay Request
 * SignData = hex(sha256(EdiDate + MID + Amt + MerchantKey))
 */
export const getNiceAuthParams = (amt: number, mid: string, key: string) => {
    const ediDate = format(new Date(), 'yyyyMMddHHmmss');
    const str = ediDate + mid + amt + key;
    const signData = crypto.createHash('sha256').update(str).digest('hex');

    return {
        ediDate,
        signData
    };
};

/**
 * Approve Payment via NicePay API
 * SignData = hex(sha256(TID + MID + Amt + MerchantKey))
 * API: https://webapi.nicepay.co.kr/webapi/pay/process.jsp
 */
export const approveNicePayment = async (tid: string, amt: number, mid: string, key: string) => {
    try {
        const str = tid + mid + amt + key;
        const signData = crypto.createHash('sha256').update(str).digest('hex');

        // Form URL Encoded Body
        const params = new URLSearchParams();
        params.append('TID', tid);
        params.append('AuthDate', format(new Date(), 'yyMMddHHmmss')); // Although API might handle it, usually passed or current
        // According to docs, usually we just send TID, MID, Amt, SignData, EdiDate etc.
        // Let's check standard approval params:
        // TID, MID, Amt, EdiDate, SignData, CharSet(utf-8), EdiType(JSON)
        
        const ediDate = format(new Date(), 'yyyyMMddHHmmss');
        
        params.append('MID', mid);
        params.append('Amt', amt.toString());
        params.append('EdiDate', ediDate);
        params.append('SignData', signData);
        params.append('CharSet', 'utf-8');
        params.append('EdiType', 'JSON');
        params.append('MallReserved', ''); // Optional

        const response = await axios.post('https://webapi.nicepay.co.kr/webapi/pay/process.jsp', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data;
    } catch (error: any) {
        console.error('NicePay Approval Error:', error.response?.data || error.message);
        throw new Error('Payment Approval Failed');
    }
};
