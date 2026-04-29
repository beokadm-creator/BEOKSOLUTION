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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
exports.sendAlimTalk = sendAlimTalk;
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
    async send(params, entityId, entityType = 'society') {
        var _a, _b;
        try {
            // Firestore에서 NHN Cloud 설정 가져오기
            const db = admin.firestore();
            if (!entityId) {
                throw new Error('entityId is required for NHN Cloud AlimTalk');
            }
            // Determine collection path based on entity type
            const collectionPath = entityType === 'vendor' ? 'vendors' : 'societies';
            const infraSnap = await db
                .collection(collectionPath)
                .doc(entityId)
                .collection('settings')
                .doc('infrastructure')
                .get();
            if (!infraSnap.exists) {
                throw new Error('Infrastructure settings not found');
            }
            const infraData = infraSnap.data();
            const nhnConfig = (_a = infraData === null || infraData === void 0 ? void 0 : infraData.notification) === null || _a === void 0 ? void 0 : _a.nhnAlimTalk;
            const appKey = process.env.NHN_APP_KEY;
            const secretKey = process.env.NHN_SECRET_KEY;
            if (!appKey || !secretKey) {
                throw new Error('NHN Cloud credentials are not configured');
            }
            // senderKey만 entity별로 상이 (Firestore에서 조회)
            if (!(nhnConfig === null || nhnConfig === void 0 ? void 0 : nhnConfig.senderKey)) {
                const entityName = entityType === 'vendor' ? 'partner' : 'society';
                throw new Error(`NHN Cloud senderKey not configured for this ${entityName}. Please configure in Notification settings.`);
            }
            const senderKey = nhnConfig.senderKey;
            // NHN Cloud API 호출
            const result = await (0, nhnCloud_1.sendAlimTalk)({
                appKey: appKey,
                secretKey: secretKey,
                senderKey: senderKey,
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
            functions.logger.error('NHN send failed', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            const responseData = error && typeof error === 'object' && 'response' in error
                ? (_b = error.response) === null || _b === void 0 ? void 0 : _b.data
                : undefined;
            return {
                success: false,
                error: message,
                provider: 'nhn',
                rawResponse: responseData
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
    async sendAlimTalk(params, entityId, entityType = 'society') {
        // 전화번호 정제 (숫자만 남김)
        const cleanParams = {
            ...params,
            phone: params.phone.replace(/[^0-9]/g, '')
        };
        const provider = await this.getProvider();
        functions.logger.info('Sending AlimTalk', {
            provider: provider.getProviderName(),
            entityId,
            entityType,
            phone: cleanParams.phone,
            templateCode: cleanParams.templateCode,
        });
        const result = await provider.send(cleanParams, entityId, entityType);
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
async function sendAlimTalk(params, entityId, entityType = 'society') {
    const service = NotificationService.getInstance();
    return service.sendAlimTalk(params, entityId, entityType);
}
//# sourceMappingURL=notificationService.js.map