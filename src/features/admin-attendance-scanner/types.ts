export interface ScannerState {
    status: 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
    message: string;
    subMessage?: string;
    lastScanned: string;
    userData?: {
        name: string;
        affiliation: string;
    };
    actionType?: 'ENTER' | 'EXIT';
}

export type ScannerMode = 'ENTER_ONLY' | 'EXIT_ONLY' | 'AUTO';

export interface Zone {
    id: string;
    name: string;
    ruleDate?: string;
    globalGoalMinutes?: number;
    completionMode?: string;
    cumulativeGoalMinutes?: number;
    start?: string;
    end?: string;
    breaks?: any[];
    goalMinutes?: number;
}
