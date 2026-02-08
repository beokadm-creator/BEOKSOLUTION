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
  introduction?: LocalizedText;
  logoUrl?: string;
  homepageUrl?: string;
  adminEmails: string[];
  settings?: {
    abstractEnabled?: boolean;
    [key: string]: unknown;
  };
  footerInfo?: {
    bizRegNumber?: string;
    representativeName?: LocalizedText;
    address?: LocalizedText;
    contactEmail?: string;
    contactPhone?: string;
    operatingHours?: LocalizedText;
    emailNotice?: LocalizedText;
    privacyPolicy?: LocalizedText;
    termsOfService?: LocalizedText;
  };
  membershipFeeTiers?: MembershipFeeTier[]; // 회원등급별 금액 설정
  // Content Fields
  presidentGreeting?: {
    message?: LocalizedText;
    images?: string[];
    // Backward compatibility
    ko?: string;
    en?: string;
  } | string | LocalizedText;
  notices?: {
    id: string;
    title: LocalizedText;
    content: LocalizedText;
    category: string;
    date: Timestamp;
    isPinned?: boolean;
  }[];
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
  venue?: {
    name: LocalizedText;
    address?: LocalizedText;
    mapUrl?: string;
  };
  status: 'PLANNING' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
  createdAt: Timestamp;
  // Abstract submission deadlines
  abstractSubmissionDeadline?: Timestamp; // Deadline for new submissions
  abstractEditDeadline?: Timestamp; // Deadline for editing existing submissions
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
  // Abstract submission deadlines
  abstractSubmissionDeadline?: Timestamp; // Deadline for new submissions
  abstractEditDeadline?: Timestamp; // Deadline for editing existing submissions
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
 * ==========================================
 * G. Society Membership Fee Settings
 * ==========================================
 */

/**
 * Collection: `societies/{societyId}/settings/membership-fees`
 * Path: `societies/{societyId}/settings/membership-fees`
 */
export interface MembershipFeeTier {
  id: string;
  name: string;        // 정회원, 준회원, 준비회원
  amount: number;      // 금액 (원)
  validityMonths?: number; // 유효기간 (개월) - 기존 필드
  validityYears?: number;  // 유효기간(년) - 신규 필드
  isActive: boolean;    // 활성화 여부
}

/**
 * Collection: `societies/{societyId}/membership-payments`
 * Path: `societies/{societyId}/membership-payments`
 */
export interface MembershipPaymentHistory {
  id: string;
  societyId: string;
  userId: string; // 결제한 회원 ID
  userName: string; // 결제한 회원 이름
  feeTierId: string; // 선택한 등급 ID
  amount: number; // 결제 금액
  paymentMethod: 'TOSS' | 'NICE'; // 결제 수단
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  orderId: string; // PG사 주문번호
  paymentDetails: {
    tid?: string;
    authCode?: string;
  };
  expiryExtended: {
    memberId?: string; // 기존 회원 ID (연장의 경우)
    newMemberCode?: string; // 신규 코드 (신규 생성의 경우)
    previousExpiry?: string; // 이전 유효기간 (연장의 경우)
    newExpiry: string; // 새로운 유효기간
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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

  // Snapshot User Info (Added for Data Integrity)
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  affiliation?: string; // Legacy support (DB field)
  organization?: string; // New standard
  licenseNumber?: string; // Snapshot of license number

  status?: string; // Added for status checking

  // Two-Step QR Logic
  confirmationQr: string;
  badgeQr: string | null;
  /** @deprecated Use badge_tokens/{token} collection as SSOT. Kept for backward compatibility only. */
  badgePrepToken?: string;       // Reference to badge_tokens collection (DEPRECATED - use badge_tokens SSOT)

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
 * Sponsor tier levels for display ordering and styling
 */
export type SponsorTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE';

/**
 * Collection: `sponsors`
 * Path: `conferences/{confId}/sponsors/{sponsorId}`
 *
 * Firestore document structure (without id field)
 */
export interface SponsorDoc {
  name: string;           // Sponsor company name
  logoUrl: string;        // Logo image URL (Firebase Storage)
  description: string;    // One-line introduction
  websiteUrl: string;     // Homepage URL
  tier?: SponsorTier;     // Sponsor tier for ordering/styling (optional)
  order?: number;         // Display order (lower = first)
  isActive: boolean;      // Enable/disable without deleting
  useTiers?: boolean;     // Conference-level setting: enable tier-based styling
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * UI representation of Sponsor (includes document ID)
 */
export interface Sponsor extends SponsorDoc {
  id: string;  // Document ID (not stored in Firestore)
}

/**
 * Collection: `submissions`
 * Path: `conferences/{confId}/submissions/{subId}`
 */
export interface Submission {
  id: string;
  userId: string; // Added for matching with user/registration
  registrationId?: string; // [Fixed] Added for non-member identification
  submitterId?: string; // [Fixed] Unified ID for searching/statistics
  isMemberUser?: boolean; // [Fixed] Optimization flag
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
 * Collection: `badge_tokens`
 * Path: `conferences/{confId}/badge_tokens/{token}`
 *
 * SSOT (Single Source of Truth) for voucher/badge token management
 * All token operations MUST go through badge_tokens collection
 *
 * STATE TRANSITIONS:
 * 1. ACTIVE: Token created, ready for validation (onRegistrationCreated)
 * 2. ISSUED: Digital badge issued at InfoDesk (issueDigitalBadge)
 * 3. EXPIRED: Token expired (conference.end + 24h) - can be reissued
 *
 * BACKWARD COMPATIBILITY:
 * Registration.badgePrepToken is deprecated - use badge_tokens/{token} instead
 */
export interface BadgeToken {
  token: string;              // TKN-{random-32-char} - DOCUMENT ID = token value
  registrationId: string;      // Reference to registration OR external_attendees
  conferenceId: string;
  userId: string;
  status: 'ACTIVE' | 'ISSUED' | 'EXPIRED';
  createdAt: Timestamp;
  issuedAt?: Timestamp;
  expiresAt: Timestamp;        // conference.end + 24h (fallback: 7 days)
  reissuedCount?: number;      // Track reissue history for analytics
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

// ==========================================
// F. Notification Templates (NEW)
// ==========================================

/**
 * Event types that trigger notifications
 */
export type NotificationEventType =
  | 'MEMBER_REGISTER'         // 회원가입
  | 'CONFERENCE_REGISTER'     // 학술대회 등록
  | 'ABSTRACT_SUBMIT'         // 초록 제출
  | 'ABSTRACT_ACCEPTED'       // 초록 승인
  | 'ABSTRACT_REJECTED'       // 초록 반려
  | 'PAYMENT_COMPLETE'        // 결제 완료
  | 'CHECKIN_COMPLETE'        // 체크인 완료
  | 'DIGITAL_BADGE_ISSUED';   // 디지털 명찰 발행

/**
 * Notification channels
 */
export type NotificationChannelType = 'EMAIL' | 'KAKAO';

/**
 * Template variable definition
 */
export interface TemplateVariable {
  key: string;        // e.g., userName, eventName
  label: string;      // e.g., 이름, 행사명
  description?: string; // e.g., 수신자의 성명
  example?: string;   // e.g., 홍길동
}

/**
 * AlimTalk button configuration
 */
export interface AlimTalkButton {
  name: string;
  type: 'WL' | 'AL' | 'BK' | 'MD'; // Web Link, App Link, Bot Keyword, Message Delivery
  linkMobile?: string;
  linkPc?: string;
}

/**
 * Email configuration
 */
export interface EmailConfig {
  subject: string;
  body: string;
  isHtml: boolean;
}

/**
 * AlimTalk configuration
 */
export interface KakaoConfig {
  content: string;
  buttons: AlimTalkButton[];
  kakaoTemplateCode?: string;  // 카카오 승인 코드
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

/**
 * Channel-specific settings
 */
export interface ChannelConfig {
  email?: EmailConfig;
  kakao?: KakaoConfig;
}

/**
 * Event type configuration with available variables
 */
export interface EventTypeConfig {
  type: NotificationEventType;
  label: LocalizedText;
  description?: LocalizedText;
  variables: TemplateVariable[];
}

/**
 * Notification template
 * Collection: `notification-templates`
 * Path: `societies/{societyId}/notification-templates/{templateId}`
 * eventType is stored as a field, not as a subcollection path
 */
export interface NotificationTemplate {
  id: string;
  eventType: NotificationEventType;
  societyId: string;
  name: string;               // 관리용 이름
  description?: string;
  isActive: boolean;
  variables: TemplateVariable[];  // 이 이벤트에서 사용 가능한 변수

  // 채널별 설정
  channels: ChannelConfig;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Collection: `external_attendees`
 * Path: `conferences/{confId}/external_attendees/{externalId}`
 */
export interface ExternalAttendee {
  id: string; // External attendee ID (same as generated UID)
  uid: string; // Generated UID (UUID v4) - used for badge, voucher, attendance tracking
  userId?: string; // Firebase Auth user ID (generated for external attendees)
  conferenceId: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  licenseNumber?: string; // Optional
  password?: string; // Optional - password for Firebase Auth (only stored temporarily until user creation)

  // Registration snapshot for compatibility
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  amount: number;
  receiptNumber: string;

  // Badge & Check-in fields
  confirmationQr: string;
  badgeQr: string | null;
  badgePrepToken?: string;
  isCheckedIn: boolean;
  checkInTime: Timestamp | null;
  badgeIssued?: boolean;
  badgeIssuedAt?: Timestamp;

  // Deletion status
  deleted?: boolean;

  // Metadata
  registrationType: 'MANUAL_INDIVIDUAL' | 'MANUAL_BULK';
  registeredBy: string; // Admin user ID who registered
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Preset event types with their available variables
 * Used for UI dropdown and variable hints
 */
export const EVENT_TYPE_PRESETS: Record<NotificationEventType, EventTypeConfig> = {
  MEMBER_REGISTER: {
    type: 'MEMBER_REGISTER',
    label: { ko: '회원가입', en: 'Member Registration' },
    description: { ko: '새 회원이 가입했을 때', en: 'When a new member registers' },
    variables: [
      { key: 'userName', label: '이름', description: '수신자의 성명', example: '홍길동' },
      { key: 'userEmail', label: '이메일', description: '수신자의 이메일', example: 'user@example.com' },
      { key: 'societyName', label: '학회명', description: '가입한 학회 이름', example: 'KADD' }
    ]
  },
  CONFERENCE_REGISTER: {
    type: 'CONFERENCE_REGISTER',
    label: { ko: '학술대회 등록', en: 'Conference Registration' },
    description: { ko: '참가자가 등록을 완료했을 때', en: 'When a participant completes registration' },
    variables: [
      { key: 'userName', label: '이름', description: '참가자 성명', example: '홍길동' },
      { key: 'eventName', label: '행사명', description: '학술대회 제목', example: '제00회 학술대회' },
      { key: 'registrationId', label: '등록번호', description: '접수 번호', example: 'REG-12345' },
      { key: 'startDate', label: '시작일', description: '행사 시작일', example: '2026-03-15' },
      { key: 'venue', label: '장소', description: '행사 장소', example: '서울 코엑스' },
      { key: 'badgePrepUrl', label: '배지 수령 전 QR URL', description: '배지 픽업 전 진입 URL (회원별)', example: 'https://kadd.eregi.co.kr/badge-prep/...' },
      { key: 'digitalBadgeQrUrl', label: '디지털 명찰 QR URL', description: '디지털 명찰 내 QR이 담긴 URL (출결 시스템 인식용, 회원별)', example: 'https://kadd.eregi.co.kr/my-badge/...' }
    ]
  },
  ABSTRACT_SUBMIT: {
    type: 'ABSTRACT_SUBMIT',
    label: { ko: '초록 제출', en: 'Abstract Submission' },
    description: { ko: '초록이 제출되었을 때', en: 'When an abstract is submitted' },
    variables: [
      { key: 'userName', label: '이름', description: '저자 성명', example: '홍길동' },
      { key: 'eventName', label: '행사명', description: '학술대회 제목', example: '제00회 학술대회' },
      { key: 'abstractTitle', label: '초록 제목', description: '제출된 초록 제목', example: '치과보철학의 동향' },
      { key: 'submissionId', label: '제출 ID', description: '초록 식별 ID', example: 'ABS-67890' }
    ]
  },
  ABSTRACT_ACCEPTED: {
    type: 'ABSTRACT_ACCEPTED',
    label: { ko: '초록 승인', en: 'Abstract Accepted' },
    description: { ko: '초록이 승인되었을 때', en: 'When an abstract is accepted' },
    variables: [
      { key: 'userName', label: '이름', description: '저자 성명', example: '홍길동' },
      { key: 'eventName', label: '행사명', description: '학술대회 제목', example: '제00회 학술대회' },
      { key: 'abstractTitle', label: '초록 제목', description: '승인된 초록 제목', example: '치과보철학의 동향' },
      { key: 'presentationType', label: '발표 형식', description: '확정된 발표 형식', example: '구강 발표' }
    ]
  },
  ABSTRACT_REJECTED: {
    type: 'ABSTRACT_REJECTED',
    label: { ko: '초록 반려', en: 'Abstract Rejected' },
    description: { ko: '초록이 반려되었을 때', en: 'When an abstract is rejected' },
    variables: [
      { key: 'userName', label: '이름', description: '저자 성명', example: '홍길동' },
      { key: 'eventName', label: '행사명', description: '학술대회 제목', example: '제00회 학술대회' },
      { key: 'abstractTitle', label: '초록 제목', description: '반려된 초록 제목', example: '치과보철학의 동향' },
      { key: 'reviewerComment', label: '심사 의견', description: '반려 사유', example: '연구 목적이 불명확합니다' }
    ]
  },
  PAYMENT_COMPLETE: {
    type: 'PAYMENT_COMPLETE',
    label: { ko: '결제 완료', en: 'Payment Complete' },
    description: { ko: '결제가 완료되었을 때', en: 'When payment is completed' },
    variables: [
      { key: 'userName', label: '이름', description: '결제자 성명', example: '홍길동' },
      { key: 'eventName', label: '행사명', description: '학술대회 제목', example: '제00회 학술대회' },
      { key: 'registrationId', label: '등록번호', description: '접수 번호', example: 'REG-12345' },
      { key: 'amount', label: '결제 금액', description: '결제된 금액', example: '100,000원' }
    ]
  },
  CHECKIN_COMPLETE: {
    type: 'CHECKIN_COMPLETE',
    label: { ko: '체크인 완료', en: 'Check-in Complete' },
    description: { ko: '입장 체크인이 완료되었을 때', en: 'When check-in is completed' },
    variables: [
      { key: 'userName', label: '이름', description: '참가자 성명', example: '홍길동' },
      { key: 'eventName', label: '행사명', description: '학술대회 제목', example: '제00회 학술대회' },
      { key: 'checkinTime', label: '체크인 시간', description: '입장 시각', example: '2026-03-15 09:30' },
      { key: 'venue', label: '장소', description: '입장 장소', example: '메인 홀' }
    ]
  },
  DIGITAL_BADGE_ISSUED: {
    type: 'DIGITAL_BADGE_ISSUED',
    label: { ko: '디지털 명찰 발행', en: 'Digital Badge Issued' },
    description: { ko: '인포데스크에서 QR을 스캔하여 디지털 명찰이 발행되었을 때', en: 'When digital badge is issued after QR scan at infodesk' },
    variables: [
      { key: 'userName', label: '이름', description: '참가자 성명', example: '홍길동' },
      { key: 'eventName', label: '행사명', description: '학술대회 제목', example: '제00회 학술대회' },
      { key: 'registrationId', label: '등록번호', description: '접수 번호', example: 'REG-12345' },
      { key: 'digitalBadgeQrUrl', label: '디지털 명찰 QR URL', description: '디지털 명찰 내 QR이 담긴 URL (출결 시스템 인식용, 회원별)', example: 'https://kadd.eregi.co.kr/my-badge/...' },
      { key: 'issuedAt', label: '발행 시각', description: '디지털 명찰 발행 시간', example: '2026-03-15 09:00' },
      { key: 'venue', label: '장소', description: '행사 장소', example: '서울 코엑스' }
    ]
  }
};

// ==========================================
// G. Conference Notices
// ==========================================

/**
 * Priority levels for notices
 */
export type NoticePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Notice status
 */
export type NoticeStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/**
 * Collection: `notices`
 * Path: `conferences/{confId}/notices/{noticeId}`
 */
export interface Notice {
  id: string; // noticeId
  conferenceId: string; // For easy querying
  title: LocalizedText;
  content: {
    html: string; // HTML content
    images?: string[]; // Image URLs from Firebase Storage
    videos?: string[]; // Video URLs (YouTube, Vimeo, or Firebase Storage)
  };
  priority: NoticePriority;
  status: NoticeStatus;
  isPinned?: boolean; // Pinned notices appear at the top
  targetAudience?: 'ALL' | 'MEMBERS' | 'NON_MEMBERS' | 'SPEAKERS' | 'VENDORS';
  publishAt?: Timestamp; // Scheduled publish time
  expiresAt?: Timestamp; // Expiration time (auto-archive)
  readCount?: number; // Analytics: how many users read this notice
  authorId: string; // Creator user ID
  authorName?: string; // Snapshot of creator name
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==========================================
// H. Monitoring & Logging (NEW)
// ==========================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'RUNTIME'        // JavaScript runtime errors (TypeError, ReferenceError, etc.)
  | 'NETWORK'        // Network failures (API calls, Firestore queries)
  | 'AUTH'           // Authentication/authorization errors
  | 'VALIDATION'     // Form validation errors
  | 'PAYMENT'        // Payment processing errors
  | 'DATA_INTEGRITY' // Data consistency issues
  | 'PERFORMANCE'    // Performance degradation
  | 'UNKNOWN';       // Uncategorized errors

/**
 * Error log entry
 * Collection: `logs/errors/{date}/{errorId}`
 * Path: `logs/2026-02-06/err_abc123`
 *
 * ARCHITECTURE:
 * - Date-partitioned collection for efficient querying
 * - Automatic retention: delete logs older than 90 days
 * - Indexes on: timestamp, severity, category, userId
 */
export interface ErrorLog {
  id: string; // errorId (auto-generated: err_{timestamp}_{random})
  timestamp: Timestamp; // When error occurred
  severity: ErrorSeverity; // Impact level
  category: ErrorCategory; // Error type

  // Error details
  message: string; // Error message
  stack?: string; // Stack trace (if available)
  errorCode?: string; // Custom error code (e.g., "PAYMENT_001")

  // Context
  userId?: string; // User who encountered the error (if authenticated)
  userAgent?: string; // Browser/device info
  url?: string; // Page where error occurred
  route?: string; // React Router path

  // Additional context
  metadata?: {
    [key: string]: unknown; // Flexible metadata for debugging
    component?: string; // React component where error occurred
    action?: string; // User action that triggered error
    apiEndpoint?: string; // API call that failed
    firestoreQuery?: string; // Firestore query that failed
  };

  // Resolution tracking
  resolved: boolean; // Whether error has been resolved
  resolvedAt?: Timestamp; // When error was resolved
  resolvedBy?: string; // Admin who resolved
  notes?: string; // Resolution notes

  // Alerting
  alertSent: boolean; // Whether email alert was sent
  alertSentAt?: Timestamp; // When alert was sent

  // Counting
  occurrenceCount: number; // How many times this error occurred
  firstSeenAt: Timestamp; // When error first occurred
  lastSeenAt: Timestamp; // When error last occurred
}

/**
 * Performance metric entry
 * Collection: `logs/performance/{date}/{metricId}`
 * Path: `logs/2026-02-06/perf_xyz789`
 *
 * METRICS TRACKED:
 * - Web Vitals: LCP, FID, CLS
 * - API response times
 * - Page load times
 * - Custom performance markers
 */
export interface PerformanceMetric {
  id: string; // metricId (auto-generated)
  timestamp: Timestamp; // When metric was collected

  // Metric type
  metricType: 'LCP' | 'FID' | 'CLS' | 'PAGE_LOAD' | 'API_RESPONSE' | 'CUSTOM';
  metricName: string; // Human-readable name (e.g., "Registration Page Load Time")
  value: number; // Metric value in milliseconds (or score for CLS)
  unit: 'ms' | 'score'; // Unit of measurement

  // Context
  userId?: string; // User who experienced this metric
  url?: string; // Page URL
  route?: string; // React Router path

  // Thresholds
  threshold?: number; // Performance threshold (for alerting)
  isPoor: boolean; // Whether metric indicates poor performance

  // Additional metadata
  metadata?: {
    [key: string]: unknown;
    connectionType?: string; // '4g', '3g', etc.
    deviceType?: string; // 'mobile', 'desktop', 'tablet'
    apiEndpoint?: string; // For API_RESPONSE metrics
    cacheStatus?: string; // 'hit', 'miss', 'partial'
  };
}

/**
 * Data integrity alert
 * Collection: `logs/data_integrity/{date}/{alertId}`
 * Path: `logs/2026-02-06/integrity_def456`
 *
 * USE CASES:
 * - Negative payment amounts
 * - Duplicate member codes
 * - Invalid timestamps
 * - Orphaned records
 */
export interface DataIntegrityAlert {
  id: string; // alertId (auto-generated)
  timestamp: Timestamp; // When anomaly detected
  severity: ErrorSeverity; // Impact level

  // Anomaly details
  collection: string; // Firestore collection path (e.g., "conferences/kap_2026spring/registrations")
  documentId: string; // Document ID with anomaly
  field: string; // Field name with issue
  expectedValue: unknown; // What value should be
  actualValue: unknown; // What value actually is
  rule: string; // Validation rule that was violated (e.g., "paymentAmount > 0")

  // Context
  detectedBy: 'TRIGGER' | 'SCHEDULED_CHECK'; // How anomaly was detected
  userId?: string; // User who made the change (if available)

  // Resolution
  resolved: boolean;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolutionAction?: string; // 'MANUAL_FIX', 'AUTOMATED_ROLLBACK', etc.
  notes?: string;

  // Alerting
  alertSent: boolean;
  alertSentAt?: Timestamp;
}
