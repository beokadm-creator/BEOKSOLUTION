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
    } catch (error) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        console.error('Toss Payments Approval Error:', err.response?.data || err.message);
        throw new Error(err.response?.data?.message || 'Payment Approval Failed');
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
    } catch (error) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        console.error('Toss Payments Cancel Error:', err.response?.data || err.message);
        throw new Error(err.response?.data?.message || 'Payment Cancellation Failed');
    }
};
