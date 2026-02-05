/**
 * whitelist 테스트
 *
 * 목적: 화이트리스트 검증 유틸리티 테스트
 * - validateWhitelist: 인증 코드로 화이트리스트 검증
 * - markWhitelistUsed: 화이트리스트 사용 처리
 */

import { validateWhitelist, markWhitelistUsed } from './whitelist';
import type { Whitelist } from '../types/schema';

// Firestore 모킹 (setup.ts에서 이미 처리됨)
jest.mock('firebase/firestore', () => {
  const mockTimestamp = { seconds: Math.floor(Date.now() / 1000), toMillis: () => Date.now() };
  return {
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(),
    doc: jest.fn(),
    updateDoc: jest.fn(),
    Timestamp: {
      now: jest.fn(() => mockTimestamp),
    },
  };
});

import { getDocs, doc, updateDoc } from 'firebase/firestore';

describe('whitelist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateWhitelist', () => {
    it('유효한 화이트리스트를 확인한다 (MEMBER)', async () => {
      const mockWhitelist: Whitelist = {
        id: 'wl-123',
        name: '홍길동',
        authCode: 'CODE123',
        tier: 'MEMBER',
        isUsed: false,
      };

      // Mock getDocs response
      (getDocs as jest.Mock).mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'wl-123',
            data: () => mockWhitelist,
          },
        ],
      });

      const result = await validateWhitelist('kap_2026spring', '홍길동', 'CODE123');

      expect(result.isValid).toBe(true);
      expect(result.tier).toBe('MEMBER');
      expect(result.whitelistId).toBe('wl-123');
    });

    it('유효한 화이트리스트를 확인한다 (NON_MEMBER)', async () => {
      const mockWhitelist: Whitelist = {
        id: 'wl-456',
        name: '김철수',
        authCode: 'CODE456',
        tier: 'NON_MEMBER',
        isUsed: false,
      };

      (getDocs as jest.Mock).mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'wl-456',
            data: () => mockWhitelist,
          },
        ],
      });

      const result = await validateWhitelist('kap_2026spring', '김철수', 'CODE456');

      expect(result.isValid).toBe(true);
      expect(result.tier).toBe('NON_MEMBER');
    });

    it('존재하지 않는 인증 코드면 유효하지 않다', async () => {
      (getDocs as jest.Mock).mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await validateWhitelist('kap_2026spring', '홍길동', 'INVALID');

      expect(result.isValid).toBe(false);
      expect(result.tier).toBeUndefined();
      expect(result.whitelistId).toBeUndefined();
    });

    it('이름이 일치하지 않으면 유효하지 않다', async () => {
      const mockWhitelist: Whitelist = {
        id: 'wl-123',
        name: '홍길동',
        authCode: 'CODE123',
        tier: 'MEMBER',
        isUsed: false,
      };

      (getDocs as jest.Mock).mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'wl-123',
            data: () => mockWhitelist,
          },
        ],
      });

      const result = await validateWhitelist('kap_2026spring', '김철수', 'CODE123'); // 이름 불일치

      expect(result.isValid).toBe(false);
    });

    it('이미 사용된 화이트리스트면 유효하지 않다', async () => {
      const mockWhitelist: Whitelist = {
        id: 'wl-123',
        name: '홍길동',
        authCode: 'CODE123',
        tier: 'MEMBER',
        isUsed: true, // 이미 사용됨
        usedBy: 'user-123',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        usedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
      };

      (getDocs as jest.Mock).mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'wl-123',
            data: () => mockWhitelist,
          },
        ],
      });

      const result = await validateWhitelist('kap_2026spring', '홍길동', 'CODE123');

      expect(result.isValid).toBe(false);
    });

    it('VIP 등급 화이트리스트를 확인한다', async () => {
      const mockWhitelist: Whitelist = {
        id: 'wl-789',
        name: '박명희',
        authCode: 'VIP789',
        tier: 'VIP',
        isUsed: false,
      };

      (getDocs as jest.Mock).mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'wl-789',
            data: () => mockWhitelist,
          },
        ],
      });

      const result = await validateWhitelist('kap_2026spring', '박명희', 'VIP789');

      expect(result.isValid).toBe(true);
      expect(result.tier).toBe('VIP');
    });

    it('STUDENT 등급 화이트리스트를 확인한다', async () => {
      const mockWhitelist: Whitelist = {
        id: 'wl-101',
        name: '학생A',
        authCode: 'STUDENT101',
        tier: 'STUDENT',
        isUsed: false,
      };

      (getDocs as jest.Mock).mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'wl-101',
            data: () => mockWhitelist,
          },
        ],
      });

      const result = await validateWhitelist('kap_2026spring', '학생A', 'STUDENT101');

      expect(result.isValid).toBe(true);
      expect(result.tier).toBe('STUDENT');
    });

    it('빈 인증 코드를 처리한다', async () => {
      const result = await validateWhitelist('kap_2026spring', '홍길동', '');

      // Firestore query가 실행되고, empty가 반환됨
      expect(result.isValid).toBe(false);
    });
  });

  describe('markWhitelistUsed', () => {
    it('화이트리스트를 사용됨으로 표시한다', async () => {
      const mockDocRef = { id: 'wl-123' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await markWhitelistUsed('kap_2026spring', 'wl-123', 'user-456');

      expect(doc).toHaveBeenCalledWith(expect.anything(), 'conferences/kap_2026spring/whitelists/wl-123');
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          isUsed: true,
          usedBy: 'user-456',
        })
      );
    });

    it('다른 사용자 ID로도 처리한다', async () => {
      const mockDocRef = { id: 'wl-456' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await markWhitelistUsed('kap_2026spring', 'wl-456', 'user-789');

      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          usedBy: 'user-789',
        })
      );
    });

    it('다른 컨퍼런스 ID로도 처리한다', async () => {
      const mockDocRef = { id: 'wl-123' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await markWhitelistUsed('kadd_2026spring', 'wl-123', 'user-456');

      expect(doc).toHaveBeenCalledWith(expect.anything(), 'conferences/kadd_2026spring/whitelists/wl-123');
    });
  });
});
