#!/usr/bin/env node

/**
 * 버전 체크 스크립트
 * 
 * package.json과 실제 설치된 패키지 버전이 일치하는지 확인
 * 특히 React 버전이 의도치 않게 변경되지 않았는지 검증
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 색상 코드
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// package.json 읽기
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// 중요 패키지 목록
const criticalPackages = [
    'react',
    'react-dom',
    'firebase',
    'react-router-dom',
];

log('\n' + '='.repeat(60), 'blue');
log('패키지 버전 체크', 'blue');
log('='.repeat(60) + '\n', 'blue');

let hasError = false;
let hasWarning = false;

// 1. package.json에 ^ 또는 ~ 가 있는지 확인
log('[1] package.json 버전 형식 체크', 'blue');
const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

Object.entries(allDeps).forEach(([name, version]) => {
    if (version.startsWith('^') || version.startsWith('~')) {
        log(`  ✗ ${name}: ${version} (버전 범위 지정자 사용 중)`, 'red');
        hasError = true;
    }
});

if (!hasError) {
    log('  ✓ 모든 패키지가 정확한 버전으로 고정됨', 'green');
}

// 2. 실제 설치된 버전 확인
log('\n[2] 설치된 패키지 버전 확인', 'blue');

criticalPackages.forEach(pkgName => {
    const expectedVersion = packageJson.dependencies[pkgName] || packageJson.devDependencies[pkgName];

    if (!expectedVersion) {
        log(`  ⚠ ${pkgName}: package.json에 없음`, 'yellow');
        hasWarning = true;
        return;
    }

    try {
        const installedPkgPath = path.join(projectRoot, 'node_modules', pkgName, 'package.json');

        if (!fs.existsSync(installedPkgPath)) {
            log(`  ✗ ${pkgName}: 설치되지 않음 (npm install 필요)`, 'red');
            hasError = true;
            return;
        }

        const installedPkg = JSON.parse(fs.readFileSync(installedPkgPath, 'utf-8'));
        const installedVersion = installedPkg.version;

        // 버전 비교 (정확히 일치해야 함)
        const cleanExpected = expectedVersion.replace(/^[\^~]/, '');

        if (installedVersion === cleanExpected) {
            log(`  ✓ ${pkgName}: ${installedVersion} (일치)`, 'green');
        } else {
            log(`  ✗ ${pkgName}: 예상 ${cleanExpected}, 실제 ${installedVersion} (불일치)`, 'red');
            hasError = true;
        }
    } catch (error) {
        log(`  ✗ ${pkgName}: 체크 실패 (${error.message})`, 'red');
        hasError = true;
    }
});

// 3. package-lock.json 존재 확인
log('\n[3] package-lock.json 확인', 'blue');
const lockFilePath = path.join(projectRoot, 'package-lock.json');

if (fs.existsSync(lockFilePath)) {
    log('  ✓ package-lock.json 존재', 'green');

    // lock 파일 버전 확인
    try {
        const lockFile = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));

        criticalPackages.forEach(pkgName => {
            const lockVersion = lockFile.packages?.[`node_modules/${pkgName}`]?.version;
            const expectedVersion = packageJson.dependencies[pkgName] || packageJson.devDependencies[pkgName];
            const cleanExpected = expectedVersion?.replace(/^[\^~]/, '');

            if (lockVersion && lockVersion !== cleanExpected) {
                log(`  ⚠ ${pkgName}: lock 파일 버전 불일치 (${lockVersion} vs ${cleanExpected})`, 'yellow');
                hasWarning = true;
            }
        });
    } catch (error) {
        log(`  ⚠ package-lock.json 파싱 실패`, 'yellow');
        hasWarning = true;
    }
} else {
    log('  ✗ package-lock.json 없음 (npm install 필요)', 'red');
    hasError = true;
}

// 4. .npmrc 확인
log('\n[4] .npmrc 설정 확인', 'blue');
const npmrcPath = path.join(projectRoot, '.npmrc');

if (fs.existsSync(npmrcPath)) {
    const npmrcContent = fs.readFileSync(npmrcPath, 'utf-8');

    const hasSaveExact = npmrcContent.includes('save-exact=true');
    const hasPackageLock = npmrcContent.includes('package-lock=true');

    if (hasSaveExact) {
        log('  ✓ save-exact=true 설정됨', 'green');
    } else {
        log('  ⚠ save-exact=true 설정 권장', 'yellow');
        hasWarning = true;
    }

    if (hasPackageLock) {
        log('  ✓ package-lock=true 설정됨', 'green');
    } else {
        log('  ⚠ package-lock=true 설정 권장', 'yellow');
        hasWarning = true;
    }
} else {
    log('  ⚠ .npmrc 파일 없음 (생성 권장)', 'yellow');
    hasWarning = true;
}

// 5. Node/NPM 버전 확인
log('\n[5] Node/NPM 버전 확인', 'blue');

if (packageJson.engines) {
    log(`  ℹ 요구 Node 버전: ${packageJson.engines.node || '명시 안됨'}`, 'blue');
    log(`  ℹ 요구 NPM 버전: ${packageJson.engines.npm || '명시 안됨'}`, 'blue');
} else {
    log('  ⚠ engines 필드 없음 (추가 권장)', 'yellow');
    hasWarning = true;
}

// 결과 요약
log('\n' + '='.repeat(60), 'blue');
log('체크 결과', 'blue');
log('='.repeat(60) + '\n', 'blue');

if (hasError) {
    log('❌ 오류 발견: 의존성을 재설치하세요.', 'red');
    log('\n권장 조치:', 'yellow');
    log('  1. rm -rf node_modules package-lock.json', 'yellow');
    log('  2. npm install', 'yellow');
    log('  3. npm run check-versions', 'yellow');
    process.exit(1);
} else if (hasWarning) {
    log('⚠️  경고 발견: 설정을 확인하세요.', 'yellow');
    process.exit(0);
} else {
    log('✅ 모든 버전이 올바르게 설정되었습니다!', 'green');
    process.exit(0);
}
