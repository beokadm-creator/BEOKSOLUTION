"use strict";
/**
 * Notification Service - NHN Cloud AlimTalk Integration
 *
 * NHN Cloud KakaoTalk Bizmessage API를 사용하여 알림톡 발송
 *
 * 사용 예시:
 * ```typescript
 * const notificationService = NotificationService.getInstance();
 * await notificationService.sendAlimTalk({
 *   phone: '01012345678',
 *   templateCode: 'REGISTRATION_COMPLETE',
 *   variables: { name: '홍길동', conference: '2026 춘계학술대회' }
 * }, 'kap');
 * ```
 */
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlimTalk = exports.NotificationService = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const nhnCloud_1 = require("../utils/nhnCloud");
/**
 * NHN Cloud Provider 구현
 */
class NHNProvider {
    getProviderName() {
        return 'nhn';
    }
    async send(params, societyId) {
        var _a;
        try {
            // Firestore에서 NHN Cloud 설정 가져오기
            const db = admin.firestore();
            if (!societyId) {
                throw new Error('societyId is required for NHN Cloud AlimTalk');
            }
            const infraSnap = await db
                .collection('societies')
                .doc(societyId)
                .collection('settings')
                .doc('infrastructure')
                .get();
            if (!infraSnap.exists) {
                throw new Error('Infrastructure settings not found');
            }
            const infraData = infraSnap.data();
            const nhnConfig = infraData === null || infraData === void 0 ? void 0 : infraData.notification;
            if (!(nhnConfig === null || nhnConfig === void 0 ? void 0 : nhnConfig.appKey) || !(nhnConfig === null || nhnConfig === void 0 ? void 0 : nhnConfig.secretKey) || !(nhnConfig === null || nhnConfig === void 0 ? void 0 : nhnConfig.senderKey)) {
                throw new Error('NHN Cloud configuration is incomplete');
            }
            // NHN Cloud API 호출
            const result = await (0, nhnCloud_1.sendAlimTalk)({
                appKey: nhnConfig.appKey,
                secretKey: nhnConfig.secretKey,
                senderKey: nhnConfig.senderKey,
            }, {
                recipientNo: params.phone,
                templateCode: params.templateCode,
                templateParameter: params.variables,
            });
            if (result.success) {
                return {
                    success: true,
                    messageId: result.requestId,
                    provider: 'nhn',
                    rawResponse: result.rawResponse
                };
            }
            else {
                return {
                    success: false,
                    error: result.error || 'Unknown error',
                    provider: 'nhn',
                    rawResponse: result.rawResponse
                };
            }
        }
        catch (error) {
            const err = error;
            functions.logger.error('NHN send failed', err);
            return {
                success: false,
                error: err.message,
                provider: 'nhn',
                rawResponse: (_a = err.response) === null || _a === void 0 ? void 0 : _a.data
            };
        }
    }
}
/**
 * Notification Service (Singleton)
 */
class NotificationService {
    constructor() {
        this.provider = null;
    }
    static getInstance() {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }
    /**
     * NHN Provider 반환 (Aligo 제거됨)
     */
    async getProvider() {
        if (this.provider) {
            return this.provider;
        }
        functions.logger.info('Using NHN Cloud AlimTalk provider');
        this.provider = new NHNProvider();
        return this.provider;
    }
    /**
     * AlimTalk 전송
     */
    async sendAlimTalk(params, societyId) {
        // 전화번호 정제 (숫자만 남김)
        const cleanParams = {
            ...params,
            phone: params.phone.replace(/[^0-9]/g, '')
        };
        const provider = await this.getProvider();
        functions.logger.info('Sending AlimTalk', {
            provider: provider.getProviderName(),
            societyId,
            phone: cleanParams.phone,
            templateCode: cleanParams.templateCode,
        });
        const result = await provider.send(cleanParams, societyId);
        if (result.success) {
            functions.logger.info('AlimTalk sent successfully', {
                provider: result.provider,
                messageId: result.messageId,
            });
        }
        else {
            functions.logger.error('AlimTalk send failed', {
                provider: result.provider,
                error: result.error,
            });
        }
        return result;
    }
    /**
     * 프로바이더 캐시 초기화
     */
    resetProvider() {
        this.provider = null;
    }
}
exports.NotificationService = NotificationService;
// 편의 함수
async function sendAlimTalk(params, societyId) {
    const service = NotificationService.getInstance();
    return service.sendAlimTalk(params, societyId);
}
exports.sendAlimTalk = sendAlimTalk;
//# sourceMappingURL=notificationService.js.map