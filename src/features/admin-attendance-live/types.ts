import { Timestamp } from 'firebase/firestore';

export interface BreakTime {
    label: string;
    start: string;
    end: string;
}

export interface ZoneRule {
    id: string;
    name: string;
    start: string;
    end: string;
    goalMinutes: number;
    breaks: BreakTime[];
}

export interface DailyRule {
    date: string;
    globalGoalMinutes: number;
    zones: ZoneRule[];
    completionMode?: 'DAILY_SEPARATE' | 'CUMULATIVE';
    cumulativeGoalMinutes?: number;
}

export interface Registration {
    id: string;
    userName: string;
    userEmail: string;
    attendanceStatus: 'INSIDE' | 'OUTSIDE' | null;
    currentZone: string | null;
    lastCheckIn?: Timestamp;
    totalMinutes: number;
    dailyMinutes?: Record<string, number>;
    zoneMinutes?: Record<string, number>;
    zoneCompleted?: Record<string, boolean>;
    isCompleted: boolean;
    slug: string;
    affiliation?: string;
    isExternal?: boolean;
}

export interface LogEntry {
    id: string;
    type: 'ENTER' | 'EXIT';
    timestamp: Timestamp;
    zoneId: string;
    rawDuration?: number;
    deduction?: number;
    recognizedMinutes?: number;
    method?: string;
}
