import axios from 'axios';

/**
 * Approve Payment via Toss Payments API
 * API: https://api.tosspayments.com/v1/payments/confirm
 */
export const approveTossPayment = async (paymentKey: string, orderId: string, amount: number, secretKey: string) => {
    try {
        const encryptedSecretKey = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

        const response = await axios.post('https://api.tosspayments.com/v1/payments/confirm', {
            paymentKey,
            orderId,
            amount
        }, {
            headers: {
                'Authorization': encryptedSecretKey,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error: any) {
        console.error('Toss Payments Approval Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Payment Approval Failed');
    }
};

/**
 * Cancel Payment via Toss Payments API
 * API: https://api.tosspayments.com/v1/payments/{paymentKey}/cancel
 */
export const cancelTossPayment = async (paymentKey: string, cancelReason: string, secretKey: string) => {
    try {
        const encryptedSecretKey = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

        const response = await axios.post(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
            cancelReason
        }, {
            headers: {
                'Authorization': encryptedSecretKey,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error: any) {
        console.error('Toss Payments Cancel Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Payment Cancellation Failed');
    }
};
