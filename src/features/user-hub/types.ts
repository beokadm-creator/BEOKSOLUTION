import { Timestamp } from 'firebase/firestore';
import { ReceiptConfig } from '@/types/print';

export interface Stringable {
    ko?: string;
    en?: string;
    name?: string | Stringable;
    [key: string]: unknown;
}

export interface UserReg {
    id: string;
    conferenceName: string;
    societyName: string;
    earnedPoints?: number;
    slug: string;
    societyId: string;
    location: string;
    dates: string;
    paymentStatus?: string;
    amount?: number;
    receiptNumber?: string;
    paymentDate?: Timestamp | Date | string;
    receiptConfig?: ReceiptConfig;
    userName?: string;
    status?: string; // Generic status field from Firestore (PAID, CANCELED, etc.)
    virtualAccount?: {
        bank: string;
        accountNumber: string;
        customerName?: string;
        dueDate?: string;
    };
}

export interface Affiliation {
    verified: boolean;
    licenseNumber?: string;
    memberId?: string;
    grade?: string;
    expiry?: string | Timestamp;
    expiryDate?: string | Timestamp;
}

export interface ConsentHistoryEntry {
    id: string;
    vendorName: string;
    conferenceId: string;
    conferenceName: string;
    message?: string;
    timestamp?: Timestamp;
}
