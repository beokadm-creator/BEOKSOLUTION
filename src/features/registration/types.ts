import { Timestamp } from 'firebase/firestore';

export interface RegistrationPeriod {
    id: string;
    name: { ko: string; en?: string };
    type: 'EARLY' | 'REGULAR' | 'ONSITE';
    startDate: Timestamp;
    endDate: Timestamp;
    totalPrices: Record<string, number>; // { [gradeId]: totalPrice }
}

export interface RegistrationSettings {
    periods: RegistrationPeriod[];
    refundPolicy?: string;
}

export interface InfraSettings {
    payment: {
        domestic: {
            provider: string;
            apiKey: string;
            secretKey?: string;
            isTestMode: boolean;
        };
        global?: {
            enabled: boolean;
            provider: string;
            merchantId: string;
            secretKey: string;
            currency: string;
        };
    };
}

export interface Grade {
    id: string;
    name: string | { ko?: string; en?: string };
    code: string;
}

export interface MemberVerificationData {
    id?: string;
    societyId?: string;
    grade?: string;
    name?: string;
    code?: string;
    expiry?: string;
}
