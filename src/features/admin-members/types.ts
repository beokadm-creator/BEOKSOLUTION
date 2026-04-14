import type { Timestamp } from "firebase/firestore";

export interface Grade {
    id: string;
    name: string;
    code: string;
}

export interface Member {
    id: string;
    societyId: string;
    name: string;
    code: string;
    expiryDate: string;
    grade: string;
    createdAt: Timestamp;
    used?: boolean;
    usedBy?: string;
    usedAt?: Timestamp;
}

