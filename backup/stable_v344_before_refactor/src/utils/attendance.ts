import { Timestamp } from 'firebase/firestore';
import { AccessLog } from '../types/schema';

// Helper to calculate duration in minutes
export const calculateStayTime = (logs: AccessLog[], sessionEnd?: Date): number => {
    if (!logs || logs.length === 0) return 0;

    // Sort by timestamp
    const sortedLogs = [...logs].sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    let totalMinutes = 0;
    let entryTime: Date | null = null;

    sortedLogs.forEach((log) => {
        const logTime = new Date(log.timestamp.seconds * 1000);

        if (log.action === 'ENTRY') {
            if (entryTime === null) {
                entryTime = logTime;
            }
            // If already entered, ignore double entry or treat as new segment? 
            // Usually, ignore subsequent ENTRY without EXIT.
        } else if (log.action === 'EXIT') {
            if (entryTime !== null) {
                const duration = (logTime.getTime() - entryTime.getTime()) / 1000 / 60; // Minutes
                totalMinutes += duration;
                entryTime = null;
            }
            // Ignore EXIT without ENTRY
        }
    });

    // Handle open-ended entry (forgot to tag out)
    if (entryTime !== null && sessionEnd) {
        // Explicitly cast to ensure TS knows it's a Date
        const et = entryTime as Date;
        if (sessionEnd.getTime() > et.getTime()) {
             const duration = (sessionEnd.getTime() - et.getTime()) / 1000 / 60;
             totalMinutes += duration;
        }
    }

    return Math.floor(totalMinutes);
};
