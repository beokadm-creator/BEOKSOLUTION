/**
 * User Data Field Mapper
 * 
 * 목적: phone/phoneNumber, organization/affiliation 등 
 * 필드명 불일치 문제를 해결하기 위한 유틸리티
 * 
 * 사용법:
 * const userData = normalizeUserData(rawData);
 * // userData.phone, userData.organization 보장
 */

import { ConferenceUser } from '../types/schema';

/**
 * Raw user data from various sources (Firestore, Auth, etc.)
 */
export interface RawUserData {
    // ID fields
    id?: string;
    uid?: string;
    userId?: string;

    // Name fields
    name?: string;
    userName?: string;
    displayName?: string;

    // Phone fields (통일 대상)
    phone?: string;
    phoneNumber?: string;

    // Organization fields (통일 대상)
    organization?: string;
    affiliation?: string;
    org?: string;

    // Other fields
    email?: string;
    licenseNumber?: string;
    licenseId?: string;
    tier?: string;
    country?: string;
    isForeigner?: boolean;
    authStatus?: {
        emailVerified: boolean;
        phoneVerified: boolean;
    };
    affiliations?: Record<string, unknown>;
    createdAt?: unknown;
    updatedAt?: unknown;

    // Allow any other fields
    [key: string]: unknown;
}

/**
 * Normalize user data to match ConferenceUser schema
 * 
 * Priority:
 * - phone > phoneNumber
 * - organization > affiliation > org
 * - name > userName > displayName
 */
export function normalizeUserData(raw: RawUserData): Partial<ConferenceUser> {
    return {
        // ID (required)
        id: raw.id || raw.uid || raw.userId || '',
        uid: raw.uid || raw.id || raw.userId || '',

        // Name (required)
        name: raw.name || raw.userName || raw.displayName || '',

        // Email (required)
        email: raw.email || '',

        // Phone (required) - 통일: phone 사용
        phone: raw.phone || raw.phoneNumber || '',

        // Organization (optional) - 통일: organization 사용
        organization: raw.organization || raw.affiliation || raw.org || '',

        // License Number (optional)
        licenseNumber: raw.licenseNumber || raw.licenseId || '',

        // Tier (required)
        tier: (raw.tier as 'MEMBER' | 'NON_MEMBER') || 'NON_MEMBER',

        // Country (required)
        country: raw.country || 'KR',
        isForeigner: raw.isForeigner || false,

        // Auth Status (required)
        authStatus: raw.authStatus || {
            emailVerified: false,
            phoneVerified: false
        },

        // Affiliations (optional)
        affiliations: raw.affiliations as ConferenceUser['affiliations'],

        // Timestamps
        createdAt: raw.createdAt as ConferenceUser['createdAt'] || null,
        updatedAt: raw.updatedAt as ConferenceUser['updatedAt'] || null,
    };
}

/**
 * Extract phone number from any user data format
 */
export function extractPhone(data: RawUserData): string {
    return data.phone || data.phoneNumber || '';
}

/**
 * Extract organization from any user data format
 */
export function extractOrganization(data: RawUserData): string {
    return data.organization || data.affiliation || data.org || '';
}

/**
 * Extract name from any user data format
 */
export function extractName(data: RawUserData): string {
    return data.name || data.userName || data.displayName || '';
}

/**
 * Create Firestore-safe user data (for setDoc/updateDoc)
 * Only includes fields that should be stored in Firestore
 */
export function toFirestoreUserData(user: Partial<ConferenceUser>) {
    return {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '', // ✅ 통일된 필드명
        organization: user.organization || '', // ✅ 통일된 필드명
        licenseNumber: user.licenseNumber || '',
        tier: user.tier || 'NON_MEMBER',
        country: user.country || 'KR',
        isForeigner: user.isForeigner || false,
        authStatus: user.authStatus || {
            emailVerified: false,
            phoneVerified: false
        },
        affiliations: user.affiliations || {},
        updatedAt: new Date(),
    };
}

/**
 * Merge user data from multiple sources
 * Later sources override earlier ones
 */
export function mergeUserData(...sources: RawUserData[]): Partial<ConferenceUser> {
    const merged: RawUserData = {};

    for (const source of sources) {
        Object.assign(merged, source);
    }

    return normalizeUserData(merged);
}
