/**
 * attendance.ts 단위 테스트
 * calculateStayTime 함수 테스트
 */

import { calculateStayTime } from './attendance';
import type { AccessLog } from '../types/schema';

describe('calculateStayTime', () => {
  // Helper to create timestamp for specific local time (hours, minutes)
  const createLocalTimestamp = (hours: number, minutes: number): number => {
    const now = new Date();
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0
    );
    return Math.floor(target.getTime() / 1000);
  };

  // Helper to create access log with proper Timestamp mock
  const createLog = (action: 'ENTRY' | 'EXIT', seconds: number, id: string = 'test-qr'): AccessLog => ({
    id: `log-${seconds}`,
    action,
    timestamp: {
      seconds,
      nanoseconds: 0,
      toMillis: () => seconds * 1000,
      toDate: () => new Date(seconds * 1000),
      isEqual: () => false,
      toJSON: () => ({ seconds, nanoseconds: 0, type: 'seconds' }),
      valueOf: () => String(seconds),
    },
    scannedQr: id,
  });

  describe('기본 동작', () => {
    it('빈 배열은 0을 반환한다', () => {
      const result = calculateStayTime([]);
      expect(result).toBe(0);
    });

    it('null 입력은 0을 반환한다', () => {
      const result = calculateStayTime(null as unknown as AccessLog[]);
      expect(result).toBe(0);
    });

    it('undefined 입력은 0을 반환한다', () => {
      const result = calculateStayTime(undefined as unknown as AccessLog[]);
      expect(result).toBe(0);
    });
  });

  describe('체류 시간 계산', () => {
    it('단일 ENTRY-EXIT 쌍의 체류 시간을 계산한다', () => {
      // 9:00 ENTRY (32400s) - 10:00 EXIT (36000s) = 60 minutes
      const baseTime = Math.floor(Date.now() / 1000);
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime),
        createLog('EXIT', baseTime + 3600), // +60 minutes
      ];

      const result = calculateStayTime(logs);
      expect(result).toBe(60);
    });

    it('여러 ENTRY-EXIT 쌍의 총 체류 시간을 계산한다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime),            // 9:00 ENTRY
        createLog('EXIT', baseTime + 1800),      // 9:30 EXIT (30 min)
        createLog('ENTRY', baseTime + 3600),     // 10:00 ENTRY
        createLog('EXIT', baseTime + 5400),      // 10:30 EXIT (30 min)
      ];

      const result = calculateStayTime(logs);
      expect(result).toBe(60); // 30 + 30 minutes
    });

    it('결과는 소수점 이하를 버린 정수이다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime),
        createLog('EXIT', baseTime + 3630), // 60.5 minutes
      ];

      const result = calculateStayTime(logs);
      expect(result).toBe(60); // Should floor to 60
    });
  });

  describe('EXIT 없는 ENTRY 처리', () => {
    it('EXIT 없는 ENTRY는 sessionEnd가 있으면 sessionEnd까지 계산한다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime), // ENTRY만 있음
      ];

      const sessionEnd = new Date((baseTime + 1800) * 1000); // +30 minutes
      const result = calculateStayTime(logs, [], sessionEnd);

      expect(result).toBe(30);
    });

    it('EXIT 없는 ENTRY는 sessionEnd가 없으면 무시된다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime), // ENTRY만 있음
      ];

      const result = calculateStayTime(logs);
      expect(result).toBe(0); // sessionEnd가 없으면 계산하지 않음
    });

    it('ENTRY 없는 EXIT는 무시된다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const logs: AccessLog[] = [
        createLog('EXIT', baseTime), // EXIT만 있음
      ];

      const result = calculateStayTime(logs);
      expect(result).toBe(0);
    });
  });

  describe('휴게 시간 공제', () => {
    it('휴게 시간을 공제한다', () => {
      const entryTime = createLocalTimestamp(9, 0);   // 9:00 AM local
      const exitTime = createLocalTimestamp(11, 0);    // 11:00 AM local

      // 9:00 ENTRY - 11:00 EXIT (120 minutes total)
      // Break: 10:00-10:30 (30 minutes)
      // Expected: 120 - 30 = 90 minutes
      const logs: AccessLog[] = [
        createLog('ENTRY', entryTime),             // 9:00
        createLog('EXIT', exitTime),               // 11:00 (120 min)
      ];

      const breakTimes = [
        { start: '10:00', end: '10:30' },
      ];

      const result = calculateStayTime(logs, breakTimes);
      expect(result).toBe(90); // 120 - 30 = 90
    });

    it('휴게 시간이 체류 시간과 겹치지 않으면 공제하지 않는다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      // 9:00 ENTRY - 10:00 EXIT (60 minutes)
      // Break: 11:00-12:00 (no overlap)
      // Expected: 60 minutes (no deduction)
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime),             // 9:00
        createLog('EXIT', baseTime + 3600),       // 10:00
      ];

      const breakTimes = [
        { start: '11:00', end: '12:00' },
      ];

      const result = calculateStayTime(logs, breakTimes);
      expect(result).toBe(60); // No overlap, no deduction
    });

    it('여러 휴게 시간을 모두 공제한다', () => {
      const entryTime = createLocalTimestamp(9, 0);   // 9:00 AM local
      const exitTime = createLocalTimestamp(13, 0);    // 1:00 PM local

      // 9:00 ENTRY - 13:00 EXIT (240 minutes total)
      // Break 1: 10:00-10:30 (30 minutes)
      // Break 2: 12:00-12:30 (30 minutes)
      // Expected: 240 - 60 = 180 minutes
      const logs: AccessLog[] = [
        createLog('ENTRY', entryTime),           // 9:00
        createLog('EXIT', exitTime),             // 13:00 (240 min)
      ];

      const breakTimes = [
        { start: '10:00', end: '10:30' },
        { start: '12:00', end: '12:30' },
      ];

      const result = calculateStayTime(logs, breakTimes);
      expect(result).toBe(180); // 240 - 60 = 180
    });
  });

  describe('sessionStart/sessionEnd 보정', () => {
    it('sessionStart가 있으면 ENTRY 시간을 sessionStart로 보정한다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const sessionStart = new Date((baseTime + 600) * 1000); // 9:10

      // Log says 9:00 ENTRY, but sessionStart is 9:10
      // 9:10 (corrected) - 10:00 EXIT = 50 minutes
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime),             // 9:00 (before sessionStart)
        createLog('EXIT', baseTime + 3600),       // 10:00
      ];

      const result = calculateStayTime(logs, [], undefined, sessionStart);
      expect(result).toBe(50); // From 9:10 to 10:00 = 50 minutes
    });

    it('sessionEnd가 있으면 EXIT 시간을 sessionEnd로 보정한다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const sessionEnd = new Date((baseTime + 3000) * 1000); // 9:50

      // 9:00 ENTRY - 10:00 EXIT (log)
      // But sessionEnd is 9:50, so: 9:00 - 9:50 = 50 minutes
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime),             // 9:00
        createLog('EXIT', baseTime + 3600),       // 10:00 (after sessionEnd)
      ];

      const result = calculateStayTime(logs, [], sessionEnd);
      expect(result).toBe(50); // From 9:00 to 9:50 = 50 minutes
    });

    it('sessionStart와 sessionEnd를 모두 적용한다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const sessionStart = new Date((baseTime + 600) * 1000);  // 9:10
      const sessionEnd = new Date((baseTime + 3000) * 1000);   // 9:50

      // Log: 9:00 ENTRY - 10:00 EXIT (60 min)
      // Corrected: 9:10 - 9:50 = 40 minutes
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime),             // 9:00 (before sessionStart)
        createLog('EXIT', baseTime + 3600),       // 10:00 (after sessionEnd)
      ];

      const result = calculateStayTime(logs, [], sessionEnd, sessionStart);
      expect(result).toBe(40); // From 9:10 to 9:50 = 40 minutes
    });
  });

  describe('로그 정렬', () => {
    it('로그가 시간순이 아니어도 정렬하여 처리한다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      // Logs in reverse order
      const logs: AccessLog[] = [
        createLog('EXIT', baseTime + 5400),       // 10:30 (first in array)
        createLog('ENTRY', baseTime + 3600),      // 10:00
        createLog('EXIT', baseTime + 1800),       // 9:30
        createLog('ENTRY', baseTime),             // 9:00 (last in array)
      ];

      const result = calculateStayTime(logs);
      expect(result).toBe(60); // (9:00-9:30) + (10:00-10:30) = 30 + 30 = 60
    });
  });

  describe('복합 시나리오', () => {
    it('복잡한 시나리오: 정렬 + sessionStart/sessionEnd 보정', () => {
      const entryTime = createLocalTimestamp(9, 0);    // 9:00 AM local
      const exitTime1 = createLocalTimestamp(10, 30);  // 10:30 AM local
      const exitTime2 = createLocalTimestamp(11, 30);  // 11:30 AM local

      const sessionStart = new Date();
      sessionStart.setHours(9, 10, 0, 0);  // 9:10 AM local
      const sessionEnd = new Date();
      sessionEnd.setHours(11, 0, 0, 0);    // 11:00 AM local

      // Logs out of order:
      // 9:00 ENTRY -> corrected to 9:10
      // 10:30 EXIT (first valid exit after entry)
      // 11:30 EXIT -> corrected to 11:00 (no matching entry, ignored)
      // Expected: (9:10-10:30) = 80 minutes
      const logs: AccessLog[] = [
        createLog('EXIT', exitTime1),              // 10:30
        createLog('ENTRY', entryTime),             // 9:00 (before sessionStart)
        createLog('EXIT', exitTime2),              // 11:30 (after sessionEnd)
      ];

      const result = calculateStayTime(logs, [], sessionEnd, sessionStart);
      // 9:10 to 10:30 = 80 minutes
      expect(result).toBe(80);
    });

    it('연속된 ENTRY 로그는 마지막 것만 유효하다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      // Multiple ENTRYs in a row, then EXIT
      // Only first ENTRY should be used
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime, 'qr1'),      // 9:00 (should be used)
        createLog('ENTRY', baseTime + 600, 'qr2'), // 9:10 (ignored)
        createLog('EXIT', baseTime + 3600),       // 10:00
      ];

      const result = calculateStayTime(logs);
      expect(result).toBe(60); // 9:00 to 10:00 = 60 min
    });

    it('체류 시간이 음수가 되면 0을 반환한다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const sessionStart = new Date((baseTime + 3600) * 1000); // 10:00

      // ENTRY at 9:00, but sessionStart is 10:00
      // EXIT at 9:30, which is before sessionStart
      // Result should be 0 (invalid segment)
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime),             // 9:00
        createLog('EXIT', baseTime + 1800),       // 9:30
      ];

      const result = calculateStayTime(logs, [], undefined, sessionStart);
      expect(result).toBe(0);
    });
  });

  describe('엣지 케이스', () => {
    it('ENTRY와 EXIT 시간이 같으면 0을 반환한다', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const logs: AccessLog[] = [
        createLog('ENTRY', baseTime),
        createLog('EXIT', baseTime), // Same time
      ];

      const result = calculateStayTime(logs);
      expect(result).toBe(0);
    });

    it('EXIT가 ENTRY보다 빠르면 무시한다 (정렬 후 처리)', () => {
      const baseTime = Math.floor(Date.now() / 1000);
      const logs: AccessLog[] = [
        createLog('EXIT', baseTime + 1800),       // 9:30
        createLog('ENTRY', baseTime + 3600),      // 10:00 (ENTRY after EXIT = ignored)
      ];

      const result = calculateStayTime(logs);
      expect(result).toBe(0);
    });

    it('휴게 시간이 전체 기간을 커버하면 0을 반환한다', () => {
      const entryTime = createLocalTimestamp(9, 0);   // 9:00 AM local
      const exitTime = createLocalTimestamp(10, 0);    // 10:00 AM local

      // 9:00 ENTRY - 10:00 EXIT (60 minutes)
      // Break: 9:00-10:00 (entire period)
      // Expected: 60 - 60 = 0
      const logs: AccessLog[] = [
        createLog('ENTRY', entryTime),           // 9:00
        createLog('EXIT', exitTime),             // 10:00
      ];

      const breakTimes = [
        { start: '09:00', end: '10:00' },
      ];

      const result = calculateStayTime(logs, breakTimes);
      expect(result).toBe(0);
    });
  });
});
