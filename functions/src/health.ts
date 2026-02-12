/**
 * Health Check Endpoint
 * 
 * 배포 후 시스템 상태를 확인하기 위한 엔드포인트
 * 
 * 체크 항목:
 * - Firestore 연결 상태
 * - 필수 환경 변수 존재 여부
 * - 외부 API 연결 상태 (선택적)
 * - 시스템 버전 정보
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    checks: {
        firestore: CheckResult;
        environment: CheckResult;
        functions: CheckResult;
    };
    details?: any;
}

interface CheckResult {
    status: 'pass' | 'warn' | 'fail';
    message: string;
    duration?: number;
}

/**
 * Firestore 연결 상태 확인
 */
async function checkFirestore(): Promise<CheckResult> {
    const startTime = Date.now();
    try {
        // 간단한 읽기 작업으로 연결 테스트
        await admin.firestore()
            .collection('_health_check')
            .doc('test')
            .get();

        const duration = Date.now() - startTime;

        if (duration > 1000) {
            return {
                status: 'warn',
                message: `Firestore 응답 느림 (${duration}ms)`,
                duration,
            };
        }

        return {
            status: 'pass',
            message: 'Firestore 정상',
            duration,
        };
    } catch (error: any) {
        return {
            status: 'fail',
            message: `Firestore 연결 실패: ${error.message}`,
            duration: Date.now() - startTime,
        };
    }
}

/**
 * 필수 환경 변수 확인
 */
function checkEnvironment(): CheckResult {
    const requiredVars = [
        'FIREBASE_CONFIG',
        'GCLOUD_PROJECT',
    ];

    const optionalVars: string[] = [];

    const missing: string[] = [];
    const missingOptional: string[] = [];

    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    });

    optionalVars.forEach(varName => {
        if (!process.env[varName]) {
            missingOptional.push(varName);
        }
    });

    if (missing.length > 0) {
        return {
            status: 'fail',
            message: `필수 환경 변수 없음: ${missing.join(', ')}`,
        };
    }

    if (missingOptional.length > 0) {
        return {
            status: 'warn',
            message: `선택적 환경 변수 없음: ${missingOptional.join(', ')}`,
        };
    }

    return {
        status: 'pass',
        message: '모든 환경 변수 정상',
    };
}

/**
 * Functions 상태 확인
 */
function checkFunctions(): CheckResult {
    try {
        // 기본적인 런타임 정보 확인
        const nodeVersion = process.version;
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

        // 메모리 사용량 경고 (512MB 이상)
        if (memoryUsageMB > 512) {
            return {
                status: 'warn',
                message: `메모리 사용량 높음: ${memoryUsageMB}MB`,
            };
        }

        return {
            status: 'pass',
            message: `Functions 정상 (Node ${nodeVersion}, Memory: ${memoryUsageMB}MB)`,
        };
    } catch (error: any) {
        return {
            status: 'fail',
            message: `Functions 체크 실패: ${error.message}`,
        };
    }
}

/**
 * Health Check HTTP Endpoint
 */
export const healthCheck = functions.https.onRequest(async (req, res) => {
    const startTime = Date.now();

    try {
        // CORS 헤더 설정
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        if (req.method !== 'GET') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        // 각 항목 체크
        const [firestoreCheck, environmentCheck, functionsCheck] = await Promise.all([
            checkFirestore(),
            Promise.resolve(checkEnvironment()),
            Promise.resolve(checkFunctions()),
        ]);

        const checks = {
            firestore: firestoreCheck,
            environment: environmentCheck,
            functions: functionsCheck,
        };

        // 전체 상태 결정
        let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        const hasFailure = Object.values(checks).some(c => c.status === 'fail');
        const hasWarning = Object.values(checks).some(c => c.status === 'warn');

        if (hasFailure) {
            overallStatus = 'unhealthy';
        } else if (hasWarning) {
            overallStatus = 'degraded';
        }

        const result: HealthCheckResult = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            version: process.env.APP_VERSION || 'unknown',
            checks,
            details: {
                totalDuration: Date.now() - startTime,
                environment: process.env.GCLOUD_PROJECT || 'unknown',
            },
        };

        // 상태에 따라 HTTP 상태 코드 설정
        const statusCode = overallStatus === 'healthy' ? 200 :
            overallStatus === 'degraded' ? 200 : 503;

        res.status(statusCode).json(result);

        // 로그 기록
        functions.logger.info('Health check completed', {
            status: overallStatus,
            duration: Date.now() - startTime,
        });

    } catch (error: any) {
        functions.logger.error('Health check failed', error);

        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message,
            details: {
                totalDuration: Date.now() - startTime,
            },
        });
    }
});

/**
 * Scheduled Health Check (매 5분마다 실행)
 * 문제 발생 시 로그에 기록
 */
export const scheduledHealthCheck = functions.pubsub
    .schedule('*/5 * * * *')
    .onRun(async (context) => {
        try {
            const [firestoreCheck, environmentCheck, functionsCheck] = await Promise.all([
                checkFirestore(),
                Promise.resolve(checkEnvironment()),
                Promise.resolve(checkFunctions()),
            ]);

            const checks = { firestore: firestoreCheck, environment: environmentCheck, functions: functionsCheck };
            const hasFailure = Object.values(checks).some(c => c.status === 'fail');
            const hasWarning = Object.values(checks).some(c => c.status === 'warn');

            if (hasFailure) {
                functions.logger.error('Scheduled health check FAILED', { checks });
                // 여기에 알림 로직 추가 가능 (이메일, Slack 등)
            } else if (hasWarning) {
                functions.logger.warn('Scheduled health check has WARNINGS', { checks });
            } else {
                functions.logger.info('Scheduled health check passed', { checks });
            }

            return null;
        } catch (error: any) {
            functions.logger.error('Scheduled health check error', error);
            return null;
        }
    });
