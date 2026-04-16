// verify-attendance.ts
function testAttendanceLogic() {
    // 1. 3일차 단일 구역 설정 (Firestore에 저장될 설정과 동일하게 구성)
    const rule = {
        start: "09:00",
        end: "17:00",
        breaks: [
            { label: "점심시간", start: "12:00", end: "13:00" } // 1시간(60분) 차감
        ],
        goalMinutes: 240, // 수료 기준 시간 (예: 4시간 = 240분)
        completionMode: 'DAILY_SEPARATE' // 단일 구역 처리 모드
    };

    // 2. 테스트할 출입 시간 세팅 (KST 기준)
    const dateStr = "2026-05-15"; // 임의의 3일차 날짜
    
    const testCases = [
        {
            name: "정상 수강자 (시작 전 입장 ~ 종료 후 퇴장)",
            checkIn: new Date(`${dateStr}T08:50:00+09:00`), // 08:50 입장 (09:00부터 인정)
            checkOut: new Date(`${dateStr}T17:10:00+09:00`)  // 17:10 퇴장 (17:00까지만 인정)
        },
        {
            name: "지각/조퇴자 (기준 미달)",
            checkIn: new Date(`${dateStr}T10:00:00+09:00`), // 10:00 입장
            checkOut: new Date(`${dateStr}T14:00:00+09:00`)  // 14:00 퇴장 (총 4시간 체류 - 점심 1시간 = 3시간 인정)
        },
        {
            name: "딱 맞춰 수강한 자 (오후반)",
            checkIn: new Date(`${dateStr}T13:00:00+09:00`), // 13:00 입장 (점심 이후)
            checkOut: new Date(`${dateStr}T17:00:00+09:00`)  // 17:00 퇴장
        }
    ];

    console.log(`\n======================================================`);
    console.log(`🎯 [3일차 단일 구역 수강완료 시뮬레이션]`);
    console.log(`- 운영 시간: ${rule.start} ~ ${rule.end}`);
    console.log(`- 휴게 시간: ${rule.breaks.map(b => `${b.label}(${b.start}~${b.end})`).join(', ')}`);
    console.log(`- 수료 목표: ${rule.goalMinutes}분`);
    console.log(`======================================================\n`);

    // 3. 실제 로직 적용 검증
    testCases.forEach((tc, index) => {
        let bS = tc.checkIn;
        let bE = tc.checkOut;

        // [로직 1] 구역 운영 시간으로 Bound 처리
        const zoneStart = new Date(`${dateStr}T${rule.start}:00+09:00`);
        const zoneEnd = new Date(`${dateStr}T${rule.end}:00+09:00`);

        bS = new Date(Math.max(bS.getTime(), zoneStart.getTime()));
        bE = new Date(Math.min(bE.getTime(), zoneEnd.getTime()));

        let rawDuration = 0;
        let deduction = 0;
        let recognizedMinutes = 0;

        if (bE > bS) {
            rawDuration = Math.floor((bE.getTime() - bS.getTime()) / 60000);

            // [로직 2] 휴게시간(Break) 차감
            rule.breaks.forEach(brk => {
                const breakStart = new Date(`${dateStr}T${brk.start}:00+09:00`);
                const breakEnd = new Date(`${dateStr}T${brk.end}:00+09:00`);

                const overlapStart = Math.max(bS.getTime(), breakStart.getTime());
                const overlapEnd = Math.min(bE.getTime(), breakEnd.getTime());

                if (overlapEnd > overlapStart) {
                    deduction += Math.floor((overlapEnd - overlapStart) / 60000);
                }
            });

            // [로직 3] 최종 인정 시간
            recognizedMinutes = Math.max(0, rawDuration - deduction);
        }

        // [로직 4] 수료 여부 판정 (isCompleted)
        const isCompleted = recognizedMinutes >= rule.goalMinutes;

        console.log(`[Test Case ${index + 1}] ${tc.name}`);
        console.log(`  입장: ${tc.checkIn.toLocaleTimeString('ko-KR')} / 퇴장: ${tc.checkOut.toLocaleTimeString('ko-KR')}`);
        console.log(`  ▶ 유효 체류(Bound 적용): ${rawDuration}분`);
        console.log(`  ▶ 휴게 시간 차감: -${deduction}분`);
        console.log(`  ▶ 최종 인정 시간: ${recognizedMinutes}분`);
        console.log(`  ▶ 수료 여부: ${isCompleted ? '✅ 수료 (isCompleted: true)' : '❌ 미수료'}\n`);
    });
}

testAttendanceLogic();