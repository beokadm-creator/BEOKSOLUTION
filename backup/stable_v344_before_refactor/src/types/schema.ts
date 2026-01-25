import { Timestamp } from 'firebase/firestore';

// ==========================================
// 0. Helper Types
// ==========================================

export interface LocalizedText {
  ko: string;
  en?: string;
}

export type BadgeElementType = 'NAME' | 'ORG' | 'QR' | 'CUSTOM';

export interface BadgeElement {
  x: number;
  y: number;
  fontSize: number;
  isVisible: boolean;
  type: BadgeElementType;
  content?: string; // For CUSTOM type or override
}

// ==========================================
// 1. Root Collections
// ==========================================

/**
 * Collection: `societies`
 * Path: `societies/{societyId}`
 * Document ID: societyId (e.g., 'kap', 'kaid')
 */
export interface Society {
  id: string; // societyId
  name: LocalizedText;
  description?: LocalizedText;
  logoUrl?: string;
  homepageUrl?: string;
  adminEmails: string[];
  settings?: {
    abstractEnabled?: boolean;
    [key: string]: any;
  };
  footerInfo?: {
    bizRegNumber?: string;
    representativeName?: string;
    address?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
  createdAt: Timestamp;
}

/**
 * Collection: `global_users`
 * Path: `global_users/{email}`
 */
export interface GlobalUser {
  email: string;
  participatedConferences: string[]; // List of conference IDs
}

/**
 * Collection: `super_admins`
 * Path: `super_admins/{email}`
 */
export interface SuperAdmin {
  email: string;
  role: 'SUPER_ADMIN';
  createdAt: Timestamp;
}

// ==========================================
// 2. Tenant Collections
// Path: `conferences/{confId}/...`
// Document ID: `${societyId}_${slug}` (e.g., 'kap_2026spring')
// ==========================================

// ------------------------------------------
// A. Config & Info
// ------------------------------------------

/**
 * Collection: `conferences`
 * Path: `conferences/{confId}`
 */
export interface Conference {
  id: string; // Composite Key: `${societyId}_${slug}`
  societyId: string; // FK to Society
  slug: string; // e.g., '2026spring'
  title: LocalizedText;
  dates: {
    start: Timestamp;
    end: Timestamp;
  };
  location: string;
  status: 'PLANNING' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
  createdAt: Timestamp;
}

export interface ConferenceInfo {
  title: LocalizedText;
  subTitle?: LocalizedText; // Added
  dates: {
    start: Timestamp;
    end: Timestamp;
  };
  venue?: {
    name: LocalizedText; 
    address?: LocalizedText; 
    mapUrl?: string;
  };
  // Flattened fields for UI convenience
  venueName?: LocalizedText | string;
  venueAddress?: LocalizedText | string;
  
  bannerUrl?: string;
  visuals?: {
    bannerUrl?: string;
    posterUrl?: string;
    mainBannerUrl?: string;
  };

  welcomeMessage?: LocalizedText;
  greetings?: LocalizedText; // Added fallback
  externalLinks?: {
    website?: string;
    map?: string;
  };
  badgeLayout: {
    width: number;
    height: number;
    elements: BadgeElement[];
  };
  receiptConfig: {
    issuerName: string;
    stampUrl: string;
    nextSerialNo: number;
  };
}

/**
 * Collection: `private_config`
 * Document: `secrets`
 * Path: `conferences/{confId}/private_config/secrets`
 */
export interface PrivateConfigSecrets {
  payment: {
    clientKey: string;
    secretKey: string;
    useGlobal: boolean;
  };
  notification: {
    apiKey: string;
    senderKey: string;
    useGlobal: boolean;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    useGlobal: boolean;
  };
}

// ------------------------------------------
// B. Registration Settings
// ------------------------------------------

export type RegistrationPeriodType = 'EARLY' | 'ONSITE';

export interface RegistrationPeriod {
  name: LocalizedText;
  type: RegistrationPeriodType;
  startDate: Timestamp;
  endDate: Timestamp;
  prices: {
    [tier in UserTier]?: number; // e.g., MEMBER: 10000, NON_MEMBER: 20000
  };
}

/**
 * Collection: `settings`
 * Document: `registration_periods`
 * Path: `conferences/{confId}/settings/registration_periods`
 */
export interface RegistrationSettings {
  periods: RegistrationPeriod[];
}

/**
 * Collection: `whitelists`
 * Path: `conferences/{confId}/whitelists/{id}`
 */
export interface Whitelist {
  id: string;
  name: string;
  authCode: string;
  tier: UserTier;
  isUsed: boolean;
  usedBy?: string; // userId
  usedAt?: Timestamp;
}

// ------------------------------------------
// C. Registration & User (Core)
// ------------------------------------------

export type UserTier = 'MEMBER' | 'STUDENT' | 'NON_MEMBER' | 'VIP' | 'COMMITTEE';

/**
 * Collection: `users`
 * Path: `conferences/{confId}/users/{userId}`
 */
export interface ConferenceUser {
  uid: string; // Added alias for id
  id: string; // userId
  name: string;
  email: string;
  phone: string;
  country: string;
  isForeigner: boolean;
  organization?: string; // Added
  licenseNumber?: string; // Added
  tier: UserTier;
  authStatus: {
    emailVerified: boolean;
    phoneVerified: boolean;
  };
  affiliations?: {
    [societyId: string]: {
      verified: boolean;
      grade?: string;
      expiry?: string;
      verifiedAt?: Timestamp;
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PaymentStatus = 'PAID' | 'REFUND_REQUESTED' | 'REFUNDED' | 'PARTIAL_REFUNDED' | 'PENDING' | 'FAILED';
export type PaymentMethod = 'CARD' | 'VIRTUAL' | 'CASH' | 'ADMIN_FREE';

/**
 * Collection: `registrations`
 * Path: `conferences/{confId}/registrations/{regId}`
 */
export interface Registration {
  id: string; // regId
  userId: string;
  conferenceId: string; // For easy querying if needed, though redundant with path
  
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amount: number;
  refundAmount: number;
  receiptNumber: string; // e.g., "2026-SP-001"
  userTier?: string; // Added snapshot of tier at registration time
  status?: string; // Added for status checking

  // Two-Step QR Logic
  confirmationQr: string;
  badgeQr: string | null;
  
  isCheckedIn: boolean; // Default: false
  checkInTime: Timestamp | null;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ------------------------------------------
// D. Content (CMS)
// ------------------------------------------

/**
 * Collection: `pages`
 * Path: `conferences/{confId}/pages/{pageId}`
 */
export interface Page {
  id: string;
  slug: string;
  title: LocalizedText;
  content: LocalizedText; // Assuming content is also localized or string
  isPublished: boolean;
  updatedAt: Timestamp;
}

/**
 * Collection: `agendas`
 * Path: `conferences/{confId}/agendas/{agendaId}`
 */
export interface Agenda {
  id: string;
  title: LocalizedText;
  description?: LocalizedText;
  startTime: Timestamp;
  endTime: Timestamp;
  location?: string;
  sessionType?: string; // e.g., 'keynote', 'symposium', 'oral', 'break'
  speakers?: string[]; // Speaker IDs
}

/**
 * Collection: `speakers`
 * Path: `conferences/{confId}/speakers/{speakerId}`
 */
export interface Speaker {
  id: string;
  name: LocalizedText;
  bio?: LocalizedText;
  photoUrl?: string;
  organization?: string;
  presentationTitle?: LocalizedText;
  abstractUrl?: string;
  agendaId?: string;
  sessionTime?: string; // e.g., "10:00 - 10:20"
}

/**
 * Collection: `submissions`
 * Path: `conferences/{confId}/submissions/{subId}`
 */
export interface Submission {
  id: string;
  title: { ko: string; en: string }; // Updated to match usage
  field: string; // Updated
  type: string; // Updated
  status: string; // Updated
  authors: {
    name: string;
    email: string;
    affiliation: string;
    isPresenter: boolean;
  }[];
  fileUrl: string;
  reviewStatus?: 'submitted' | 'pending' | 'accepted_oral' | 'accepted_poster' | 'rejected';
  presentationType?: string; // 심사 후 확정된 발표 형식
  reviewerComment?: string;  // 심사 의견
  reviewedAt?: Timestamp;    // 심사 일시
  submittedAt?: Timestamp;   // 제출 일시
  history: {
    status: string;
    timestamp: Timestamp;
    comment?: string;
  }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ------------------------------------------
// E. Operations
// ------------------------------------------

export type AccessLogType = 'ENTRY' | 'EXIT';

/**
 * Collection: `access_logs`
 * Path: `conferences/{confId}/access_logs/{logId}`
 */
export interface AccessLog {
  id: string;
  action: AccessLogType; // Changed from type to action to match usage
  timestamp: Timestamp;
  scannedQr: string; // This should be the badgeQr
  scannerId?: string; // Device or Staff ID
  locationId?: string; // Room ID or Booth ID
}

/**
 * Collection: `vendors`
 * Path: `conferences/{confId}/vendors/{vendorId}`
 */
export interface Vendor {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  boothLocation?: string;
}

/**
 * Collection: `vendor_accounts`
 * Path: `conferences/{confId}/vendor_accounts/{email}`
 */
export interface VendorAccount {
  email: string;
  vendorId: string;
  name: string;
  role: 'STAFF' | 'MANAGER';
}

/**
 * Collection: `booth_visits`
 * Path: `conferences/{confId}/booth_visits/{visitId}`
 */
export interface BoothVisit {
  id: string;
  vendorId: string;
  userId: string;
  scannedAt: Timestamp;
  isConsentAgreed: boolean;
}
