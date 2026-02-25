"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveNicePayment = exports.getNiceAuthParams = void 0;
const crypto = __importStar(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const date_fns_1 = require("date-fns");
/**
 * Generate Authentication Parameters for NicePay Request
 * SignData = hex(sha256(EdiDate + MID + Amt + MerchantKey))
 */
const getNiceAuthParams = (amt, mid, key) => {
    const ediDate = (0, date_fns_1.format)(new Date(), 'yyyyMMddHHmmss');
    const str = ediDate + mid + amt + key;
    const signData = crypto.createHash('sha256').update(str).digest('hex');
    return {
        ediDate,
        signData
    };
};
exports.getNiceAuthParams = getNiceAuthParams;
/**
 * Approve Payment via NicePay API
 * SignData = hex(sha256(TID + MID + Amt + MerchantKey))
 * API: https://webapi.nicepay.co.kr/webapi/pay/process.jsp
 */
const approveNicePayment = async (tid, amt, mid, key) => {
    var _a;
    try {
        const str = tid + mid + amt + key;
        const signData = crypto.createHash('sha256').update(str).digest('hex');
        // Form URL Encoded Body
        const params = new URLSearchParams();
        params.append('TID', tid);
        params.append('AuthDate', (0, date_fns_1.format)(new Date(), 'yyMMddHHmmss')); // Although API might handle it, usually passed or current
        // According to docs, usually we just send TID, MID, Amt, SignData, EdiDate etc.
        // Let's check standard approval params:
        // TID, MID, Amt, EdiDate, SignData, CharSet(utf-8), EdiType(JSON)
        const ediDate = (0, date_fns_1.format)(new Date(), 'yyyyMMddHHmmss');
        params.append('MID', mid);
        params.append('Amt', amt.toString());
        params.append('EdiDate', ediDate);
        params.append('SignData', signData);
        params.append('CharSet', 'utf-8');
        params.append('EdiType', 'JSON');
        params.append('MallReserved', ''); // Optional
        const response = await axios_1.default.post('https://webapi.nicepay.co.kr/webapi/pay/process.jsp', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data;
    }
    catch (error) {
        const errorData = error && typeof error === 'object' && 'response' in error
            ? (_a = error.response) === null || _a === void 0 ? void 0 : _a.data
            : undefined;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('NicePay Approval Error:', errorData || errorMessage);
        throw new Error('Payment Approval Failed');
    }
};
exports.approveNicePayment = approveNicePayment;
//# sourceMappingURL=nice.js.map