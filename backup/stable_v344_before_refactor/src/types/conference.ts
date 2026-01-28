export interface ConferenceData {
    basic: {
        title: string;
        subTitle: string;
        venue: { name: string; address: string; mapUrl?: string };
        period: { start: string; end: string }; // Formatted date strings
    };
    registration: {
        prices: Record<string, number>; // e.g., { MEMBER: 100000, NON_MEMBER: 150000 }
        deadlines: { earlyBird: Date | null; pre: Date | null };
    };
    program: Array<{
        id: string;
        date: string; // '2026-04-15'
        startTime: string; // '09:00'
        title: string;
        speaker?: string;
        details?: string; // Adding details as it was used in previous code
    }>;
}
