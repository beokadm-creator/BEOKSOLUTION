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

import * as admin from 'firebase-admin';

export interface FeatureFlags {
    // AlimTalk 관련
    useNHNAlimTalk: boolean;
    useAligoAlimTalk: boolean;

    // 외부 참석자 관련
    enableExternalAttendee: boolean;
    enableExternalAttendeeMigration: boolean;

    // 모니터링 관련
    enableMonitoring: boolean;
    enableScheduledReports: boolean;

    // 결제 관련
    enableTossPayment: boolean;

    // 기타
    enableMaintenanceMode: boolean;
    enableDebugMode: boolean;
}

// 기본값 (안전한 설정)
const DEFAULT_FLAGS: FeatureFlags = {
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
let cachedFlags: FeatureFlags | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

/**
 * Feature Flags 가져오기
 * Firestore의 _config/feature_flags 문서에서 읽음
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
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

        const data = doc.data() as Partial<FeatureFlags>;

        // 기본값과 병합
        cachedFlags = {
            ...DEFAULT_FLAGS,
            ...data,
        };

        cacheTimestamp = now;
        return cachedFlags;

    } catch (error) {
        console.error('Failed to get feature flags, using defaults:', error);
        return DEFAULT_FLAGS;
    }
}

/**
 * 특정 Feature Flag 확인
 */
export async function isFeatureEnabled(flagName: keyof FeatureFlags): Promise<boolean> {
    const flags = await getFeatureFlags();
    return flags[flagName] ?? false;
}

/**
 * Feature Flags 업데이트 (관리자용)
 */
export async function updateFeatureFlags(updates: Partial<FeatureFlags>): Promise<void> {
    try {
        await admin.firestore()
            .collection('_config')
            .doc('feature_flags')
            .set(updates, { merge: true });

        // 캐시 무효화
        cachedFlags = null;
        cacheTimestamp = 0;

        console.log('Feature flags updated:', updates);
    } catch (error) {
        console.error('Failed to update feature flags:', error);
        throw error;
    }
}

/**
 * Feature Flags 초기화 (최초 설정용)
 */
export async function initializeFeatureFlags(): Promise<void> {
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
        } else {
            console.log('Feature flags already exist');
        }
    } catch (error) {
        console.error('Failed to initialize feature flags:', error);
        throw error;
    }
}

/**
 * 캐시 무효화 (테스트용)
 */
export function clearFeatureFlagsCache(): void {
    cachedFlags = null;
    cacheTimestamp = 0;
}
