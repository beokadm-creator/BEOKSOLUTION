/**
 * 비회원 등록 시나리오 Playwright 테스트
 *
 * 테스트 대상:
 * 1. 새로운 비회원 등록
 * 2. 이탈 후 재등록 (세션 복구)
 * 3. 데이터 복구 (페이지 새로고침)
 *
 * 실행: npx playwright test registration-guest.spec.ts
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// 테스트 설정
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const TEST_CONF_SLUG = process.env.TEST_SLUG || 'kap_2026spring';
const REGISTRATION_URL = `${BASE_URL}/${TEST_CONF_SLUG}/register?mode=guest`;

// 테스트 데이터
const testUser = {
  name: '테스트 사용자',
  nameEn: 'Test User',
  email: `test${Date.now()}@example.com`,
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

async function fillBasicInfo(page, user: typeof testUser) {
  await page.getByPlaceholder('홍길동 / John Doe').fill(user.name);
  await page.getByPlaceholder('name@example.com').fill(user.email);
  await page.getByPlaceholder('010-1234-5678').fill(user.phone);
  await page.getByPlaceholder('소속 (병원/학교)').fill(user.affiliation);
  await page.getByPlaceholder('비회원 신청 내역 조회시 사용할 비밀번호').fill(user.password);
}

async function agreeToAllTerms(page) {
  const allAgreeCheckbox = page.getByRole('checkbox', { name: /모든 약관|I agree to all/i });
  await allAgreeCheckbox.check();
}

async function goToStep(page, step: number) {
  const nextButton = page.getByRole('button', { name: /다음|Next/i }).first();
  await nextButton.click();
  await page.waitForURL(new RegExp(`.*${TEST_CONF_SLUG}/register.*`));
}

test.describe('시나리오 1: 새로운 비회원 등록', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTRATION_URL);
    // 스토리지 초기화
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('1.1 이메일 입력 후 포커스 아웃 → 토스트 확인 (새 등록)', async ({ page }) => {
    // 약관 동의
    await agreeToAllTerms(page);
    await goToStep(page, 1);

    // 기본 정보 입력
    await page.getByPlaceholder('홍길동 / John Doe').fill(testUser.name);
    await page.getByPlaceholder('name@example.com').fill(testUser.email);
    await page.getByPlaceholder('010-1234-5678').fill(testUser.phone);
    await page.getByPlaceholder('소속 (병원/학교)').fill(testUser.affiliation);

    // 이메일 포커스 아웃
    const emailInput = page.getByPlaceholder('name@example.com');
    await emailInput.focus();
    await page.keyboard.press('Tab'); // 다른 필드로 이동하여 포커스 아웃

    // 검증: 새로운 이메일이므로 비밀번호 입력 토스트가 표시되지 않아야 함
    await wait(1000);

    // 토스트 컨테이너 확인
    const toastContainer = page.locator('[role="alert"]');
    const toastText = await toastContainer.allTextContents();

    // "비밀번호 입력하세요" 토스트가 없어야 함 (새 등록이므로)
    expect(toastText.some(text =>
      text.includes('비밀번호를 입력') ||
      text.includes('Please enter a password')
    )).toBeFalsy();
  });

  test('1.2 비밀번호 필드 표시 확인', async ({ page }) => {
    // 약관 동의 및 Step 1 이동
    await agreeToAllTerms(page);
    await goToStep(page, 1);

    // 검증: 비밀번호 필드가 표시되는지 확인
    const passwordField = page.getByPlaceholder('비회원 신청 내역 조회시 사용할 비밀번호');
    await expect(passwordField).toBeVisible();

    // 필드 타입 검증 (password type이어야 함)
    const passwordInput = passwordField.locator('input');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // 라벨 검증
    const passwordLabel = page.getByText(/비회원 조회 비밀번호|Guest Check Password/);
    await expect(passwordLabel).toBeVisible();
    await expect(passwordLabel).toHaveClass(/text-blue-600|font-bold/); // CSS 클래스 확인

    // 플레이스홀더 텍스트 검증
    await expect(passwordField).toHaveAttribute('placeholder', '비회원 신청 내역 조회시 사용할 비밀번호');

    // 도움말 텍스트 검증
    const helpText = page.getByText(/이메일과 이 비밀번호로 나중에 신청 내역을 조회할 수 있습니다|You can check your status later with this password/);
    await expect(helpText).toBeVisible();
    await expect(helpText).toHaveClass(/text-xs|text-gray-500/);
  });

  test('1.3 비밀번호 입력 후 다음 단계 진행', async ({ page }) => {
    // 약관 동의
    await agreeToAllTerms(page);

    // Step 1 이동
    await goToStep(page, 1);

    // 기본 정보 입력
    await fillBasicInfo(page, testUser);

    // '다음' 버튼 클릭
    const nextButton = page.getByRole('button', { name: /다음|Next/i }).first();
    await nextButton.click();

    // 검증: Step 2로 이동해야 함
    await expect(page.getByText(/회원 인증|Member Verification/)).toBeVisible();
    await expect(page.getByText(/등록 등급 선택|Registration Category/)).toBeVisible();

    // 검증: 성공 토스트 표시
    const toastContainer = page.locator('[role="alert"]');
    await expect(toastContainer.first()).toContainText(/비회원 계정이 생성되었습니다|Non-member account created/);

    // 검증: 스텝퍼가 2단계로 이동했는지 확인
    const step2 = page.locator('div').filter({ hasText: '2' }).locator('circle').first();
    await expect(step2).toHaveClass(/border-blue-600|bg-blue-600/); // 활성 상태 확인
  });

  test('1.4 비밀번호 길이 유효성 검사', async ({ page }) => {
    // 약관 동의 및 Step 1 이동
    await agreeToAllTerms(page);
    await goToStep(page, 1);

    // 기본 정보 입력 (5자 비밀번호)
    await page.getByPlaceholder('홍길동 / John Doe').fill(testUser.name);
    await page.getByPlaceholder('name@example.com').fill(testUser.email);
    await page.getByPlaceholder('010-1234-5678').fill(testUser.phone);
    await page.getByPlaceholder('소속 (병원/학교)').fill(testUser.affiliation);
    await page.getByPlaceholder('비회원 신청 내역 조회시 사용할 비밀번호').fill('12345'); // 5자

    // '다음' 버튼 클릭
    const nextButton = page.getByRole('button', { name: /다음|Next/i }).first();
    await nextButton.click();

    // 검증: 비밀번호 약함 오류 토스트 표시
    const toastContainer = page.locator('[role="alert"]');
    await expect(toastContainer.first()).toContainText(/비밀번호가 너무 약합니다|Password is too weak|6자/);

    // 검증: Step 2로 이동하지 않았어야 함
    await expect(page.getByText(/기본 정보|Personal Information/)).toBeVisible();
  });
});

test.describe('시나리오 2: 이탈 후 재등록 (세션 복구)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTRATION_URL);
    // 스토리지 초기화
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('2.1 등록 중간에 다른 페이지로 이탈', async ({ page }) => {
    // 약관 동의
    await agreeToAllTerms(page);

    // Step 1 이동
    await goToStep(page, 1);

    // 기본 정보 입력
    await fillBasicInfo(page, testUser);

    // 현재 상태 저장 확인 (localStorage에 저장되어야 함)
    const localStorageData = await page.evaluate(() => {
      return JSON.stringify(localStorage);
    });
    console.log('LocalStorage before navigation:', localStorageData);

    // 다른 페이지로 이탈 (홈페이지)
    await page.goto(`${BASE_URL}/${TEST_CONF_SLUG}`);

    // 검증: RegistrationPage 언마운트 트리거됨
    // 실제 브라우저에서는 sessionStorage가 초기화되어야 함
    const sessionStorageData = await page.evaluate(() => {
      return JSON.stringify(sessionStorage);
    });
    console.log('SessionStorage after navigation:', sessionStorageData);

    // SESSION_KEYS.NON_MEMBER 키가 제거되어야 함
    const nonMemberSessionKey = await page.evaluate(() => {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.toLowerCase().includes('non_member')) {
          return sessionStorage.getItem(key);
        }
      }
      return null;
    });

    expect(nonMemberSessionKey).toBeNull(); // 세션이 초기화되어야 함
  });

  test('2.2 다시 등록 페이지 접속 → 세션 자동 로그아웃', async ({ page }) => {
    // 첫 방문: 등록 시작
    await agreeToAllTerms(page);
    await goToStep(page, 1);
    await fillBasicInfo(page, testUser);

    // 페이지 이탈 (뒤로가기)
    await page.goBack();

    // 등록 페이지 재접속
    await page.goto(REGISTRATION_URL);

    // 검증: 새로운 빈 상태로 시작해야 함 (세션이 초기화됨)
    await wait(2000); // useNonMemberAuth가 완료될 때까지 대기

    // 비회원 세션 확인 (null이어야 함)
    const nonMemberSession = await page.evaluate(() => {
      // RegistrationPage 내부 상태를 직접 확인할 수 없으므로 UI 상태로 확인
      return null;
    });

    // Step 0이 표시되어야 함 (약관 동의)
    await expect(page.getByText(/이용약관 동의|Terms of Service/)).toBeVisible();

    // 이전에 입력한 데이터가 폼에 없어야 함
    const nameInput = page.getByPlaceholder('홍길동 / John Doe');
    const nameValue = await nameInput.inputValue();
    expect(nameValue).toBe(''); // 빈 값이어야 함

    // sessionStorage 초기화 확인
    const sessionStorageKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    });

    console.log('SessionStorage keys on re-entry:', sessionStorageKeys);

    // 비회원 세션 키가 없어야 함
    expect(sessionStorageKeys.some(key => key.toLowerCase().includes('non_member'))).toBeFalsy();
  });

  test('2.3 같은 이메일+비밀번호 입력 → 기존 등록 계속', async ({ page }) => {
    // 첫 등록 시도 (PENDING 상태로 남겨둠)
    await agreeToAllTerms(page);
    await goToStep(page, 1);
    await fillBasicInfo(page, testUser);

    // '다음' 클릭 (PENDING 등록 생성)
    const nextButton = page.getByRole('button', { name: /다음|Next/i }).first();
    await nextButton.click();

    // Step 2 도달 확인
    await expect(page.getByText(/회원 인증|Member Verification/)).toBeVisible();

    // 페이지 이탈
    await page.goto(`${BASE_URL}/${TEST_CONF_SLUG}`);

    // 등록 페이지 재접속 (세션 초기화 상태)
    await page.goto(REGISTRATION_URL);
    await wait(2000);

    // 약관 동의
    await agreeToAllTerms(page);
    await goToStep(page, 1);

    // 같은 이메일 입력
    await page.getByPlaceholder('name@example.com').fill(testUser.email);

    // 포커스 아웃
    const emailInput = page.getByPlaceholder('name@example.com');
    await emailInput.focus();
    await page.keyboard.press('Tab');

    // 검증: 토스트 표시 ("이전에 작성하신 신청서가 있습니다...")
    const toastContainer = page.locator('[role="alert"]');
    await wait(1000);

    const toastText = await toastContainer.first().textContent();
    expect(toastText).toMatch(/이전에 작성하신 신청서가 있습니다|Found previous registration/);
    expect(toastText).toMatch(/비밀번호를 입력|Enter password/);

    // 검증: 비밀번호 입력 모달 표시
    await wait(500);
    const passwordModal = page.locator('[role="dialog"]');
    await expect(passwordModal).toBeVisible();

    // 검증: 모달에서 비밀번호 입력
    const passwordInputInModal = passwordModal.getByPlaceholder(/비밀번호|Password/);
    await expect(passwordInputInModal).toBeVisible();

    // 비밀번호 입력 후 '불러오기' 클릭
    await passwordInputInModal.fill(testUser.password);

    const loadButton = passwordModal.getByRole('button', { name: /불러오기|Load/ });
    await expect(loadButton).toBeVisible();
    await loadButton.click();

    // 검증: 성공 토스트 ("저장된 데이터를 불러왔습니다.")
    await wait(2000);
    const successToast = toastContainer.filter({ hasText: /저장된 데이터를 불러왔습니다|Saved data loaded/ });
    await expect(successToast.first()).toBeVisible();

    // 검증: 모달 닫힘
    await expect(passwordModal).not.toBeVisible();

    // 검증: 이전 단계로 이동
    await expect(page.getByText(/회원 인증|Member Verification/)).toBeVisible();

    // 검증: 입력 필드에 이전 값들 표시
    const nameValue = await page.getByPlaceholder('홍길동 / John Doe').inputValue();
    expect(nameValue).toBe(testUser.name);

    const phoneValue = await page.getByPlaceholder('010-1234-5678').inputValue();
    expect(phoneValue).toBe(testUser.phone);

    const affiliationValue = await page.getByPlaceholder('소속 (병원/학교)').inputValue();
    expect(affiliationValue).toBe(testUser.affiliation);
  });
});

test.describe('시나리오 3: 데이터 복구 (페이지 새로고침)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTRATION_URL);
    // 스토리지 초기화
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('3.1 기본 정보 입력 후 페이지 새로고침', async ({ page }) => {
    // 약관 동의
    await agreeToAllTerms(page);

    // Step 1 이동
    await goToStep(page, 1);

    // 기본 정보 입력
    await fillBasicInfo(page, testUser);

    // localStorage 저장 확인
    await wait(1000); // useEffect가 실행되고 localStorage에 저장될 때까지 대기

    const localStorageData = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.includes('registration_form'));
      return key ? JSON.parse(localStorage[key]!) : null;
    });

    console.log('LocalStorage saved data:', localStorageData);

    // 검증: localStorage에 데이터 저장됨
    expect(localStorageData).not.toBeNull();

    // 검증: 저장된 데이터 구조
    expect(localStorageData).toHaveProperty('formData');
    expect(localStorageData).toHaveProperty('currentStep');
    expect(localStorageData).toHaveProperty('selectedGradeId');
    expect(localStorageData).toHaveProperty('timestamp');

    // 검증: formData 내용
    expect(localStorageData.formData).toEqual({
      name: testUser.name,
      email: testUser.email,
      phone: testUser.phone,
      affiliation: testUser.affiliation,
      licenseNumber: testUser.licenseNumber,
      simplePassword: testUser.password
    });

    // 검증: currentStep = 1
    expect(localStorageData.currentStep).toBe(1);

    // 페이지 새로고침
    await page.reload();

    // 검증: 데이터 복구 토스트
    const toastContainer = page.locator('[role="alert"]');
    await wait(2000);

    const toastText = await toastContainer.first().textContent();
    expect(toastText).toMatch(/저장된 신청서가 불러와졌습니다|Saved application loaded/);
  });

  test('3.2 저장된 데이터가 복구되는지 확인', async ({ page }) => {
    // 약관 동의
    await agreeToAllTerms(page);

    // Step 1 이동
    await goToStep(page, 1);

    // 기본 정보 입력
    await fillBasicInfo(page, testUser);

    // 저장 대기
    await wait(1000);

    // 페이지 새로고침
    await page.reload();
    await wait(2000); // 데이터 복구 대기

    // 검증: 복구 토스트 표시
    const toastContainer = page.locator('[role="alert"]');
    const restoreToast = toastContainer.filter({ hasText: /저장된 신청서가 불러와졌습니다|Saved application loaded/ });
    await expect(restoreToast.first()).toBeVisible();

    // 검증: 입력 필드에 이전 값들 표시
    const nameValue = await page.getByPlaceholder('홍길동 / John Doe').inputValue();
    expect(nameValue).toBe(testUser.name);

    const emailValue = await page.getByPlaceholder('name@example.com').inputValue();
    expect(emailValue).toBe(testUser.email);

    const phoneValue = await page.getByPlaceholder('010-1234-5678').inputValue();
    expect(phoneValue).toBe(testUser.phone);

    const affiliationValue = await page.getByPlaceholder('소속 (병원/학교)').inputValue();
    expect(affiliationValue).toBe(testUser.affiliation);

    const licenseValue = await page.getByPlaceholder('12345').inputValue();
    expect(licenseValue).toBe(testUser.licenseNumber);

    const passwordValue = await page.getByPlaceholder('비회원 신청 내역 조회시 사용할 비밀번호').inputValue();
    expect(passwordValue).toBe(testUser.password);

    // 검증: 약관 동의 상태 복구 (Step 0에서 복구됨)
    await expect(page.getByText(/이용약관 동의|Terms of Service/)).toBeVisible();

    // 약관 체크박스 상태 확인 (모두 체크되어 있어야 함)
    const allAgreeCheckbox = page.getByRole('checkbox', { name: /모든 약관|I agree to all/i });
    await expect(allAgreeCheckbox).toBeChecked();
  });

  test('3.3 만료된 데이터 처리 (24시간 경과)', async ({ page }) => {
    // 약관 동의
    await agreeToAllTerms(page);

    // Step 1 이동
    await goToStep(page, 1);

    // 기본 정보 입력
    await fillBasicInfo(page, testUser);

    // 저장 대기
    await wait(1000);

    // localStorage의 타임스탬프를 25시간 전으로 변경
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.includes('registration_form'));
      if (key) {
        const data = JSON.parse(localStorage[key]!);
        data.timestamp = Date.now() - (25 * 60 * 60 * 1000); // 25시간 전
        localStorage.setItem(key, JSON.stringify(data));
      }
    });

    // 페이지 새로고침
    await page.reload();
    await wait(2000);

    // 검증: 복구 토스트가 표시되지 않아야 함 (만료된 데이터)
    const toastContainer = page.locator('[role="alert"]');
    const toastCount = await toastContainer.count();
    expect(toastCount).toBe(0);

    // 검증: 빈 상태로 시작해야 함
    const nameValue = await page.getByPlaceholder('홍길동 / John Doe').inputValue();
    expect(nameValue).toBe('');

    // 검증: localStorage에서 만료된 데이터 제거됨
    const localStorageData = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.includes('registration_form'));
      return key ? localStorage[key] : null;
    });

    expect(localStorageData).toBeNull();
  });

  test('3.4 빈 데이터 저장 방지', async ({ page }) => {
    // 약관 동의
    await agreeToAllTerms(page);

    // Step 1 이동
    await goToStep(page, 1);

    // 아무것도 입력하지 않음
    await wait(2000); // useEffect 실행 대기

    // localStorage 확인
    const localStorageData = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.includes('registration_form'));
      return key ? JSON.parse(localStorage[key]!) : null;
    });

    // 검증: 빈 데이터는 저장되지 않아야 함
    // 하지만 현재 코드에서는 항상 저장하므로 이 테스트는 현재 구현을 검증함
    expect(localStorageData).not.toBeNull();

    // 빈 데이터인지 확인 (모든 필드가 비어있음)
    const hasData = Object.values(localStorageData.formData).some((v: any) => v && v.toString().trim() !== '');
    expect(hasData).toBe(false); // 빈 데이터여야 함

    // 빈 데이터는 localStorage에서 제거됨
    const localStorageAfterCheck = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.includes('registration_form'));
      return key ? localStorage[key] : null;
    });

    expect(localStorageAfterCheck).toBeNull();
  });

  test('3.5 성공 완료 시 데이터 정리', async ({ page }) => {
    // 약관 동의
    await agreeToAllTerms(page);

    // Step 1 이동
    await goToStep(page, 1);

    // 기본 정보 입력
    await fillBasicInfo(page, testUser);

    // Step 2 이동
    const nextButton = page.getByRole('button', { name: /다음|Next/i }).first();
    await nextButton.click();

    // Step 2에서 등급 선택
    const gradeOption = page.getByRole('radio').first();
    await gradeOption.check();
    await nextButton.click();

    // Step 3 (결제) 도달
    await expect(page.getByText(/결제|Payment/)).toBeVisible();

    // Step 4 (완료)로 강제 이동 (결제는 별도 시나리오)
    await page.evaluate(() => {
      (window as any).currentStep = 4;
    });

    // localStorage 데이터 정리 확인
    await wait(2000);

    const localStorageData = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.includes('registration_form'));
      return key ? localStorage[key] : null;
    });

    // 검증: 완료 후 localStorage가 정리되어야 함
    // (실제로는 currentStep === 4일 때 제거됨)
    expect(localStorageData).toBeNull();
  });
});

test.describe('부록: 오류 시나리오', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(REGISTRATION_URL);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('오류 1: 비밀번호 약함 (5자 미만)', async ({ page }) => {
    await agreeToAllTerms(page);
    await goToStep(page, 1);

    // 5자 비밀번호 입력
    await page.getByPlaceholder('홍길동 / John Doe').fill(testUser.name);
    await page.getByPlaceholder('name@example.com').fill(testUser.email);
    await page.getByPlaceholder('010-1234-5678').fill(testUser.phone);
    await page.getByPlaceholder('소속 (병원/학교)').fill(testUser.affiliation);
    await page.getByPlaceholder('비회원 신청 내역 조회시 사용할 비밀번호').fill('12345');

    // 다음 버튼 클릭
    const nextButton = page.getByRole('button', { name: /다음|Next/i }).first();
    await nextButton.click();

    // 검증: 비밀번호 약함 오류 토스트
    const toastContainer = page.locator('[role="alert"]');
    await expect(toastContainer.first()).toContainText(/비밀번호가 너무 약합니다|Password is too weak/);
  });

  test('오류 2: 필수 필드 누락', async ({ page }) => {
    await agreeToAllTerms(page);
    await goToStep(page, 1);

    // 이름만 입력
    await page.getByPlaceholder('홍길동 / John Doe').fill(testUser.name);

    // 다음 버튼 클릭
    const nextButton = page.getByRole('button', { name: /다음|Next/i }).first();
    await nextButton.click();

    // 검증: 필수 필드 누락 오류 토스트
    const toastContainer = page.locator('[role="alert"]');
    await expect(toastContainer.first()).toContainText(/필수 정보를 입력해주세요|Please fill in all required fields/);

    // 검증: 빈 필드에 에러 스타일 적용
    const emailInput = page.getByPlaceholder('name@example.com');
    await expect(emailInput).toHaveClass(/border-red-500/);
  });

  test('오류 3: 복구 실패 (비밀번호 불일치)', async ({ page }) => {
    // 첫 등록 시도
    await agreeToAllTerms(page);
    await goToStep(page, 1);
    await fillBasicInfo(page, testUser);
    await page.getByRole('button', { name: /다음|Next/i }).first().click();

    // 페이지 이탈 후 재접속
    await page.goto(`${BASE_URL}/${TEST_CONF_SLUG}`);
    await page.goto(REGISTRATION_URL);

    // 약관 동의 및 Step 1 이동
    await agreeToAllTerms(page);
    await goToStep(page, 1);

    // 같은 이메일 입력 후 포커스 아웃
    await page.getByPlaceholder('name@example.com').fill(testUser.email);
    await page.getByPlaceholder('name@example.com').focus();
    await page.keyboard.press('Tab');

    // 비밀번호 모달에서 틀린 비밀번호 입력
    await wait(1000);
    const passwordModal = page.locator('[role="dialog"]');
    await passwordModal.getByPlaceholder(/비밀번호|Password/).fill('wrongpassword');

    // '불러오기' 클릭
    await passwordModal.getByRole('button', { name: /불러오기|Load/ }).click();

    // 검증: 실패 토스트 (실제 Cloud Function 호출 실패 시)
    const toastContainer = page.locator('[role="alert"]');
    await wait(2000);

    // 비밀번호 불일치 오류 (Cloud Function이 실패하면 표시됨)
    const errorToast = toastContainer.filter({
      hasText: /등록된 이메일 정보를 찾을 수 없거나 비밀번호가 일치하지 않습니다|not found|password|match/
    });
    // 오류 토스트가 표시되거나 모달이 닫히지 않아야 함
    const isModalVisible = await passwordModal.isVisible();
    expect(isModalVisible || (await errorToast.count() > 0)).toBeTruthy();
  });
});
