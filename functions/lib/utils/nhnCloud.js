"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = exports.getSendHistory = exports.getTemplate = exports.getTemplateList = exports.sendAlimTalk = void 0;
/* eslint-disable */
const axios_1 = __importDefault(require("axios"));
/**
 * Send AlimTalk message via NHN Cloud
 */
async function sendAlimTalk(config, params) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
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
        const response = await axios_1.default.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Secret-Key': config.secretKey
            }
        });
        if (response.data.header.isSuccessful) {
            return {
                success: true,
                requestId: response.data.body.data.requestId,
                recipientSeq: (_b = (_a = response.data.body.data.recipientList) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.recipientSeq,
                resultCode: (_d = (_c = response.data.body.data.recipientList) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.resultCode,
                resultMessage: 'AlimTalk sent successfully',
                rawResponse: response.data
            };
        }
        else {
            return {
                success: false,
                resultCode: response.data.header.resultCode,
                resultMessage: response.data.header.resultMessage,
                error: response.data.header.resultMessage,
                rawResponse: response.data
            };
        }
    }
    catch (error) {
        console.error('[NHN Cloud AlimTalk] Send error:', ((_e = error.response) === null || _e === void 0 ? void 0 : _e.data) || error.message);
        return {
            success: false,
            error: ((_h = (_g = (_f = error.response) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.header) === null || _h === void 0 ? void 0 : _h.resultMessage) || error.message || 'Unknown error occurred',
            rawResponse: (_j = error.response) === null || _j === void 0 ? void 0 : _j.data
        };
    }
}
exports.sendAlimTalk = sendAlimTalk;
/**
 * Get AlimTalk template list
 */
async function getTemplateList(config) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${config.appKey}/senders/${config.senderKey}/templates`;
        console.log(`[NHN API] Request URL: ${url}`);
        const response = await axios_1.default.get(url, {
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
            const templates = ((_a = response.data.templateListResponse) === null || _a === void 0 ? void 0 : _a.templates) || ((_b = response.data.body) === null || _b === void 0 ? void 0 : _b.data) || [];
            return {
                success: true,
                templates: templates,
                rawResponse: response.data
            };
        }
        else {
            const errorMsg = ((_c = response.data.header) === null || _c === void 0 ? void 0 : _c.resultMessage) || 'Unknown error from NHN';
            console.error('[NHN API] API Error:', errorMsg);
            return {
                success: false,
                error: errorMsg,
                rawResponse: response.data
            };
        }
    }
    catch (error) {
        console.error('[NHN Cloud AlimTalk] Get templates error:', ((_d = error.response) === null || _d === void 0 ? void 0 : _d.data) || error.message);
        return {
            success: false,
            error: ((_g = (_f = (_e = error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.header) === null || _g === void 0 ? void 0 : _g.resultMessage) || error.message || 'Unknown error occurred',
            details: (_h = error.response) === null || _h === void 0 ? void 0 : _h.data
        };
    }
}
exports.getTemplateList = getTemplateList;
/**
 * Get single AlimTalk template by code
 */
async function getTemplate(config, templateCode) {
    var _a, _b, _c;
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${config.appKey}/senders/${config.senderKey}/templates/${templateCode}`;
        console.log(`[NHN API] Get Template Request: ${url}`);
        const response = await axios_1.default.get(url, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Secret-Key': config.secretKey
            }
        });
        console.log('[NHN API] Get Template Response:', JSON.stringify(response.data, null, 2));
        if (response.data.header && response.data.header.isSuccessful) {
            return {
                success: true,
                template: (_a = response.data.body) === null || _a === void 0 ? void 0 : _a.data,
                rawResponse: response.data
            };
        }
        else {
            return {
                success: false,
                error: (_b = response.data.header) === null || _b === void 0 ? void 0 : _b.resultMessage,
                rawResponse: response.data
            };
        }
    }
    catch (error) {
        console.error('[NHN API] Get template error:', error);
        return {
            success: false,
            error: error.message,
            details: (_c = error.response) === null || _c === void 0 ? void 0 : _c.data
        };
    }
}
exports.getTemplate = getTemplate;
/**
 * Get AlimTalk send history
 */
async function getSendHistory(config, requestId) {
    var _a, _b, _c, _d;
    try {
        const url = `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/${config.appKey}/messages/${requestId}`;
        const response = await axios_1.default.get(url, {
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
        }
        else {
            return {
                success: false,
                error: response.data.header.resultMessage
            };
        }
    }
    catch (error) {
        console.error('[NHN Cloud AlimTalk] Get send history error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        return {
            success: false,
            error: ((_d = (_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.header) === null || _d === void 0 ? void 0 : _d.resultMessage) || error.message || 'Unknown error occurred'
        };
    }
}
exports.getSendHistory = getSendHistory;
/**
 * Validate NHN Cloud configuration
 */
async function validateConfig(config) {
    try {
        // Try to get template list to validate credentials
        const result = await getTemplateList(config);
        return {
            valid: result.success,
            error: result.error
        };
    }
    catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
}
exports.validateConfig = validateConfig;
exports.default = {
    sendAlimTalk,
    getTemplateList,
    getSendHistory,
    validateConfig
};
//# sourceMappingURL=nhnCloud.js.map