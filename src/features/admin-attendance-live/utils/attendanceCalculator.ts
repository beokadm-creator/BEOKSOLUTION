import { ZoneRule } from '../types';

interface CalculateResult {
    durationMinutes: number;
    deduction: number;
    finalMinutes: number;
}

export function calculateAttendanceMinutes(
    checkInTime: Date,
    checkOutTime: Date,
    zoneRule: ZoneRule | undefined,
    selectedDate: string
): CalculateResult {
    let durationMinutes = 0;
    let deduction = 0;
    let boundedStart = checkInTime;
    let boundedEnd = checkOutTime;

    if (zoneRule && zoneRule.start && zoneRule.end) {
        const sessionStart = new Date(`${selectedDate}T${zoneRule.start}:00+09:00`);
        const sessionEnd = new Date(`${selectedDate}T${zoneRule.end}:00+09:00`);

        boundedStart = new Date(Math.max(checkInTime.getTime(), sessionStart.getTime()));
        boundedEnd = new Date(Math.min(checkOutTime.getTime(), sessionEnd.getTime()));
    }

    if (boundedEnd > boundedStart) {
        durationMinutes = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);

        if (zoneRule && zoneRule.breaks) {
            zoneRule.breaks.forEach(brk => {
                const breakStart = new Date(`${selectedDate}T${brk.start}:00+09:00`);
                const breakEnd = new Date(`${selectedDate}T${brk.end}:00+09:00`);
                const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
                const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
                if (overlapEnd > overlapStart) {
                    const overlapMins = Math.floor((overlapEnd - overlapStart) / 60000);
                    deduction += overlapMins;
                }
            });
        }
    }

    return {
        durationMinutes,
        deduction,
        finalMinutes: Math.max(0, durationMinutes - deduction)
    };
}
