
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

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendAlimTalk as nhnSendAlimTalk } from '../utils/nhnCloud';

// 공통 인터페이스
export interface AlimTalkParams {
    phone: string;
    templateCode: string;
    variables: Record<string, string>;
    buttons?: AlimTalkButton[];
}

export interface AlimTalkButton {
    name: string;
    type: 'WL' | 'AL' | 'DS' | 'BK' | 'MD';
    url_mobile?: string;
    url_pc?: string;
}

export interface AlimTalkResult {
    success: boolean;
    messageId?: string;
    error?: string;
    provider: 'aligo' | 'nhn';
    rawResponse?: unknown;
}

/**
 * AlimTalk Provider 인터페이스
 */
export interface IAlimTalkProvider {
    send(params: AlimTalkParams, societyId?: string): Promise<AlimTalkResult>;
    getProviderName(): string;
}


// NHN Cloud 전역 설정 (프로젝트 단위 - 모든 학회 공통)
const NHN_GLOBAL_APP_KEY = 'Ik6GEBC22p5Qliqk';
const NHN_GLOBAL_SECRET_KEY = 'ajFUrusk8I7tgBQdrztuQvcf6jgWWcme';

/**
 * NHN Cloud Provider 구현
 */
class NHNProvider implements IAlimTalkProvider {
    getProviderName(): string {
        return 'nhn';
    }

    async send(params: AlimTalkParams, societyId?: string): Promise<AlimTalkResult> {
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
            // 실제 Firestore 구조: notification.nhnAlimTalk.senderKey
            const nhnConfig = infraData?.notification?.nhnAlimTalk;

            if (!nhnConfig?.senderKey) {
                throw new Error('NHN Cloud senderKey is not configured. Please set it in Infrastructure Settings.');
            }

            if (!nhnConfig?.enabled) {
                throw new Error('NHN Cloud AlimTalk is not enabled. Please enable it in Infrastructure Settings.');
            }

            // NHN Cloud API 호출 (appKey/secretKey는 전역 상수 사용)
            const result = await nhnSendAlimTalk(
                {
                    appKey: NHN_GLOBAL_APP_KEY,
                    secretKey: NHN_GLOBAL_SECRET_KEY,
                    senderKey: nhnConfig.senderKey,
                },
                {
                    recipientNo: params.phone,
                    templateCode: params.templateCode,
                    templateParameter: params.variables,
                }
            );

            if (result.success) {
                return {
                    success: true,
                    messageId: result.requestId,
                    provider: 'nhn',
                    rawResponse: result.rawResponse
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'Unknown error',
                    provider: 'nhn',
                    rawResponse: result.rawResponse
                };
            }
        } catch (error: unknown) {
            const err = error as Error & { response?: { data?: unknown } };
            functions.logger.error('NHN send failed', err);
            return {
                success: false,
                error: err.message,
                provider: 'nhn',
                rawResponse: err.response?.data
            };
        }
    }
}

/**
 * Notification Service (Singleton)
 */
export class NotificationService {
    private static instance: NotificationService;
    private provider: IAlimTalkProvider | null = null;

    private constructor() { }

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * NHN Provider 반환 (Aligo 제거됨)
     */
    private async getProvider(): Promise<IAlimTalkProvider> {
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
    async sendAlimTalk(params: AlimTalkParams, societyId: string): Promise<AlimTalkResult> {
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
        } else {
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
    resetProvider(): void {
        this.provider = null;
    }
}

// 편의 함수
export async function sendAlimTalk(params: AlimTalkParams, societyId: string): Promise<AlimTalkResult> {
    const service = NotificationService.getInstance();
    return service.sendAlimTalk(params, societyId);
}
