// Deployed version check script
const fs = require('fs');
const { execSync } = require('child_process');

try {
  // 1. 현재 커밋 해시 가져오기
  const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  
  // 2. 배포된 버전 확인
  const deployedVersion = fs.readFileSync('.DEPLOYED_VERSION', 'utf-8').trim();
  console.log(`Deployed version: ${deployedVersion}`);
  console.log(`Current commit: ${currentCommit.substring(0, 7)}`);
  
  // 3. Git 태그 확인 (v1.0.0 이상인지)
  const tags = execSync('git tag --points-at HEAD', { encoding: 'utf-8' }).trim().split('\n');
  const hasTag = tags.some(tag => tag.startsWith('v1.'));
  
  if (!hasTag && currentCommit !== deployedVersion) {
    console.warn('Warning: Deploying untagged version');
    console.warn('Consider creating a git tag (e.g., v1.0.1) for production release');
  }
  
  console.log('Version check passed');
} catch (error) {
  console.error('Version check failed:', error.message);
  process.exit(1);
}
