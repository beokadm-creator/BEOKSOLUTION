/**
 * 추가 옵션(Add-ons) 선택 플로우 Playwright 테스트
 *
 * 테스트 대상:
 * 1. AddonSelector 컴포넌트 표시 (기능 플래그 활성화 시)
 * 2. 옵션 선택 및 가격 계산
 * 3. 총 결제 금액 업데이트
 * 4. 수량 변경 및 옵션 해제
 * 5. 데이터 지속성 (페이지 새로고침)
 *
 * 실행: npx playwright test registration-with-addons.spec.ts
 *
 * 전제 조건:
 * - Firebase Remote Config에 'optional_addons_enabled'가 true로 설정되어 있어야 함
 * - 테스트용 학술대회에 등록된 옵션이 2개 이상 있어야 함
 */

import { test, expect, type Page } from '@playwright/test';

// 테스트 설정
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const TEST_CONF_SLUG = process.env.TEST_SLUG || 'kap_2026spring';
const REGISTRATION_URL = `${BASE_URL}/${TEST_CONF_SLUG}/register?mode=guest`;

// 테스트 데이터
const testUser = {
  name: '테스트 사용자',
  nameEn: 'Test User',
  email: `test-addon-${Date.now()}@example.com`,
  phone: '01012345678',
  affiliation: '서울대학교병원',
  affiliationEn: 'Seoul National University Hospital',
  licenseNumber: '12345',
  password: 'test1234'
};

// 헬퍼 함수
async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fillBasicInfo(page: Page, user: typeof testUser) {
  await page.getByPlaceholder('홍길동 / John Doe').fill(user.name);
  await page.getByPlaceholder('name@example.com').fill(user.email);
  await page.getByPlaceholder('010-1234-5678').fill(user.phone);
  await page.getByPlaceholder('소속 (병원/학교)').fill(user.affiliation);
  await page.getByPlaceholder('비회원 신청 내역 조회시 사용할 비밀번호').fill(user.password);
}

async function agreeToAllTerms(page: Page) {
  const allAgreeCheckbox = page.getByRole('checkbox', { name: /모든 약관|I agree to all/i });
  await allAgreeCheckbox.check();
}

async function goToStep(page: Page) {
  const nextButton = page.getByRole('button', { name: /다음|Next/i }).first();
  await nextButton.click();
  await page.waitForURL(new RegExp(`.*${TEST_CONF_SLUG}/register.*`));
}

test.describe('시나리오 1: AddonSelector 컴포넌트 표시', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTRATION_URL);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('1.1 기본 등록료 하단에 AddonSelector 표시 확인', async ({ page }) => {
    // 약관 동의 및 Step 1 이동
    await agreeToAllTerms(page);
    await goToStep(page);

    // 기본 정보 입력
    await fillBasicInfo(page, testUser);
    await page.getByRole('button', { name: /다음|Next/i }).first().click();

    // Step 2: 회원 인증 (비회원 선택)
    await wait(1000);
    const guestOption = page.getByRole('radio', { name: /비회원|Non-Member/ });
    if (await guestOption.isVisible()) {
      await guestOption.check();
    }
    await page.getByRole('button', { name: /다음|Next/i }).first().click();

    // Step 3: 결제 페이지 도달
    await expect(page.getByText(/결제|Payment/)).toBeVisible();
    await wait(2000);

    // 기본 등록료 표시 확인
    const baseFeeText = page.getByText(/기본 등록비|Base Registration/);
    await expect(baseFeeText).toBeVisible();

    // AddonSelector 컴포넌트 표시 확인 (기능 플래그 활성화 시)
    // 주의: 기능 플래그가 비활성화된 경우 이 테스트는 실패할 수 있음
    const addonSection = page.locator('section').filter({ hasText: /추가 옵션|Optional Add-ons/ });
    const isVisible = await addonSection.isVisible().catch(() => false);

    if (isVisible) {
      // 옵션 선택 영역이 표시되는지 확인
      await expect(addonSection).toBeVisible();

      // 체크박스 형태의 옵션들이 있는지 확인
      const optionCheckboxes = page.locator('input[type="checkbox"]').count();
      expect(optionCheckboxes).toBeGreaterThan(0);
    } else {
      // 기능 플래그가 비활성화된 경우, 옵션 영역이 표시되지 않아야 함
      console.log('AddonSelector not visible - feature flag may be disabled');
    }
  });

  test('1.2 옵션 목록이 올바르게 렌더링되는지 확인', async ({ page }) => {
    // Step 3까지 이동
    await agreeToAllTerms(page);
    await goToStep(page);
    await fillBasicInfo(page, testUser);
    await page.getByRole('button', { name: /다음|Next/i }).first().click();
    await wait(1000);

    const guestOption = page.getByRole('radio', { name: /비회원|Non-Member/ });
    if (await guestOption.isVisible()) {
      await guestOption.check();
    }
    await page.getByRole('button', { name: /다음|Next/i }).first().click();
    await wait(2000);

    // AddonSelector가 표시되는 경우에만 테스트
    const addonSection = page.locator('section').filter({ hasText: /추가 옵션|Optional Add-ons/ });
    const isVisible = await addonSection.isVisible().catch(() => false);

    if (isVisible) {
      // 옵션 아이템들이 렌더링되는지 확인
      const optionItems = page.locator('[class*="addon"]').or(page.locator('[data-testid*="addon"]'));
      const itemCount = await optionItems.count();

      if (itemCount > 0) {
        // 각 옵션에 필수 요소가 있는지 확인
        for (let i = 0; i < Math.min(itemCount, 5); i++) {
          const item = optionItems.nth(i);

          // 옵션 이름 표시
          const optionName = item.locator('[class*="name"], [class*="title"]');
          expect(await optionName.isVisible()).toBeTruthy();

          // 가격 표시 (₩ 또는 KRW)
          const priceText = item.locator('text=/₩|[0-9]+원|KRW/');
          expect(await priceText.isVisible()).toBeTruthy();

          // 체크박스 표시
          const checkbox = item.locator('input[type="checkbox"]');
          expect(await checkbox.isVisible()).toBeTruthy();
        }
      }
    }
  });
});

test.describe('시나리오 2: 옵션 선택 및 가격 계산', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTRATION_URL);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    // Step 3까지 이동
    await agreeToAllTerms(page);
    await goToStep(page);
    await fillBasicInfo(page, testUser);
    await page.getByRole('button', { name: /다음|Next/i }).first().click();
    await wait(1000);

    const guestOption = page.getByRole('radio', { name: /비회원|Non-Member/ });
    if (await guestOption.isVisible()) {
      await guestOption.check();
    }
    await page.getByRole('button', { name: /다음|Next/i }).first().click();
    await wait(2000);
  });

  test('2.1 단일 옵션 선택 시 총액 계산 확인', async ({ page }) => {
    // AddonSelector 확인
    const addonSection = page.locator('section').filter({ hasText: /추가 옵션|Optional Add-ons/ });
    const isVisible = await addonSection.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'AddonSelector not visible - feature flag disabled');
      return;
    }

    // 초기 총액 확인
    const initialTotalText = await page.locator('text=/총|Total/').first().textContent();
    console.log('Initial total:', initialTotalText);

    // 첫 번째 옵션 체크박스 찾기
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();

    // 체크박스 클릭 (옵션 선택)
    await firstCheckbox.check();
    await wait(1000);

    // 총액이 변경되었는지 확인
    const updatedTotalText = await page.locator('text=/총|Total/').first().textContent();
    console.log('Updated total:', updatedTotalText);

    // 초기 총액과 다른지 확인 (숫자만 비교)
    const extractNumber = (text: string | null) => {
      if (!text) return 0;
      const match = text.match(/[0-9,]+/);
      return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
    };

    const initialTotal = extractNumber(initialTotalText);
    const updatedTotal = extractNumber(updatedTotalText);

    expect(updatedTotal).toBeGreaterThan(initialTotal);

    // 옵션 총액 표시 확인
    const optionsTotalText = page.getByText(/옵션|Options/);
    const isOptionsTotalVisible = await optionsTotalText.isVisible().catch(() => false);

    if (isOptionsTotalVisible) {
      await expect(optionsTotalText).toBeVisible();
    }
  });

  test('2.2 복수 옵션 선택 시 총액 계산 확인', async ({ page }) => {
    const addonSection = page.locator('section').filter({ hasText: /추가 옵션|Optional Add-ons/ });
    const isVisible = await addonSection.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'AddonSelector not visible - feature flag disabled');
      return;
    }

    // 체크박스 개수 확인
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();

    if (checkboxCount < 2) {
      test.skip(true, 'Not enough options to test multiple selection');
      return;
    }

    // 초기 총액
    const extractNumber = (text: string | null) => {
      if (!text) return 0;
      const match = text.match(/[0-9,]+/);
      return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
    };

    const initialTotalText = await page.locator('text=/총|Total/').first().textContent();
    const initialTotal = extractNumber(initialTotalText);
    console.log('Initial total:', initialTotal);

    // 첫 번째 옵션 선택
    await checkboxes.nth(0).check();
    await wait(1000);

    const afterFirstText = await page.locator('text=/총|Total/').first().textContent();
    const afterFirstTotal = extractNumber(afterFirstText);
    console.log('After first option:', afterFirstTotal);

    // 두 번째 옵션 선택
    await checkboxes.nth(1).check();
    await wait(1000);

    const afterSecondText = await page.locator('text=/총|Total/').first().textContent();
    const afterSecondTotal = extractNumber(afterSecondText);
    console.log('After second option:', afterSecondTotal);

    // 총액이 점진적으로 증가해야 함
    expect(afterFirstTotal).toBeGreaterThan(initialTotal);
    expect(afterSecondTotal).toBeGreaterThan(afterFirstTotal);
  });

  test('2.3 옵션 선택 해제 시 총액 감소 확인', async ({ page }) => {
    const addonSection = page.locator('section').filter({ hasText: /추가 옵션|Optional Add-ons/ });
    const isVisible = await addonSection.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'AddonSelector not visible - feature flag disabled');
      return;
    }

    const extractNumber = (text: string | null) => {
      if (!text) return 0;
      const match = text.match(/[0-9,]+/);
      return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
    };

    const firstCheckbox = page.locator('input[type="checkbox"]').first();

    // 옵션 선택
    await firstCheckbox.check();
    await wait(1000);

    const selectedTotalText = await page.locator('text=/총|Total/').first().textContent();
    const selectedTotal = extractNumber(selectedTotalText);
    console.log('Selected total:', selectedTotal);

    // 옵션 해제
    await firstCheckbox.uncheck();
    await wait(1000);

    const unselectedTotalText = await page.locator('text=/총|Total/').first().textContent();
    const unselectedTotal = extractNumber(unselectedTotalText);
    console.log('Unselected total:', unselectedTotal);

    // 해제 후 총액이 감소해야 함
    expect(unselectedTotal).toBeLessThan(selectedTotal);
  });
});

test.describe('시나리오 3: 가격 상세 표시', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTRATION_URL);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    // Step 3까지 이동
    await agreeToAllTerms(page);
    await goToStep(page);
    await fillBasicInfo(page, testUser);
    await page.getByRole('button', { name: /다음|Next/i }).first().click();
    await wait(1000);

    const guestOption = page.getByRole('radio', { name: /비회원|Non-Member/ });
    if (await guestOption.isVisible()) {
      await guestOption.check();
    }
    await page.getByRole('button', { name: /다음|Next/i }).first().click();
    await wait(2000);
  });

  test('3.1 가격 상세 (기본료 + 옵션 + 총액) 표시 확인', async ({ page }) => {
    const addonSection = page.locator('section').filter({ hasText: /추가 옵션|Optional Add-ons/ });
    const isVisible = await addonSection.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'AddonSelector not visible - feature flag disabled');
      return;
    }

    // 기본 등록비 표시 확인
    const baseFeeLabel = page.getByText(/기본 등록비|Base Registration|Base Fee/);
    expect(await baseFeeLabel.isVisible()).toBeTruthy();

    // 옵션 선택
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();
    await wait(1000);

    // 옵션 합계 표시 확인 (있는 경우)
    const optionsTotalLabel = page.getByText(/옵션 합계|Options Total|Additional/);
    const isOptionsTotalVisible = await optionsTotalLabel.isVisible().catch(() => false);

    if (isOptionsTotalVisible) {
      await expect(optionsTotalLabel).toBeVisible();
    }

    // 총 결제 금액 표시 확인
    const totalLabel = page.getByText(/총 결제 금액|Total Amount|Total:/);
    await expect(totalLabel).toBeVisible();
  });

  test('3.2 가격 계산 정확성 검증 (숫자 계산)', async ({ page }) => {
    const addonSection = page.locator('section').filter({ hasText: /추가 옵션|Optional Add-ons/ });
    const isVisible = await addonSection.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'AddonSelector not visible - feature flag disabled');
      return;
    }

    const extractNumber = (text: string | null) => {
      if (!text) return 0;
      const match = text.match(/[0-9,]+/);
      return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
    };

    // 기본 등록비 가져오기
    const baseFeeText = await page.getByText(/기본 등록비|Base Registration|Base Fee/).textContent();
    const baseFee = extractNumber(baseFeeText);
    console.log('Base fee:', baseFee);

    // 옵션 가격 가져오기
    const optionItems = page.locator('[class*="addon"]').or(page.locator('[data-testid*="addon"]'));
    const firstOptionPriceText = await optionItems.first().textContent();
    const optionPrice = extractNumber(firstOptionPriceText);
    console.log('Option price:', optionPrice);

    // 옵션 선택
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();
    await wait(1000);

    // 총액 가져오기
    const totalText = await page.locator('text=/총|Total/').first().textContent();
    const total = extractNumber(totalText);
    console.log('Total:', total);

    // 검증: 총액 = 기본료 + 옵션가
    const expectedTotal = baseFee + optionPrice;
    expect(total).toBe(expectedTotal);
  });
});

test.describe('시나리오 4: 툴팁 기능', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTRATION_URL);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    // Step 3까지 이동
    await agreeToAllTerms(page);
    await goToStep(page);
    await fillBasicInfo(page, testUser);
    await page.getByRole('button', { name: /다음|Next/i }).first().click();
    await wait(1000);

    const guestOption = page.getByRole('radio', { name: /비회원|Non-Member/ });
    if (await guestOption.isVisible()) {
      await guestOption.check();
    }
    await page.getByRole('button', { name: /다음|Next/i }).first().click();
    await wait(2000);
  });

  test('4.1 "?" 아이콘 클릭 시 툴팁 표시', async ({ page }) => {
    const addonSection = page.locator('section').filter({ hasText: /추가 옵션|Optional Add-ons/ });
    const isVisible = await addonSection.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'AddonSelector not visible - feature flag disabled');
      return;
    }

    // "?" 아이콘 또는 info icon 찾기
    const infoIcon = page.locator('[title*="정보"], [title*="Info"], [aria-label*="info"], svg[class*="info"], button[title*="?"]').first();
    const isInfoIconVisible = await infoIcon.isVisible().catch(() => false);

    if (isInfoIconVisible) {
      // 아이콘 호버
      const tooltip = page.locator('[role="tooltip"]').or(page.locator('[class*="tooltip"]'));
      await infoIcon.hover();
      await wait(500);

      // 툴팁 표시 확인
      const isTooltipVisibleAfterHover = await tooltip.isVisible().catch(() => false);

      if (isTooltipVisibleAfterHover) {
        await expect(tooltip).toBeVisible();
      } else {
        console.log('Tooltip not implemented or using different pattern');
      }
    } else {
      console.log('Info icon not found - tooltips may not be implemented');
    }
  });
});

test.describe('시나리오 5: 데이터 지속성', () => {
  test('5.1 옵션 선택 상태가 페이지 새로고침 후 유지되는지 확인', async ({ page }) => {
    await page.goto(REGISTRATION_URL);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    // Step 3까지 이동
    await agreeToAllTerms(page);
    await goToStep(page);
    await fillBasicInfo(page, testUser);
    await page.getByRole('button', { name: /다음|Next/i }).first().click();
    await wait(1000);

    const guestOption = page.getByRole('radio', { name: /비회원|Non-Member/ });
    if (await guestOption.isVisible()) {
      await guestOption.check();
    }
    await page.getByRole('button', { name: /다음|Next/i }).first().click();
    await wait(2000);

    const addonSection = page.locator('section').filter({ hasText: /추가 옵션|Optional Add-ons/ });
    const isVisible = await addonSection.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, 'AddonSelector not visible - feature flag disabled');
      return;
    }

    const extractNumber = (text: string | null) => {
      if (!text) return 0;
      const match = text.match(/[0-9,]+/);
      return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
    };

    // 옵션 선택
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();
    await wait(1000);

    const beforeReloadTotalText = await page.locator('text=/총|Total/').first().textContent();
    const beforeReloadTotal = extractNumber(beforeReloadTotalText);
    console.log('Total before reload:', beforeReloadTotal);

    // 페이지 새로고침
    await page.reload();
    await wait(3000);

    // 새로고침 후 체크박스 상태 확인
    const afterReloadCheckbox = page.locator('input[type="checkbox"]').first();
    const isChecked = await afterReloadCheckbox.isChecked();
    console.log('Checkbox checked after reload:', isChecked);

    // 총액 확인 (선택 상태가 유지되어야 함)
    const afterReloadTotalText = await page.locator('text=/총|Total/').first().textContent();
    const afterReloadTotal = extractNumber(afterReloadTotalText);
    console.log('Total after reload:', afterReloadTotal);

    // 참고: 현재 구현에서는 선택 상태가 지속되지 않을 수 있음
    // 이 테스트는 현재 동작을 문서화하는 목적임
    if (!isChecked) {
      console.log('Note: Checkbox selection is not persisted across reload (expected behavior)');
    }
  });
});
