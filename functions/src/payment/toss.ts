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
    } catch (error: unknown) {
        const errorData = error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { message?: string;[key: string]: unknown } } }).response?.data
            : undefined;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Toss Payments Approval Error:', errorData || errorMessage);
        throw new Error(errorData?.message || 'Payment Approval Failed');
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
    } catch (error: unknown) {
        const errorData = error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { message?: string;[key: string]: unknown } } }).response?.data
            : undefined;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Toss Payments Cancel Error:', errorData || errorMessage);
        throw new Error(errorData?.message || 'Payment Cancellation Failed');
    }
};
