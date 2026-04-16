import { calculateRecognizedMinutes, ZoneConfig } from './attendance';

describe('Kiosk AUTO Mode & Time Calculation Verification', () => {

    const testZoneConfig: ZoneConfig = {
        start: '09:00',
        end: '18:00',
        breaks: [
            { start: '12:00', end: '13:00' }
        ],
        ruleDate: '2026-04-12'
    };

    test('시나리오 1: 정상 누적 - 오전 9시 입장, 오후 6시 퇴장 (점심시간 제외)', () => {
        const lastCheckIn = new Date('2026-04-12T09:00:00+09:00');
        const exitTime = new Date('2026-04-12T18:00:00+09:00');
        const recognizedMinutes = calculateRecognizedMinutes(lastCheckIn, exitTime, testZoneConfig);
        expect(recognizedMinutes).toBe(480);
    });

    test('시나리오 2: Zone Switch 로직 검증 (AUTO 모드 시 다른 키오스크 스캔)', () => {
        const roomA_CheckIn = new Date('2026-04-12T09:00:00+09:00');
        const roomB_ScanTime = new Date('2026-04-12T11:30:00+09:00');
        const roomA_Recognized = calculateRecognizedMinutes(roomA_CheckIn, roomB_ScanTime, testZoneConfig);
        expect(roomA_Recognized).toBe(150);

        const roomB_ExitTime = new Date('2026-04-12T15:00:00+09:00');
        const roomB_Recognized = calculateRecognizedMinutes(roomB_ScanTime, roomB_ExitTime, testZoneConfig);
        expect(roomB_Recognized).toBe(150);
        expect(roomA_Recognized + roomB_Recognized).toBe(300);
    });

    test('시나리오 3: UTC 버그 픽스 검증 (KST 오전 8시 이전 입장 시 날짜 꼬임 해결)', () => {
        const earlyCheckIn = new Date('2026-04-12T08:30:00+09:00');
        const exitTime = new Date('2026-04-12T10:00:00+09:00');
        const dynamicZoneConfig: ZoneConfig = { start: '09:00', end: '18:00', breaks: [] };
        const recognizedMinutes = calculateRecognizedMinutes(earlyCheckIn, exitTime, dynamicZoneConfig);
        expect(recognizedMinutes).toBe(60);
    });

    test('시나리오 4: 퇴장 시간이 Zone 운영 시간 이후일 때 (자동/수동 퇴장)', () => {
        const checkIn = new Date('2026-04-12T16:00:00+09:00');
        const lateExit = new Date('2026-04-12T19:30:00+09:00');
        const recognizedMinutes = calculateRecognizedMinutes(checkIn, lateExit, testZoneConfig);
        expect(recognizedMinutes).toBe(120);
    });

    test('시나리오 5: 휴게 시간(Break) 교차 입장/퇴장 (M5 보강)', () => {
        // 12:30 에 입장, 14:00 에 퇴장. 휴게시간(12:00~13:00) 내에서 30분이 겹침
        const checkIn = new Date('2026-04-12T12:30:00+09:00');
        const exitTime = new Date('2026-04-12T14:00:00+09:00');
        const recognizedMinutes = calculateRecognizedMinutes(checkIn, exitTime, testZoneConfig);
        // 총 90분 중 휴게시간에 겹친 30분(12:30~13:00)이 차감되어 60분이 인정되어야 함
        expect(recognizedMinutes).toBe(60);
    });

    test('시나리오 6: 운영 시간 시작 전 입장하고 운영 시간 전에 퇴장할 때 (M5 보강)', () => {
        const checkIn = new Date('2026-04-12T08:00:00+09:00');
        const exitTime = new Date('2026-04-12T08:50:00+09:00');
        const recognizedMinutes = calculateRecognizedMinutes(checkIn, exitTime, testZoneConfig);
        // Zone 시작이 09:00 이므로 0분 인정
        expect(recognizedMinutes).toBe(0);
    });

    test('시나리오 7: 반복 입장/퇴장 시 시간 누적이 과도하게 증가하지 않는다 (KST/UTC 9시간 버그 회귀 방지)', () => {
        const checkIn1 = new Date('2026-04-12T09:00:00+09:00');
        const exit1 = new Date('2026-04-12T09:01:00+09:00');
        const m1 = calculateRecognizedMinutes(checkIn1, exit1, testZoneConfig);
        expect(m1).toBe(1);

        const checkIn2 = new Date('2026-04-12T09:02:00+09:00');
        const exit2 = new Date('2026-04-12T09:03:00+09:00');
        const m2 = calculateRecognizedMinutes(checkIn2, exit2, testZoneConfig);
        expect(m2).toBe(1);

        expect(m1 + m2).toBe(2);
    });
});
