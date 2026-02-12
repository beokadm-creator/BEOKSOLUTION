/**
 * AlimTalk Configuration Checker
 * 
 * 학회 관리자에 등록된 알림톡 설정이 제대로 인지되는지 확인하는 Cloud Function
 * 
 * 사용법:
 * - Admin Console에서 호출
 * - 또는 HTTP 엔드포인트로 직접 호출
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface AlimTalkCheckResult {
    success: boolean;
    societyId: string;
    timestamp: string;
    checks: {
        templates: TemplateCheck;
        infrastructure: InfraCheck;
        nhnCloud: NHNCloudCheck;
    };
    summary: {
        totalTemplates: number;
        activeTemplates: number;
        approvedTemplates: number;
        hasNHNConfig: boolean;
    };
    warnings: string[];
    errors: string[];
}

interface TemplateCheck {
    status: 'pass' | 'warn' | 'fail';
    message: string;
    templates?: any[];
}

interface InfraCheck {
    status: 'pass' | 'warn' | 'fail';
    message: string;
    config?: any;
}

interface NHNCloudCheck {
    status: 'pass' | 'warn' | 'fail';
    message: string;
    appKey?: string;
    secretKey?: string;
    senderKey?: string;
}

/**
 * 알림톡 템플릿 확인
 */
async function checkTemplates(societyId: string): Promise<TemplateCheck> {
    try {
        const templatesSnapshot = await admin.firestore()
            .collection('societies')
            .doc(societyId)
            .collection('notification-templates')
            .get();

        if (templatesSnapshot.empty) {
            return {
                status: 'warn',
                message: '등록된 알림톡 템플릿이 없습니다.',
                templates: [],
            };
        }

        const templates = templatesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as any[];

        const hasKakaoTemplates = templates.some((t: any) => t.channels?.kakao);

        if (!hasKakaoTemplates) {
            return {
                status: 'warn',
                message: '알림톡(카카오) 채널이 설정된 템플릿이 없습니다.',
                templates,
            };
        }

        return {
            status: 'pass',
            message: `${templates.length}개의 템플릿 확인됨`,
            templates,
        };
    } catch (error: any) {
        return {
            status: 'fail',
            message: `템플릿 확인 실패: ${error.message}`,
        };
    }
}

/**
 * 인프라 설정 확인
 */
async function checkInfrastructure(societyId: string): Promise<InfraCheck> {
    try {
        const infraDoc = await admin.firestore()
            .collection('societies')
            .doc(societyId)
            .collection('settings')
            .doc('infrastructure')
            .get();

        if (!infraDoc.exists) {
            return {
                status: 'warn',
                message: 'infrastructure 설정 문서가 없습니다.',
            };
        }

        const infraData = infraDoc.data();

        // 민감한 정보는 마스킹
        const maskedConfig = {
            hasPaymentConfig: !!infraData?.payment,
            hasNotificationConfig: !!infraData?.notification,
            hasNHNConfig: !!(infraData?.notification?.appKey && infraData?.notification?.secretKey && infraData?.notification?.senderKey),
        };

        return {
            status: 'pass',
            message: 'infrastructure 설정 확인됨',
            config: maskedConfig,
        };
    } catch (error: any) {
        return {
            status: 'fail',
            message: `인프라 설정 확인 실패: ${error.message}`,
        };
    }
}

/**
 * NHN Cloud 설정 확인
 */
async function checkNHNConfig(societyId: string): Promise<NHNCloudCheck> {
    try {
        const infraDoc = await admin.firestore()
            .collection('societies')
            .doc(societyId)
            .collection('settings')
            .doc('infrastructure')
            .get();

        if (!infraDoc.exists) {
            return {
                status: 'warn',
                message: 'NHN Cloud 설정이 없습니다.',
            };
        }

        const infraData = infraDoc.data();
        const nhnConfig = infraData?.notification;

        if (!nhnConfig) {
            return {
                status: 'warn',
                message: 'NHN Cloud 설정이 infrastructure에 없습니다.',
            };
        }

        const hasAppKey = !!nhnConfig.appKey;
        const hasSecretKey = !!nhnConfig.secretKey;
        const hasSenderKey = !!nhnConfig.senderKey;

        if (!hasAppKey || !hasSecretKey || !hasSenderKey) {
            return {
                status: 'fail',
                message: 'NHN Cloud 설정이 불완전합니다.',
                appKey: hasAppKey ? '설정됨' : '없음',
                secretKey: hasSecretKey ? '설정됨' : '없음',
                senderKey: hasSenderKey ? '설정됨' : '없음',
            };
        }

        return {
            status: 'pass',
            message: 'NHN Cloud 설정 확인됨',
            appKey: `${nhnConfig.appKey.substring(0, 4)}****`,
            secretKey: '설정됨',
            senderKey: `${nhnConfig.senderKey.substring(0, 4)}****`,
        };
    } catch (error: any) {
        return {
            status: 'fail',
            message: `NHN Cloud 설정 확인 실패: ${error.message}`,
        };
    }
}

/**
 * 알림톡 설정 종합 체크
 */
export const checkAlimTalkConfig = functions.https.onCall(async (data, context) => {
    // 인증 확인
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '인증이 필요합니다.');
    }

    const { societyId } = data;

    if (!societyId) {
        throw new functions.https.HttpsError('invalid-argument', 'societyId가 필요합니다.');
    }

    try {
        const warnings: string[] = [];
        const errors: string[] = [];

        // 각 항목 체크
        const [templatesCheck, infraCheck, nhnCheck] = await Promise.all([
            checkTemplates(societyId),
            checkInfrastructure(societyId),
            checkNHNConfig(societyId),
        ]);

        // 경고 및 에러 수집
        if (templatesCheck.status === 'warn') warnings.push(templatesCheck.message);
        if (templatesCheck.status === 'fail') errors.push(templatesCheck.message);

        if (infraCheck.status === 'warn') warnings.push(infraCheck.message);
        if (infraCheck.status === 'fail') errors.push(infraCheck.message);

        if (nhnCheck.status === 'warn') warnings.push(nhnCheck.message);
        if (nhnCheck.status === 'fail') errors.push(nhnCheck.message);

        // 요약 정보
        const templates = templatesCheck.templates || [];
        const activeTemplates = templates.filter(t => t.isActive);
        const approvedTemplates = templates.filter(t => t.channels?.kakao?.status === 'APPROVED');

        const result: AlimTalkCheckResult = {
            success: errors.length === 0,
            societyId,
            timestamp: new Date().toISOString(),
            checks: {
                templates: templatesCheck,
                infrastructure: infraCheck,
                nhnCloud: nhnCheck,
            },
            summary: {
                totalTemplates: templates.length,
                activeTemplates: activeTemplates.length,
                approvedTemplates: approvedTemplates.length,
                hasNHNConfig: nhnCheck.status === 'pass',
            },
            warnings,
            errors,
        };

        functions.logger.info('AlimTalk config check completed', {
            societyId,
            success: result.success,
            warnings: warnings.length,
            errors: errors.length,
        });

        return result;
    } catch (error: any) {
        functions.logger.error('AlimTalk config check failed', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * HTTP 엔드포인트 버전 (관리자용)
 */
export const checkAlimTalkConfigHttp = functions.https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const societyId = req.query.societyId as string || req.body?.societyId;

    if (!societyId) {
        res.status(400).json({ error: 'societyId parameter required' });
        return;
    }

    try {
        const warnings: string[] = [];
        const errors: string[] = [];

        const [templatesCheck, infraCheck, nhnCheck] = await Promise.all([
            checkTemplates(societyId),
            checkInfrastructure(societyId),
            checkNHNConfig(societyId),
        ]);

        if (templatesCheck.status === 'warn') warnings.push(templatesCheck.message);
        if (templatesCheck.status === 'fail') errors.push(templatesCheck.message);

        if (infraCheck.status === 'warn') warnings.push(infraCheck.message);
        if (infraCheck.status === 'fail') errors.push(infraCheck.message);

        if (nhnCheck.status === 'warn') warnings.push(nhnCheck.message);
        if (nhnCheck.status === 'fail') errors.push(nhnCheck.message);

        const templates = templatesCheck.templates || [];
        const activeTemplates = templates.filter(t => t.isActive);
        const approvedTemplates = templates.filter(t => t.channels?.kakao?.status === 'APPROVED');

        const result: AlimTalkCheckResult = {
            success: errors.length === 0,
            societyId,
            timestamp: new Date().toISOString(),
            checks: {
                templates: templatesCheck,
                infrastructure: infraCheck,
                nhnCloud: nhnCheck,
            },
            summary: {
                totalTemplates: templates.length,
                activeTemplates: activeTemplates.length,
                approvedTemplates: approvedTemplates.length,
                hasNHNConfig: nhnCheck.status === 'pass',
            },
            warnings,
            errors,
        };

        res.status(200).json(result);
    } catch (error: any) {
        functions.logger.error('AlimTalk config check HTTP failed', error);
        res.status(500).json({ error: error.message });
    }
});
