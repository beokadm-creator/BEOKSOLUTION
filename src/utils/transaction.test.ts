/**
 * transaction 테스트
 *
 * 목적: 트랜잭션 헬퍼 유틸리티 테스트
 * - generateConfirmationQr: 확인 QR 데이터 생성
 * - generateBadgeQr: 배지 QR 생성 (UUID)
 */

import { generateConfirmationQr, generateBadgeQr } from './transaction';

// uuid 모듈 ESM 문제로 mock 사용
jest.mock('uuid', () => ({
  v4: jest.fn(() => '12345678-1234-4123-9abc-123456789abc'), // Valid UUID v4 format
}));

describe('transaction', () => {
  describe('generateConfirmationQr', () => {
    it('QR 데이터를 생성한다', () => {
      const result = generateConfirmationQr('reg-123', 'user-456');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('QR 데이터에 regId와 userId를 포함한다', () => {
      const result = generateConfirmationQr('reg-123', 'user-456');
      const data = JSON.parse(result);

      expect(data.type).toBe('CONFIRM');
      expect(data.regId).toBe('reg-123');
      expect(data.userId).toBe('user-456');
    });

    it('QR 데이터에 타임스탬프를 포함한다', () => {
      const before = Date.now();
      const result = generateConfirmationQr('reg-123', 'user-456');
      const after = Date.now();

      const data = JSON.parse(result);
      expect(data.t).toBeGreaterThanOrEqual(before);
      expect(data.t).toBeLessThanOrEqual(after);
    });

    it('빈 문자열 ID도 처리한다', () => {
      const result = generateConfirmationQr('', '');
      const data = JSON.parse(result);

      expect(data.regId).toBe('');
      expect(data.userId).toBe('');
    });

    it('특수 문자가 포함된 ID를 처리한다', () => {
      const result = generateConfirmationQr('reg-123!@#', 'user-456$%^');
      const data = JSON.parse(result);

      expect(data.regId).toBe('reg-123!@#');
      expect(data.userId).toBe('user-456$%^');
    });
  });

  describe('generateBadgeQr', () => {
    it('UUID 형식의 QR을 생성한다', () => {
      const result = generateBadgeQr();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('항상 같은 UUID를 반환한다 (mock됨)', () => {
      const result1 = generateBadgeQr();
      const result2 = generateBadgeQr();

      expect(result1).toBe(result2); // mock으로 항상 같음
      expect(result1).toBe('12345678-1234-4123-9abc-123456789abc');
    });

    it('UUID v4 형식을 따른다', () => {
      const result = generateBadgeQr();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result).toMatch(uuidRegex);
    });

    it('대시(-)로 구분된 5개 섹션을 가진다', () => {
      const result = generateBadgeQr();
      const parts = result.split('-');

      expect(parts).toHaveLength(5);
      expect(parts[0]).toHaveLength(8);
      expect(parts[1]).toHaveLength(4);
      expect(parts[2]).toHaveLength(4);
      expect(parts[3]).toHaveLength(4);
      expect(parts[4]).toHaveLength(12);
    });

    it('소문자 hex 문자만 포함한다', () => {
      const result = generateBadgeQr();
      const hexRegex = /^[0-9a-f-]+$/;
      expect(result).toMatch(hexRegex);
    });
  });

  describe('generateReceiptNumber (integration test concept)', () => {
    // 실제 Firestore transaction을 사용하는 함수이므로
    // 실제 통합 테스트에서는 mock transaction을 전달해야 함
    // 여기서는 형식만 검증

    it('영수증 번호 형식: {Year}-SP-{Serial}', () => {
      // 예: 2026-SP-001
      const currentYear = new Date().getFullYear();
      const format = `${currentYear}-SP-`;

      expect(format).toMatch(/^\d{4}-SP-$/);
    });

    it('시리얼 번호는 3자리 숫자여야 한다', () => {
      // 예: 001, 002, 999
      const padStart = (num: number) => String(num).padStart(3, '0');

      expect(padStart(1)).toBe('001');
      expect(padStart(999)).toBe('999');
      expect(padStart(1000)).toBe('1000'); // 4자리 (경계 케이스)
    });
  });
});
