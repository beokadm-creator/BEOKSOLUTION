/**
 * pricing 테스트
 *
 * 목적: 등록료 계산 유틸리티 테스트
 * - getApplicablePrice: 활성 기간과 사용자 등급에 따른 가격 계산
 */

import { getApplicablePrice } from './pricing';
import { Timestamp } from 'firebase/firestore';
import type { RegistrationSettings, UserTier, RegistrationPeriod } from '../types/schema';

// Timestamp 헬퍼 함수
const createTimestamp = (seconds: number): Timestamp => {
  const timestamp = {
    seconds,
    nanoseconds: 0,
    type: 'seconds' as const,
    toDate: () => new Date(seconds * 1000),
    toMillis: () => seconds * 1000,
    isEqual: () => false,
    toJSON: () => ({ seconds, nanoseconds: 0 }),
  };
  return timestamp as unknown as Timestamp;
};

const createPeriod = (
  name: { ko: string; en?: string },
  startDateSeconds: number,
  endDateSeconds: number,
  prices: Partial<Record<UserTier, number>>
): RegistrationPeriod => ({
  name,
  type: 'EARLY',
  startDate: createTimestamp(startDateSeconds),
  endDate: createTimestamp(endDateSeconds),
  prices,
});

describe('pricing', () => {
  describe('getApplicablePrice', () => {
    // 기본 설정: 현재 시간 기준 (2024-01-15 00:00:00 UTC = 1705296000 seconds)
    const CURRENT_TIME = 1705296000;

    beforeEach(() => {
      // Timestamp.now()를 모킹
      jest.spyOn(Timestamp, 'now').mockReturnValue(createTimestamp(CURRENT_TIME));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('활성 기간이 없으면 0을 반환한다', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '지난 기간', en: 'Past Period' },
            CURRENT_TIME - 100000, // 과거
            CURRENT_TIME - 50000,  // 과거 (종료됨)
            { MEMBER: 100000 }
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'MEMBER');
      expect(result).toBe(0);
    });

    it('활성 기간의 가격을 반환한다 (MEMBER)', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '조기 등록', en: 'Early Bird' },
            CURRENT_TIME - 100000, // 과거 시작
            CURRENT_TIME + 100000,  // 미래 종료 (활성)
            { MEMBER: 100000, NON_MEMBER: 150000 }
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'MEMBER');
      expect(result).toBe(100000);
    });

    it('활성 기간의 가격을 반환한다 (NON_MEMBER)', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '조기 등록', en: 'Early Bird' },
            CURRENT_TIME - 100000,
            CURRENT_TIME + 100000,
            { MEMBER: 100000, NON_MEMBER: 150000 }
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'NON_MEMBER');
      expect(result).toBe(150000);
    });

    it('여러 기간 중 활성 기간을 찾는다', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '지난 조기 등록', en: 'Past Early' },
            CURRENT_TIME - 200000,
            CURRENT_TIME - 100000,
            { MEMBER: 80000 }
          ),
          createPeriod(
            { ko: '현재 일반 등록', en: 'Regular' },
            CURRENT_TIME - 50000,
            CURRENT_TIME + 50000,
            { MEMBER: 100000, NON_MEMBER: 150000 }
          ),
          createPeriod(
            { ko: '미래 현장 등록', en: 'Future Onsite' },
            CURRENT_TIME + 100000,
            CURRENT_TIME + 200000,
            { MEMBER: 120000 }
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'MEMBER');
      expect(result).toBe(100000); // 현재 활성 기간
    });

    it('해당 등급의 가격이 없으면 0을 반환한다', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '조기 등록', en: 'Early Bird' },
            CURRENT_TIME - 100000,
            CURRENT_TIME + 100000,
            { MEMBER: 100000 } // NON_MEMBER 없음
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'NON_MEMBER');
      expect(result).toBe(0);
    });

    it('VIP 등급 가격을 반환한다', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '조기 등록', en: 'Early Bird' },
            CURRENT_TIME - 100000,
            CURRENT_TIME + 100000,
            { VIP: 0 } // VIP 무료
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'VIP');
      expect(result).toBe(0);
    });

    it('STUDENT 등급 가격을 반환한다', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '조기 등록', en: 'Early Bird' },
            CURRENT_TIME - 100000,
            CURRENT_TIME + 100000,
            { STUDENT: 50000, MEMBER: 100000 }
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'STUDENT');
      expect(result).toBe(50000);
    });

    it('COMMITTEE 등급 가격을 반환한다', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '조기 등록', en: 'Early Bird' },
            CURRENT_TIME - 100000,
            CURRENT_TIME + 100000,
            { COMMITTEE: 0 } // 위원 무료
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'COMMITTEE');
      expect(result).toBe(0);
    });

    it('기간 경계에 있는 경우 (정확히 시작 시간)', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '조기 등록', en: 'Early Bird' },
            CURRENT_TIME, // 정확히 지금 시작
            CURRENT_TIME + 100000,
            { MEMBER: 100000 }
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'MEMBER');
      expect(result).toBe(100000);
    });

    it('기간 경계에 있는 경우 (정확히 종료 시간)', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '조기 등록', en: 'Early Bird' },
            CURRENT_TIME - 100000,
            CURRENT_TIME, // 정확히 지금 종료
            { MEMBER: 100000 }
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'MEMBER');
      expect(result).toBe(100000);
    });

    it('빈 기간 목록을 처리한다', () => {
      const settings: RegistrationSettings = {
        periods: [],
      };

      const result = getApplicablePrice(settings, 'MEMBER');
      expect(result).toBe(0);
    });

    it('0원 가격도 처리한다', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '무료 등록', en: 'Free' },
            CURRENT_TIME - 100000,
            CURRENT_TIME + 100000,
            { MEMBER: 0 }
          ),
        ],
      };

      const result = getApplicablePrice(settings, 'MEMBER');
      expect(result).toBe(0);
    });

    it('모든 등급에 가격이 있는 기간을 처리한다', () => {
      const settings: RegistrationSettings = {
        periods: [
          createPeriod(
            { ko: '전체 등록', en: 'All Tiers' },
            CURRENT_TIME - 100000,
            CURRENT_TIME + 100000,
            {
              MEMBER: 100000,
              NON_MEMBER: 150000,
              STUDENT: 50000,
              VIP: 0,
              COMMITTEE: 0,
            }
          ),
        ],
      };

      expect(getApplicablePrice(settings, 'MEMBER')).toBe(100000);
      expect(getApplicablePrice(settings, 'NON_MEMBER')).toBe(150000);
      expect(getApplicablePrice(settings, 'STUDENT')).toBe(50000);
      expect(getApplicablePrice(settings, 'VIP')).toBe(0);
      expect(getApplicablePrice(settings, 'COMMITTEE')).toBe(0);
    });
  });
});
