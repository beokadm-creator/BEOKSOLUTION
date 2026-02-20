"use strict";
/**
 * Feature Flag Service
 *
 * 기능별 on/off를 제어하여 안전한 배포를 가능하게 함
 * Firebase Remote Config 또는 Firestore 기반
 *
 * 사용 예시:
 * ```typescript
 * const flags = await getFeatureFlags();
 * if (flags.useNHNAlimTalk) {
 *   await sendNHNAlimTalk(...);
 * } else {
 *   await sendAligoAlimTalk(...);
 * }
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
exports.clearFeatureFlagsCache = exports.initializeFeatureFlags = exports.updateFeatureFlags = exports.isFeatureEnabled = exports.getFeatureFlags = void 0;
const admin = __importStar(require("firebase-admin"));
// 기본값 (안전한 설정)
const DEFAULT_FLAGS = {
    useNHNAlimTalk: false,
    useAligoAlimTalk: true,
    enableExternalAttendee: true,
    enableExternalAttendeeMigration: false,
    enableMonitoring: true,
    enableScheduledReports: false,
    enableTossPayment: true,
    enableMaintenanceMode: false,
    enableDebugMode: false,
};
// 캐시 (5분)
let cachedFlags = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분
/**
 * Feature Flags 가져오기
 * Firestore의 _config/feature_flags 문서에서 읽음
 */
async function getFeatureFlags() {
    try {
        // 캐시 확인
        const now = Date.now();
        if (cachedFlags && (now - cacheTimestamp) < CACHE_DURATION) {
            return cachedFlags;
        }
        // Firestore에서 읽기
        const doc = await admin.firestore()
            .collection('_config')
            .doc('feature_flags')
            .get();
        if (!doc.exists) {
            console.warn('Feature flags document not found, using defaults');
            cachedFlags = DEFAULT_FLAGS;
            cacheTimestamp = now;
            return DEFAULT_FLAGS;
        }
        const data = doc.data();
        // 기본값과 병합
        cachedFlags = {
            ...DEFAULT_FLAGS,
            ...data,
        };
        cacheTimestamp = now;
        return cachedFlags;
    }
    catch (error) {
        console.error('Failed to get feature flags, using defaults:', error);
        return DEFAULT_FLAGS;
    }
}
exports.getFeatureFlags = getFeatureFlags;
/**
 * 특정 Feature Flag 확인
 */
async function isFeatureEnabled(flagName) {
    var _a;
    const flags = await getFeatureFlags();
    return (_a = flags[flagName]) !== null && _a !== void 0 ? _a : false;
}
exports.isFeatureEnabled = isFeatureEnabled;
/**
 * Feature Flags 업데이트 (관리자용)
 */
async function updateFeatureFlags(updates) {
    try {
        await admin.firestore()
            .collection('_config')
            .doc('feature_flags')
            .set(updates, { merge: true });
        // 캐시 무효화
        cachedFlags = null;
        cacheTimestamp = 0;
        console.log('Feature flags updated:', updates);
    }
    catch (error) {
        console.error('Failed to update feature flags:', error);
        throw error;
    }
}
exports.updateFeatureFlags = updateFeatureFlags;
/**
 * Feature Flags 초기화 (최초 설정용)
 */
async function initializeFeatureFlags() {
    try {
        const doc = await admin.firestore()
            .collection('_config')
            .doc('feature_flags')
            .get();
        if (!doc.exists) {
            await admin.firestore()
                .collection('_config')
                .doc('feature_flags')
                .set(DEFAULT_FLAGS);
            console.log('Feature flags initialized with defaults');
        }
        else {
            console.log('Feature flags already exist');
        }
    }
    catch (error) {
        console.error('Failed to initialize feature flags:', error);
        throw error;
    }
}
exports.initializeFeatureFlags = initializeFeatureFlags;
/**
 * 캐시 무효화 (테스트용)
 */
function clearFeatureFlagsCache() {
    cachedFlags = null;
    cacheTimestamp = 0;
}
exports.clearFeatureFlagsCache = clearFeatureFlagsCache;
//# sourceMappingURL=featureFlags.js.map