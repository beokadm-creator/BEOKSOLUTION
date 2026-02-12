#!/usr/bin/env node

/**
 * 안전한 배포 스크립트
 * 
 * 단계:
 * 1. 배포 전 체크 실행
 * 2. 스테이징 배포 (Preview Channel)
 * 3. 스테이징 검증
 * 4. 사용자 확인
 * 5. 프로덕션 배포
 * 6. 배포 후 헬스체크
 * 7. 모니터링
 * 
 * 사용법:
 *   node scripts/safe-deploy.js [--skip-staging] [--auto-approve]
 */

const { execSync } = require('child_process');
const readline = require('readline');

// 색상 코드
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`Step ${step}: ${message}`, 'bright');
    log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
    log(`✓ ${message}`, 'green');
}

function logError(message) {
    log(`✗ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠ ${message}`, 'yellow');
}

function runCommand(command, description) {
    try {
        log(`\n실행 중: ${description}`, 'blue');
        log(`명령어: ${command}`, 'cyan');

        const output = execSync(command, {
            stdio: 'inherit',
            encoding: 'utf-8',
        });

        logSuccess(`${description} 완료`);
        return true;
    } catch (error) {
        logError(`${description} 실패`);
        return false;
    }
}

async function askQuestion(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(colors.yellow + question + colors.reset + ' ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase().trim());
        });
    });
}

async function confirmContinue(message = '계속하시겠습니까?') {
    const answer = await askQuestion(`${message} (y/n):`);
    return answer === 'y' || answer === 'yes';
}

async function main() {
    const args = process.argv.slice(2);
    const skipStaging = args.includes('--skip-staging');
    const autoApprove = args.includes('--auto-approve');

    log('\n' + '='.repeat(60), 'bright');
    log('🚀 안전한 배포 프로세스 시작', 'bright');
    log('='.repeat(60) + '\n', 'bright');

    let currentStep = 0;

    // Step 1: 배포 전 체크
    currentStep++;
    logStep(currentStep, '배포 전 안전성 체크');

    const preCheckPassed = runCommand(
        'node scripts/pre-deploy-check.js',
        '배포 전 체크'
    );

    if (!preCheckPassed) {
        logError('배포 전 체크 실패. 문제를 해결한 후 다시 시도하세요.');
        process.exit(1);
    }

    if (!autoApprove) {
        const continueAfterCheck = await confirmContinue('배포 전 체크 통과. 계속하시겠습니까?');
        if (!continueAfterCheck) {
            log('배포 취소됨', 'yellow');
            process.exit(0);
        }
    }

    // Step 2: Git 상태 확인
    currentStep++;
    logStep(currentStep, 'Git 상태 확인');

    try {
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
        if (gitStatus.trim()) {
            logWarning('커밋되지 않은 변경사항이 있습니다:');
            console.log(gitStatus);

            if (!autoApprove) {
                const continueWithChanges = await confirmContinue('계속하시겠습니까?');
                if (!continueWithChanges) {
                    log('배포 취소됨', 'yellow');
                    process.exit(0);
                }
            }
        } else {
            logSuccess('Git 작업 디렉토리 깨끗함');
        }

        // 현재 브랜치 확인
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
        log(`현재 브랜치: ${currentBranch}`, 'cyan');

        if (currentBranch !== 'main' && currentBranch !== 'master') {
            logWarning(`프로덕션 배포는 보통 main/master 브랜치에서 수행됩니다.`);

            if (!autoApprove) {
                const continueWithBranch = await confirmContinue('계속하시겠습니까?');
                if (!continueWithBranch) {
                    log('배포 취소됨', 'yellow');
                    process.exit(0);
                }
            }
        }
    } catch (error) {
        logWarning('Git 상태 확인 실패 (Git 저장소가 아닐 수 있음)');
    }

    // Step 3: 스테이징 배포 (선택적)
    if (!skipStaging) {
        currentStep++;
        logStep(currentStep, '스테이징 환경 배포 (Preview Channel)');

        const channelId = `staging-${Date.now()}`;
        log(`Preview Channel ID: ${channelId}`, 'cyan');

        const stagingDeployed = runCommand(
            `firebase hosting:channel:deploy ${channelId} --expires 1h`,
            '스테이징 배포'
        );

        if (!stagingDeployed) {
            logError('스테이징 배포 실패');
            process.exit(1);
        }

        logSuccess('스테이징 배포 완료');
        log('\n스테이징 URL에서 테스트를 진행하세요.', 'yellow');
        log('주요 확인 사항:', 'yellow');
        log('  - 홈페이지 접근', 'yellow');
        log('  - 로그인/로그아웃', 'yellow');
        log('  - 등록 페이지', 'yellow');
        log('  - 결제 프로세스', 'yellow');

        if (!autoApprove) {
            const stagingOk = await confirmContinue('\n스테이징 테스트 완료. 프로덕션 배포를 진행하시겠습니까?');
            if (!stagingOk) {
                log('배포 취소됨', 'yellow');
                process.exit(0);
            }
        }
    }

    // Step 4: 프로덕션 배포
    currentStep++;
    logStep(currentStep, '프로덕션 배포');

    if (!autoApprove) {
        log('\n⚠️  프로덕션 환경에 배포합니다!', 'red');
        const finalConfirm = await confirmContinue('정말 배포하시겠습니까?');
        if (!finalConfirm) {
            log('배포 취소됨', 'yellow');
            process.exit(0);
        }
    }

    const productionDeployed = runCommand(
        'firebase deploy --only hosting,functions',
        '프로덕션 배포'
    );

    if (!productionDeployed) {
        logError('프로덕션 배포 실패');
        process.exit(1);
    }

    logSuccess('프로덕션 배포 완료!');

    // Step 5: 배포 후 헬스체크
    currentStep++;
    logStep(currentStep, '배포 후 헬스체크');

    log('\n30초 대기 중... (배포 완료 대기)', 'cyan');
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
        // Firebase 프로젝트 ID 가져오기
        const firebaserc = require('../.firebaserc');
        const projectId = firebaserc.projects?.default;

        if (projectId) {
            const healthUrl = `https://us-central1-${projectId}.cloudfunctions.net/healthCheck`;
            log(`헬스체크 URL: ${healthUrl}`, 'cyan');

            try {
                const healthCheck = execSync(`curl -s ${healthUrl}`, { encoding: 'utf-8' });
                const healthData = JSON.parse(healthCheck);

                if (healthData.status === 'healthy') {
                    logSuccess('헬스체크 통과: 시스템 정상');
                } else if (healthData.status === 'degraded') {
                    logWarning('헬스체크 경고: 일부 기능에 문제가 있을 수 있음');
                    console.log(JSON.stringify(healthData, null, 2));
                } else {
                    logError('헬스체크 실패: 시스템에 문제가 있음');
                    console.log(JSON.stringify(healthData, null, 2));
                }
            } catch (error) {
                logWarning('헬스체크 실패 (엔드포인트가 아직 배포되지 않았을 수 있음)');
            }
        }
    } catch (error) {
        logWarning('헬스체크를 수행할 수 없음');
    }

    // Step 6: 배포 완료 안내
    currentStep++;
    logStep(currentStep, '배포 완료');

    log('\n✅ 배포가 성공적으로 완료되었습니다!', 'green');
    log('\n다음 단계:', 'yellow');
    log('  1. 프로덕션 사이트에 접속하여 주요 기능 테스트', 'yellow');
    log('  2. Firebase Console에서 에러 로그 모니터링', 'yellow');
    log('  3. 5-10분간 사용자 피드백 확인', 'yellow');
    log('  4. 문제 발생 시 즉시 롤백 준비', 'yellow');

    log('\n롤백 명령어:', 'cyan');
    log('  firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live', 'cyan');

    log('\n모니터링 링크:', 'cyan');
    log('  Firebase Console: https://console.firebase.google.com/', 'cyan');
    log('  Functions Logs: https://console.firebase.google.com/project/_/functions/logs', 'cyan');
}

// 실행
main().catch(error => {
    logError(`예상치 못한 오류: ${error.message}`);
    console.error(error);
    process.exit(1);
});
