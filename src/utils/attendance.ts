import { AccessLog } from '../types/schema';
import { getKstToday } from './dateUtils';

// Helper to calculate duration in minutes
export const calculateStayTime = (
    logs: AccessLog[],
    breakTimes: { start: string; end: string }[] = [],
    sessionEnd?: Date,
    sessionStart?: Date
): number => {
    if (!logs || logs.length === 0) return 0;

    // Sort by timestamp
    const sortedLogs = [...logs].sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    let totalMinutes = 0;
    let entryTime: Date | null = null;

    // Helper to parse "HH:MM" to Date on a specific day in KST
    const getBreakDate = (timeStr: string, baseDate: Date): Date => {
        const kstDateStr = getKstToday(baseDate); // "YYYY-MM-DD"
        return new Date(`${kstDateStr}T${timeStr}:00+09:00`);
    };

    // Helper to calculate overlap in minutes
    const getOverlapMinutes = (startA: Date, endA: Date, startB: Date, endB: Date): number => {
        const start = startA > startB ? startA : startB;
        const end = endA < endB ? endA : endB;
        if (start >= end) return 0;
        return (end.getTime() - start.getTime()) / 1000 / 60;
    };

    const processSegment = (entry: Date, exit: Date) => {
        let e = entry;
        let x = exit;

        if (sessionStart && e < sessionStart) e = sessionStart;
        if (sessionEnd && x > sessionEnd) x = sessionEnd;

        if (e >= x) return 0;

        let duration = (x.getTime() - e.getTime()) / 1000 / 60;

        // Subtract break overlaps
        if (breakTimes.length > 0) {
            breakTimes.forEach(brk => {
                const breakStart = getBreakDate(brk.start, entry);
                const breakEnd = getBreakDate(brk.end, entry);

                // Handle break crossing midnight if needed (assumed same day for now)
                if (breakEnd < breakStart) breakEnd.setDate(breakEnd.getDate() + 1);

                const overlap = getOverlapMinutes(e, x, breakStart, breakEnd);
                duration -= overlap;
            });
        }

        return Math.max(0, duration);
    };

    sortedLogs.forEach((log) => {
        const logTime = new Date(log.timestamp.seconds * 1000);

        if (log.action === 'ENTRY') {
            if (entryTime === null) {
                entryTime = logTime;
            }
        } else if (log.action === 'EXIT') {
            if (entryTime !== null) {
                totalMinutes += processSegment(entryTime, logTime);
                entryTime = null;
            }
        }
    });

    // Handle open-ended entry
    if (entryTime !== null && sessionEnd) {
        const et = entryTime as Date;
        if (sessionEnd.getTime() > et.getTime()) {
            totalMinutes += processSegment(et, sessionEnd);
        }
    }

    return Math.floor(totalMinutes);
};

export interface ZoneConfig {
    start?: string;
    end?: string;
    breaks?: { start: string; end: string }[];
    ruleDate?: string;
}

export function calculateRecognizedMinutes(
    lastCheckInDate: Date,
    exitTime: Date,
    zoneConfig?: ZoneConfig
): number {
    let boundedStart = lastCheckInDate;
    let boundedEnd = exitTime;
    let rawDurationMinutes = 0;
    let recognizedMinutes = 0;

    if (zoneConfig?.start && zoneConfig?.end) {
        const dateStr = zoneConfig.ruleDate || getKstToday(lastCheckInDate);
        const zoneStart = new Date(`${dateStr}T${zoneConfig.start}:00+09:00`);
        const zoneEnd = new Date(`${dateStr}T${zoneConfig.end}:00+09:00`);
        
        // Handle midnight crossover for zone
        if (zoneEnd < zoneStart) {
            zoneEnd.setDate(zoneEnd.getDate() + 1);
        }

        boundedStart = new Date(Math.max(lastCheckInDate.getTime(), zoneStart.getTime()));
        boundedEnd = new Date(Math.min(exitTime.getTime(), zoneEnd.getTime()));
    }

    if (boundedEnd > boundedStart) {
        rawDurationMinutes = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);

        let deduction = 0;
        if (zoneConfig?.breaks && Array.isArray(zoneConfig.breaks)) {
            for (const brk of zoneConfig.breaks) {
                const dateStr = zoneConfig.ruleDate || getKstToday(lastCheckInDate);
                const breakStart = new Date(`${dateStr}T${brk.start}:00+09:00`);
                const breakEnd = new Date(`${dateStr}T${brk.end}:00+09:00`);
                
                // Handle midnight crossover
                if (breakEnd < breakStart) {
                    breakEnd.setDate(breakEnd.getDate() + 1);
                }

                const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
                const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
                if (overlapEnd > overlapStart) {
                    deduction += Math.floor((overlapEnd - overlapStart) / 60000);
                }
            }
        }
        recognizedMinutes = Math.max(0, rawDurationMinutes - deduction);
    }
    return recognizedMinutes;
}
