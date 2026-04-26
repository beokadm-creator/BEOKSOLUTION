export interface BreakTime {
    label?: string;
    start: string;
    end: string;
}

export interface AttendanceZone {
    id: string;
    name: string;
    start?: string;
    end?: string;
    goalMinutes?: number;
    breaks?: BreakTime[];
    ruleDate?: string;
    globalGoalMinutes?: number;
    completionMode?: 'DAILY_SEPARATE' | 'CUMULATIVE';
    cumulativeGoalMinutes?: number;
    [key: string]: unknown;
}

export interface AttendanceRuleData {
    globalGoalMinutes?: number;
    completionMode?: 'DAILY_SEPARATE' | 'CUMULATIVE';
    cumulativeGoalMinutes?: number;
    zones?: AttendanceZone[];
    [key: string]: unknown;
}

export interface AttendanceRulesMap {
    [dateStr: string]: AttendanceRuleData;
}
