import { calculateStayTime } from './src/utils/attendance';
import { Timestamp } from 'firebase/firestore';

// Mock AccessLog type for testing (matching the schema)
interface MockAccessLog {
  id: string;
  action: 'ENTRY' | 'EXIT';
  timestamp: Timestamp;
  scannedQr: string;
  scannerId?: string;
  locationId?: string;
}

// Helper to create mock logs
const createLog = (hour: number, minute: number, action: 'ENTRY' | 'EXIT'): MockAccessLog => {
  const date = new Date(2026, 0, 20, hour, minute); // January 20, 2026
  const seconds = Math.floor(date.getTime() / 1000);
  return {
    id: `log_${seconds}`,
    action,
    timestamp: new Timestamp(seconds, 0),
    scannedQr: 'test_qr_code'
  };
};

// Test scenarios for KADD 2026 Spring attendance logic
describe('KADD 2026 Spring Attendance Logic Tests', () => {
  
  // 시나리오 1: 정상 출결 (09:00 입장, 18:00 퇴장)
  test('정상 출결 - 9시간 체류', () => {
    const logs: MockAccessLog[] = [
      createLog(9, 0, 'ENTRY'),
      createLog(18, 0, 'EXIT')
    ];
    
    const result = calculateStayTime(logs);
    expect(result).toBe(540); // 9시간 = 540분
  });

  // 시나리오 2: 결석 (로그 없음)
  test('결석 - 출결 로그 없음', () => {
    const logs: MockAccessLog[] = [];
    
    const result = calculateStayTime(logs);
    expect(result).toBe(0);
  });

  // 시나리오 3: 조퇴 (09:00 입장, 12:00 퇴장)
  test('조퇴 - 3시간만 체류', () => {
    const logs: MockAccessLog[] = [
      createLog(9, 0, 'ENTRY'),
      createLog(12, 0, 'EXIT')
    ];
    
    const result = calculateStayTime(logs);
    expect(result).toBe(180); // 3시간 = 180분
  });

  // 시나리오 4: 지각 (10:00 입장, 18:00 퇴장)
  test('지각 - 8시간 체류', () => {
    const logs: MockAccessLog[] = [
      createLog(10, 0, 'ENTRY'),
      createLog(18, 0, 'EXIT')
    ];
    
    const result = calculateStayTime(logs);
    expect(result).toBe(480); // 8시간 = 480분
  });

  // 시나리오 5: 외출 후 복귀 (09:00 입장, 12:00 외출, 14:00 복귀, 18:00 퇴장)
  test('외출 후 복귀 - 총 7시간 체류', () => {
    const logs: MockAccessLog[] = [
      createLog(9, 0, 'ENTRY'),
      createLog(12, 0, 'EXIT'),
      createLog(14, 0, 'ENTRY'),
      createLog(18, 0, 'EXIT')
    ];
    
    const result = calculateStayTime(logs);
    // 09:00-12:00 (3시간) + 14:00-18:00 (4시간) = 7시간
    expect(result).toBe(420);
  });

  // 시나리오 6: 점심시간 제외 테스트
  test('점심시간 제외 - 12:00-13:00 제외', () => {
    const logs: MockAccessLog[] = [
      createLog(9, 0, 'ENTRY'),
      createLog(18, 0, 'EXIT')
    ];
    
    const breakTimes = [
      { start: '12:00', end: '13:00' }
    ];
    
    const result = calculateStayTime(logs, breakTimes);
    // 9시간 - 1시간 점심시간 = 8시간
    expect(result).toBe(480);
  });

  // 시나리오 7: 휴식시간이 2개인 경우
  test('휴식시간 2개 제외 - 점심과 저녁시간', () => {
    const logs: MockAccessLog[] = [
      createLog(9, 0, 'ENTRY'),
      createLog(21, 0, 'EXIT')
    ];
    
    const breakTimes = [
      { start: '12:00', end: '13:00' }, // 점심
      { start: '18:00', end: '19:00' }  // 저녁
    ];
    
    const result = calculateStayTime(logs, breakTimes);
    // 12시간 - 1시간 점심 - 1시간 저녁 = 10시간
    expect(result).toBe(600);
  });

  // 시나리오 8: 미처리 퇴장 (sessionEnd로 처리)
  test('미처리 퇴장 - sessionEnd로 계산', () => {
    const logs: MockAccessLog[] = [
      createLog(9, 0, 'ENTRY')
      // EXIT 없음
    ];
    
    const sessionEnd = new Date(2026, 0, 20, 18, 0); // 18:00
    
    const result = calculateStayTime(logs, [], sessionEnd);
    expect(result).toBe(540); // 9시간
  });

  // 시나리오 9: 휴식시간과 부분 겹침
  test('휴식시간과 부분 겹침', () => {
    const logs: MockAccessLog[] = [
      createLog(11, 30, 'ENTRY'),
      createLog(14, 30, 'EXIT')
    ];
    
    const breakTimes = [
      { start: '12:00', end: '13:00' }
    ];
    
    const result = calculateStayTime(logs, breakTimes);
    // 3시간 - 1시간 겹침 = 2시간
    expect(result).toBe(120);
  });

  // 시나리오 10: 중복 입장 로그 처리
  test('중복 입장 로그 - 마지막 입장만 유효', () => {
    const logs: MockAccessLog[] = [
      createLog(9, 0, 'ENTRY'),
      createLog(9, 30, 'ENTRY'), // 중복 입장
      createLog(18, 0, 'EXIT')
    ];
    
    const result = calculateStayTime(logs);
    // 첫 ENTRY만 처리되고 두번째 ENTRY는 무시됨
    expect(result).toBe(540); // 9시간
  });

  // 시나리오 11: 중복 퇴장 로그 처리
  test('중복 퇴장 로그 - 첫 퇴장만 유효', () => {
    const logs: MockAccessLog[] = [
      createLog(9, 0, 'ENTRY'),
      createLog(17, 0, 'EXIT'),  // 첫 퇴장
      createLog(18, 0, 'EXIT')   // 중복 퇴장 (무시됨)
    ];
    
    const result = calculateStayTime(logs);
    // 8시간만 계산됨
    expect(result).toBe(480);
  });

  // 시나리오 12: 복잡한 일정 (휴식 2개 + 외출)
  test('복잡한 일정 - 휴식시간 2개 + 외출', () => {
    const logs: MockAccessLog[] = [
      createLog(8, 30, 'ENTRY'),   // 조기 입장
      createLog(11, 0, 'EXIT'),    // 외출
      createLog(11, 30, 'ENTRY'),  // 복귀
      createLog(21, 30, 'EXIT')    // 늦은 퇴장
    ];
    
    const breakTimes = [
      { start: '12:00', end: '13:00' }, // 점심
      { start: '18:00', end: '18:30' }  // 저녁 휴식
    ];
    
    const result = calculateStayTime(logs, breakTimes);
    
    // 08:30-11:00 (2.5시간) + 11:30-21:30 (10시간) = 12.5시간
    // 점심시간 1시간, 저녁휴식 0.5시간 제외 = 11시간
    expect(result).toBe(660); // 11시간 = 660분
  });
});

// 경계값 테스트
describe('Edge Cases and Error Handling', () => {
  
  test('빈 로그 배열', () => {
    const result = calculateStayTime([]);
    expect(result).toBe(0);
  });

  test('퇴장만 있는 경우', () => {
    const logs: MockAccessLog[] = [
      createLog(18, 0, 'EXIT')
    ];
    
    const result = calculateStayTime(logs);
    expect(result).toBe(0); // 입장 없음
  });

  test('입장만 있고 sessionEnd도 없는 경우', () => {
    const logs: MockAccessLog[] = [
      createLog(9, 0, 'ENTRY')
    ];
    
    const result = calculateStayTime(logs);
    expect(result).toBe(0); // sessionEnd 없으면 계산 안됨
  });

  test('sessionEnd가 입장보다 이른 경우', () => {
    const logs: MockAccessLog[] = [
      createLog(18, 0, 'ENTRY')
    ];
    
    const sessionEnd = new Date(2026, 0, 20, 17, 0); // 입장보다 이른 시간
    
    const result = calculateStayTime(logs, [], sessionEnd);
    expect(result).toBe(0);
  });

  test('휴식시간이 체류시간을 완전히 포함하는 경우', () => {
    const logs: MockAccessLog[] = [
      createLog(12, 30, 'ENTRY'),
      createLog(12, 45, 'EXIT')
    ];
    
    const breakTimes = [
      { start: '12:00', end: '13:00' }
    ];
    
    const result = calculateStayTime(logs, breakTimes);
    expect(result).toBe(0); // 전부 휴식시간에 포함됨
  });
});