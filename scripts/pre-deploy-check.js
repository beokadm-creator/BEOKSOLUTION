#!/usr/bin/env node

/**
 * 배포 전 필수 체크리스트 자동화 스크립트 (ES Module)
 * 
 * 사용법: node scripts/pre-deploy-check.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 색상 코드
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, total, message) {
    log(`\n[${step}/${total}] ${message}`, 'blue');
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

// 실행 함수
function runCommand(command, errorMessage) {
    try {
        execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
        return true;
    } catch (error) {
        logError(errorMessage);
        if (error.stdout) {
            console.log(error.stdout);
        }
        if (error.stderr) {
            console.error(error.stderr);
        }
        return false;
    }
}

// 파일 존재 확인
function checkFileExists(filePath, description) {
    if (fs.existsSync(filePath)) {
        logSuccess(`${description} 존재 확인`);
        return true;
    } else {
        logError(`${description} 없음: ${filePath}`);
        return false;
    }
}

// 환경 변수 체크
function checkEnvVariables() {
    const projectRoot = path.resolve(__dirname, '..');
    const envFile = path.join(projectRoot, '.env.production');

    if (!fs.existsSync(envFile)) {
        logWarning('.env.production 파일이 없습니다.');
        return true; // 경고만 하고 계속 진행
    }

    const envContent = fs.readFileSync(envFile, 'utf-8');
    const requiredVars = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
    ];

    let allPresent = true;
    requiredVars.forEach(varName => {
        if (envContent.includes(varName)) {
            logSuccess(`환경 변수 ${varName} 존재`);
        } else {
            logWarning(`환경 변수 ${varName} 없음`);
            allPresent = false;
        }
    });

    return allPresent;
}

// Firebase 설정 체크
function checkFirebaseConfig() {
    const projectRoot = path.resolve(__dirname, '..');
    const firebaseJson = path.join(projectRoot, 'firebase.json');
    const firebaserc = path.join(projectRoot, '.firebaserc');

    let valid = true;
    valid = checkFileExists(firebaseJson, 'firebase.json') && valid;
    valid = checkFileExists(firebaserc, '.firebaserc') && valid;

    if (valid) {
        try {
            const config = JSON.parse(fs.readFileSync(firebaseJson, 'utf-8'));
            if (config.hosting && config.hosting.public) {
                logSuccess(`Hosting 설정 확인: ${config.hosting.public}`);
            }
        } catch (error) {
            logError('firebase.json 파싱 실패');
            valid = false;
        }
    }

    return valid;
}

// 주요 파일 체크
function checkCriticalFiles() {
    const projectRoot = path.resolve(__dirname, '..');
    const criticalFiles = [
        { path: 'src/App.tsx', desc: 'App.tsx' },
        { path: 'src/main.tsx', desc: 'main.tsx' },
        { path: 'index.html', desc: 'index.html' },
        { path: 'vite.config.ts', desc: 'vite.config.ts' },
        { path: 'package.json', desc: 'package.json' },
    ];

    let allExist = true;
    criticalFiles.forEach(file => {
        const exists = checkFileExists(
            path.join(projectRoot, file.path),
            file.desc
        );
        allExist = allExist && exists;
    });

    return allExist;
}

// 메인 체크 프로세스
async function main() {
    const projectRoot = path.resolve(__dirname, '..');

    log('\n' + '='.repeat(60), 'bright');
    log('배포 전 안전성 체크 시작', 'bright');
    log('='.repeat(60) + '\n', 'bright');

    const checks = [];
    let currentStep = 0;
    const totalSteps = 8;

    // 1. 주요 파일 존재 확인
    currentStep++;
    logStep(currentStep, totalSteps, '주요 파일 존재 확인');
    checks.push({
        name: '주요 파일 체크',
        passed: checkCriticalFiles(),
        critical: true,
    });

    // 2. Firebase 설정 확인
    currentStep++;
    logStep(currentStep, totalSteps, 'Firebase 설정 확인');
    checks.push({
        name: 'Firebase 설정',
        passed: checkFirebaseConfig(),
        critical: true,
    });

    // 3. 환경 변수 확인
    currentStep++;
    logStep(currentStep, totalSteps, '환경 변수 확인');
    checks.push({
        name: '환경 변수',
        passed: checkEnvVariables(),
        critical: false,
    });

    // 4. 의존성 설치 확인
    currentStep++;
    logStep(currentStep, totalSteps, '의존성 설치 확인');
    const nodeModulesExists = fs.existsSync(path.join(projectRoot, 'node_modules'));
    if (nodeModulesExists) {
        logSuccess('node_modules 존재');
        checks.push({ name: '의존성 설치', passed: true, critical: true });
    } else {
        logError('node_modules 없음. npm install을 실행하세요.');
        checks.push({ name: '의존성 설치', passed: false, critical: true });
    }

    // 5. TypeScript 타입 체크
    currentStep++;
    logStep(currentStep, totalSteps, 'TypeScript 타입 체크');
    const typeCheckPassed = runCommand(
        'npx tsc --noEmit',
        'TypeScript 타입 체크 실패'
    );
    checks.push({ name: 'TypeScript 타입 체크', passed: typeCheckPassed, critical: true });
    if (typeCheckPassed) {
        logSuccess('TypeScript 타입 체크 통과');
    }

    // 6. ESLint 검사
    currentStep++;
    logStep(currentStep, totalSteps, 'ESLint 검사');
    const lintPassed = runCommand(
        'npm run lint',
        'ESLint 검사 실패'
    );
    checks.push({ name: 'ESLint', passed: lintPassed, critical: false });
    if (lintPassed) {
        logSuccess('ESLint 검사 통과');
    }

    // 7. 빌드 테스트
    currentStep++;
    logStep(currentStep, totalSteps, '프로덕션 빌드 테스트');
    const buildPassed = runCommand(
        'npm run build',
        '빌드 실패'
    );
    checks.push({ name: '빌드', passed: buildPassed, critical: true });
    if (buildPassed) {
        logSuccess('빌드 성공');

        // dist 폴더 확인
        const distExists = fs.existsSync(path.join(projectRoot, 'dist'));
        if (distExists) {
            logSuccess('dist 폴더 생성 확인');

            // index.html 확인
            const indexHtmlExists = fs.existsSync(path.join(projectRoot, 'dist', 'index.html'));
            if (indexHtmlExists) {
                logSuccess('dist/index.html 생성 확인');
            } else {
                logError('dist/index.html 없음');
                checks.push({ name: 'dist/index.html', passed: false, critical: true });
            }
        } else {
            logError('dist 폴더 없음');
            checks.push({ name: 'dist 폴더', passed: false, critical: true });
        }
    }

    // 8. Functions 체크 (선택적)
    currentStep++;
    logStep(currentStep, totalSteps, 'Firebase Functions 체크');
    const functionsDir = path.join(projectRoot, 'functions');
    if (fs.existsSync(functionsDir)) {
        const functionsBuildPassed = runCommand(
            'cd functions && npm run build',
            'Functions 빌드 실패'
        );
        checks.push({ name: 'Functions 빌드', passed: functionsBuildPassed, critical: true });
        if (functionsBuildPassed) {
            logSuccess('Functions 빌드 성공');
        }
    } else {
        logWarning('functions 폴더 없음 (선택적)');
        checks.push({ name: 'Functions', passed: true, critical: false });
    }

    // 결과 요약
    log('\n' + '='.repeat(60), 'bright');
    log('체크 결과 요약', 'bright');
    log('='.repeat(60) + '\n', 'bright');

    const criticalFailed = checks.filter(c => c.critical && !c.passed);
    const warningFailed = checks.filter(c => !c.critical && !c.passed);
    const allPassed = checks.filter(c => c.passed);

    log(`✓ 통과: ${allPassed.length}/${checks.length}`, 'green');

    if (criticalFailed.length > 0) {
        log(`✗ 치명적 실패: ${criticalFailed.length}`, 'red');
        criticalFailed.forEach(c => log(`  - ${c.name}`, 'red'));
    }

    if (warningFailed.length > 0) {
        log(`⚠ 경고: ${warningFailed.length}`, 'yellow');
        warningFailed.forEach(c => log(`  - ${c.name}`, 'yellow'));
    }

    log('\n' + '='.repeat(60) + '\n', 'bright');

    if (criticalFailed.length > 0) {
        log('❌ 배포 불가: 치명적 오류를 먼저 해결하세요.', 'red');
        process.exit(1);
    } else if (warningFailed.length > 0) {
        log('⚠️  배포 가능하나 경고 사항을 확인하세요.', 'yellow');
        process.exit(0);
    } else {
        log('✅ 모든 체크 통과! 배포 가능합니다.', 'green');
        process.exit(0);
    }
}

// 실행
main().catch(error => {
    logError(`예상치 못한 오류: ${error.message}`);
    console.error(error);
    process.exit(1);
});
