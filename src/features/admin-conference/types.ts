import { Timestamp } from 'firebase/firestore';

export interface ConferenceData {
    title: { ko: string; en: string };
    subtitle?: string;
    slug: string;
    dates: { start: string; end: string };
    venue: {
        name: { ko: string; en: string };
        address: { ko: string; en: string };
        mapUrl: string;
        googleMapEmbedUrl?: string;
    };
    visualAssets: {
        banner: { ko: string; en: string };
        poster: { ko: string; en: string };
    };
    welcomeMessage: { ko: string; en: string };
    welcomeMessageImages?: string[]; // Array of image URLs
    abstractDeadlines: {
        submissionDeadline?: string;
        editDeadline?: string;
    };
    features: {
        guestbookEnabled: boolean;
        stampTourEnabled: boolean;
    };
}

export interface SponsorSummary {
    id: string;
    name: string;
    vendorId?: string;
    order?: number;
    isStampTourParticipant?: boolean;
}

export type StampTourCompletionType = 'COUNT' | 'ALL';
export type StampTourBoothOrderMode = 'SPONSOR_ORDER' | 'CUSTOM';
export type StampTourRewardMode = 'RANDOM' | 'FIXED';
export type StampTourDrawMode = 'PARTICIPANT' | 'ADMIN' | 'BOTH';
export type StampTourRewardFulfillmentMode = 'INSTANT' | 'LOTTERY';

export interface StampTourRewardForm {
    id: string;
    name: string;
    label?: string;
    imageUrl?: string;
    totalQty: number;
    remainingQty: number;
    weight?: number;
    order?: number;
    isFallback?: boolean;
    drawCompletedAt?: Timestamp;
}

export interface StampTourConfigForm {
    enabled: boolean;
    endAt?: Timestamp;
    completionRule: {
        type: StampTourCompletionType;
        requiredCount?: number;
    };
    boothOrderMode: StampTourBoothOrderMode;
    customBoothOrder: string[];
    rewardMode: StampTourRewardMode;
    drawMode: StampTourDrawMode;
    rewardFulfillmentMode: StampTourRewardFulfillmentMode;
    lotteryScheduledAt?: Timestamp;
    rewards: StampTourRewardForm[];
    soldOutMessage: string;
    completionMessage: string;
}

export interface StampTourProgressRow {
    id: string;
    userId: string;
    isCompleted?: boolean;
    userName?: string;
    userOrg?: string;
    rewardName?: string;
    rewardLabel?: string;
    rewardStatus: 'NONE' | 'REQUESTED' | 'REDEEMED';
    lotteryStatus?: 'PENDING' | 'SELECTED' | 'NOT_SELECTED';
    completedAt?: Timestamp;
    requestedAt?: Timestamp;
    redeemedAt?: Timestamp;
    requestedBy?: string;
}
