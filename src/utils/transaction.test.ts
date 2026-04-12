/**
 * transaction 테스트
 *
 * 목적: 트랜잭션 헬퍼 유틸리티 테스트
 * - generateConfirmationQr: 확인 QR 데이터 생성
 * - generateBadgeQr: 배지 QR 생성 (UUID)
 * - generateReceiptNumber: 영수증 번호 생성 (Firestore transaction)
 */

import { generateConfirmationQr, generateBadgeQr, generateReceiptNumber } from './transaction';

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

  describe('generateReceiptNumber', () => {
    const conferenceId = 'test-conf-123';
    const currentYear = new Date().getFullYear();

    it('receiptConfig가 있으면 올바른 영수증 번호를 반환한다', async () => {
      const mockTransaction = {
        get: jest.fn().mockReturnValue({
          exists: jest.fn(() => true),
          data: jest.fn(() => ({
            receiptConfig: { nextSerialNo: 1 }
          }))
        }),
        update: jest.fn()
      };

      const result = await generateReceiptNumber(conferenceId, mockTransaction);

      expect(result).toBe(`${currentYear}-SP-001`);
      expect(mockTransaction.get).toHaveBeenCalledTimes(1);
      expect(mockTransaction.update).toHaveBeenCalledTimes(1);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        undefined,
        { 'receiptConfig.nextSerialNo': 2 }
      );
    });

    it('시리얼 번호가 증가하면 올바르게 포맷팅한다 (001, 010, 999)', async () => {
      const testCases = [
        { serial: 1, expected: '001' },
        { serial: 10, expected: '010' },
        { serial: 999, expected: '999' }
      ];

      for (const { serial, expected } of testCases) {
        const mockTransaction = {
          get: jest.fn().mockReturnValue({
            exists: jest.fn(() => true),
            data: jest.fn(() => ({
              receiptConfig: { nextSerialNo: serial }
            }))
          }),
          update: jest.fn()
        };

        const result = await generateReceiptNumber(conferenceId, mockTransaction);

        expect(result).toBe(`${currentYear}-SP-${expected}`);
        expect(mockTransaction.update).toHaveBeenCalledWith(
          undefined,
          { 'receiptConfig.nextSerialNo': serial + 1 }
        );
      }
    });

    it('config 문서가 없으면 에러를 throw한다', async () => {
      const mockTransaction = {
        get: jest.fn().mockReturnValue({
          exists: jest.fn(() => false),
          data: jest.fn()
        }),
        update: jest.fn()
      };

      await expect(
        generateReceiptNumber(conferenceId, mockTransaction)
      ).rejects.toThrow('Config not found');

      expect(mockTransaction.update).not.toHaveBeenCalled();
    });

    it('receiptConfig.nextSerialNo가 없으면 기본값 1을 사용한다', async () => {
      const mockTransaction = {
        get: jest.fn().mockReturnValue({
          exists: jest.fn(() => true),
          data: jest.fn(() => ({
            receiptConfig: {}
          }))
        }),
        update: jest.fn()
      };

      const result = await generateReceiptNumber(conferenceId, mockTransaction);

      expect(result).toBe(`${currentYear}-SP-001`);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        undefined,
        { 'receiptConfig.nextSerialNo': 2 }
      );
    });

    it('receiptConfig가 없으면 기본값 1을 사용한다', async () => {
      const mockTransaction = {
        get: jest.fn().mockReturnValue({
          exists: jest.fn(() => true),
          data: jest.fn(() => ({}))
        }),
        update: jest.fn()
      };

      const result = await generateReceiptNumber(conferenceId, mockTransaction);

      expect(result).toBe(`${currentYear}-SP-001`);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        undefined,
        { 'receiptConfig.nextSerialNo': 2 }
      );
    });

    it('transaction.update가 올바른 경로와 값으로 호출되는지 확인한다', async () => {
      const mockTransaction = {
        get: jest.fn().mockReturnValue({
          exists: jest.fn(() => true),
          data: jest.fn(() => ({
            receiptConfig: { nextSerialNo: 5 }
          }))
        }),
        update: jest.fn()
      };

      await generateReceiptNumber(conferenceId, mockTransaction);

      expect(mockTransaction.update).toHaveBeenCalledTimes(1);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        undefined,
        { 'receiptConfig.nextSerialNo': 6 }
      );
    });

    it('올바른 형식의 영수증 번호를 생성한다', async () => {
      const mockTransaction = {
        get: jest.fn().mockReturnValue({
          exists: jest.fn(() => true),
          data: jest.fn(() => ({
            receiptConfig: { nextSerialNo: 42 }
          }))
        }),
        update: jest.fn()
      };

      const result = await generateReceiptNumber(conferenceId, mockTransaction);

      const receiptPattern = /^\d{4}-SP-\d{3}$/;
      expect(result).toMatch(receiptPattern);
      expect(result).toContain(`${currentYear}-SP-`);
    });
  });
});
