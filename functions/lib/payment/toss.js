"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelTossPayment = exports.approveTossPayment = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const axios_1 = __importDefault(require("axios"));
/**
 * Approve Payment via Toss Payments API
 * API: https://api.tosspayments.com/v1/payments/confirm
 */
const approveTossPayment = async (paymentKey, orderId, amount, secretKey, storeId) => {
    var _a;
    try {
        const encryptedSecretKey = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;
        const requestBody = {
            paymentKey,
            orderId,
            amount
        };
        if (storeId) {
            requestBody.storeId = storeId;
        }
        const response = await axios_1.default.post('https://api.tosspayments.com/v1/payments/confirm', requestBody, {
            headers: {
                'Authorization': encryptedSecretKey,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    }
    catch (error) {
        const errorData = error && typeof error === 'object' && 'response' in error
            ? (_a = error.response) === null || _a === void 0 ? void 0 : _a.data
            : undefined;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Toss Payments Approval Error:', errorData || errorMessage);
        throw new Error((errorData === null || errorData === void 0 ? void 0 : errorData.message) || 'Payment Approval Failed');
    }
};
exports.approveTossPayment = approveTossPayment;
/**
 * Cancel Payment via Toss Payments API
 * API: https://api.tosspayments.com/v1/payments/{paymentKey}/cancel
 */
const cancelTossPayment = async (paymentKey, cancelReason, secretKey) => {
    var _a;
    try {
        const encryptedSecretKey = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;
        const response = await axios_1.default.post(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
            cancelReason
        }, {
            headers: {
                'Authorization': encryptedSecretKey,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    }
    catch (error) {
        const errorData = error && typeof error === 'object' && 'response' in error
            ? (_a = error.response) === null || _a === void 0 ? void 0 : _a.data
            : undefined;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Toss Payments Cancel Error:', errorData || errorMessage);
        throw new Error((errorData === null || errorData === void 0 ? void 0 : errorData.message) || 'Payment Cancellation Failed');
    }
};
exports.cancelTossPayment = cancelTossPayment;
//# sourceMappingURL=toss.js.map