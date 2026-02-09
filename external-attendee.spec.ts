/**
 * 외부 참석자(External Attendee) E2E 테스트
 *
 * 테스트 대상:
 * 1. 관리자가 외부 참석자 등록
 * 2. 외부 참석자 로그인 및 마이페이지 확인
 * 3. 마이그레이션 후 데이터 검증
 *
 * 실행: npx playwright test external-attendee.spec.ts
 */

import { test, expect } from '@playwright/test';

// 테스트 설정
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const TEST_CONF_SLUG = process.env.TEST_SLUG || 'kap_2026spring';
const ADMIN_URL = `${BASE_URL}/admin`;
const MYPAGE_URL = `${BASE_URL}/mypage`;

// 테스트 데이터 - 외부 참석자
const externalAttendee = {
    name: '테스트 외부참석자',
    nameEn: 'Test External Attendee',
    email: `external${Date.now()}@example.com`,
    phone: '01099999999',
    affiliation: '외부 기관',
    affiliationEn: 'External Organization',
    licenseNumber: 'EXT99999'
};

// 헬퍼 함수
async function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

test.describe('시나리오 1: 관리자가 외부 참석자 등록', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(ADMIN_URL);
        // 관리자 로그인 상태 확인 (필요시 로그인)
    });

    test('1.1 외부 참석자 등록 폼 접근', async ({ page }) => {
        // 관리자 대시보드에서 외부 참석자 관리 페이지로 이동
        await page.goto(`${ADMIN_URL}/external-attendees`);

        // 페이지 로딩 대기
        await page.waitForLoadState('networkidle');

        // 등록 폼이 표시되는지 확인
        await expect(page.getByRole('heading', { name: /외부 참석자|External Attendee/i })).toBeVisible();
    });

    test('1.2 외부 참석자 정보 입력 및 등록', async ({ page }) => {
        await page.goto(`${ADMIN_URL}/external-attendees`);
        await page.waitForLoadState('networkidle');

        // 폼 입력
        await page.getByLabel(/이름|Name/i).fill(externalAttendee.name);
        await page.getByLabel(/이메일|Email/i).fill(externalAttendee.email);
        await page.getByLabel(/전화번호|Phone/i).fill(externalAttendee.phone);
        await page.getByLabel(/소속|Affiliation/i).fill(externalAttendee.affiliation);

        // 등록 버튼 클릭
        await page.getByRole('button', { name: /등록|Register|Create/i }).click();

        // 토스트 메시지 확인
        await wait(1000);
        const toastContainer = page.locator('[role="alert"]');
        await expect(toastContainer).toContainText(/성공|Success|등록됨/i);
    });

    test('1.3 외부 참석자 목록에 추가 확인', async ({ page }) => {
        await page.goto(`${ADMIN_URL}/external-attendees`);
        await page.waitForLoadState('networkidle');

        // 목록에 추가된 참석자 확인
        await expect(page.getByText(externalAttendee.name)).toBeVisible();
        await expect(page.getByText(externalAttendee.email)).toBeVisible();
    });
});

test.describe('시나리오 2: 외부 참석자 로그인 및 마이페이지', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/${TEST_CONF_SLUG}`);
        // 스토리지 초기화
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
    });

    test('2.1 외부 참석자 이메일로 로그인', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);

        // 이메일로 로그인
        await page.getByPlaceholder('name@example.com').fill(externalAttendee.email);
        await page.getByPlaceholder('비밀번호|Password').fill(externalAttendee.phone.slice(-4)); // 외부 참석자는 전화번호 뒷 4자리로 로그인

        // 로그인 버튼 클릭
        await page.getByRole('button', { name: /로그인|Sign In/i }).click();

        // 마이페이지로 리다이렉트 확인
        await page.waitForURL(/.*mypage.*/);
    });

    test('2.2 마이페이지에 학술대회 정보 표시 확인', async ({ page }) => {
        // 먼저 로그인
        await page.goto(`${BASE_URL}/login`);
        await page.getByPlaceholder('name@example.com').fill(externalAttendee.email);
        await page.getByPlaceholder('비밀번호|Password').fill(externalAttendee.phone.slice(-4));
        await page.getByRole('button', { name: /로그인|Sign In/i }).click();
        await page.waitForURL(/.*mypage.*/);

        // 학술대회 목록이 표시되는지 확인
        await page.waitForLoadState('networkidle');

        // conference-card 또는 similar selector로 확인
        const conferenceCards = page.locator('[class*="conference"], [class*="registration"]');
        await expect(conferenceCards.first()).toBeVisible();
    });

    test('2.3 결제 상태가 PAID로 표시 확인', async ({ page }) => {
        // 로그인 후 마이페이지
        await page.goto(`${BASE_URL}/login`);
        await page.getByPlaceholder('name@example.com').fill(externalAttendee.email);
        await page.getByPlaceholder('비밀번호|Password').fill(externalAttendee.phone.slice(-4));
        await page.getByRole('button', { name: /로그인|Sign In/i }).click();
        await page.waitForURL(/.*mypage.*/);

        await page.waitForLoadState('networkidle');

        // PAID 상태 확인
        const statusElement = page.getByText(/PAID|결제 완료/i);
        await expect(statusElement.first()).toBeVisible();
    });
});

test.describe('시나리오 3: 마이그레이션 후 데이터 검증', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${ADMIN_URL}`);
        // 관리자 권한 필요
    });

    test('3.1 마이그레이션Dry Run 실행', async ({ page }) => {
        await page.goto(`${ADMIN_URL}/external-attendees`);
        await page.waitForLoadState('networkidle');

        // 마이그레이션 버튼 확인
        const migrateButton = page.getByRole('button', { name: /마이그레이션|Migrate/i });
        await expect(migrateButton).toBeVisible();

        // Dry Run 모드 확인
        const dryRunCheckbox = page.getByRole('checkbox', { name: /Dry Run|시뮬레이션/i });
        if (await dryRunCheckbox.isVisible()) {
            await dryRunCheckbox.check();
        }

        // 마이그레이션 실행
        await migrateButton.click();
        await wait(2000);

        // 결과 확인
        const resultMessage = page.getByText(/Dry Run|시뮬레이션|예상/i);
        await expect(resultMessage.first()).toBeVisible();
    });

    test('3.2 마이그레이션 후 참여자 수 확인', async ({ page }) => {
        await page.goto(`${ADMIN_URL}/external-attendees`);
        await page.waitForLoadState('networkidle');

        // 마이그레이션 실행 (Dry Run 없이)
        const migrateButton = page.getByRole('button', { name: /마이그레이션|Migrate/i });

        // Dry Run 체크박스가 있다면 해제
        const dryRunCheckbox = page.getByRole('checkbox', { name: /Dry Run|시뮬레이션/i });
        if (await dryRunCheckbox.isChecked()) {
            await dryRunCheckbox.uncheck();
        }

        await migrateButton.click();
        await wait(3000);

        // 성공 메시지 확인
        const successToast = page.getByText(/마이그레이션 완료|Migration complete/i);
        await expect(successToast).toBeVisible({ timeout: 5000 });
    });

    test('3.3 참여 기록에 필수 필드 확인 (Firestore)', async ({ page }) => {
        // 이 테스트는 Firebase Console에서 수동 검증이 필요합니다
        // 또는 Cloud Function을 통해 데이터 검증

        test.skip(); // 수동 검증 필요

        // Firestore에서 확인해야 할 필드:
        // - conferenceId: string
        // - slug: string
        // - societyId: string
        // - conferenceName: string
        // - status: 'PAID'
        // - paymentStatus: 'PAID'
    });
});

test.describe('시나리오 4: 기존 외부 참석자 데이터 복구', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${ADMIN_URL}`);
    });

    test('4.1 기존 외부 참석자 마이그레이션 가능 여부 확인', async ({ page }) => {
        await page.goto(`${ADMIN_URL}/external-attendees`);
        await page.waitForLoadState('networkidle');

        // 미마이그레이션 참석자 표시 확인
        const unmigratedBadge = page.getByText(/미마이그레이션|Unmigrated|Pending/i);
        const count = await unmigratedBadge.count();

        // 마이그레이션 버튼 활성화 상태 확인
        const migrateButton = page.getByRole('button', { name: /마이그레이션|Migrate/i });
        if (count > 0) {
            await expect(migrateButton).toBeEnabled();
        }
    });

    test('4.2 마이그레이션 후 미마이그레이션 카운트 감소', async ({ page }) => {
        await page.goto(`${ADMIN_URL}/external-attendees`);
        await page.waitForLoadState('networkidle');

        // 마이그레이션 전 카운트 확인
        const beforeCount = await page.getByText(/미마이그레이션|Unmigrated/i).count();

        // 마이그레이션 실행
        const migrateButton = page.getByRole('button', { name: /마이그레이션|Migrate/i });
        await migrateButton.click();
        await wait(3000);

        // 페이지 리로드
        await page.reload();
        await page.waitForLoadState('networkidle');

        // 마이그레이션 후 카운트 확인
        const afterCount = await page.getByText(/미마이그레이션|Unmigrated/i).count();
        expect(afterCount).toBeLessThan(beforeCount);
    });
});
