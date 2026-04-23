/**
 * Shared badge-related types.
 *
 * Canonical definitions extracted from ConferenceBadgePage, StandAloneBadgePage,
 * and BadgePrepPage to avoid local duplication.
 *
 * Safety rule: if a local type shape differs materially from the canonical form,
 * keep the local definition and do NOT force-unify.
 */

// ---------------------------------------------------------------------------
// Attendance / zone types (used by all three badge pages)
// ---------------------------------------------------------------------------

/** Minimal Firestore Timestamp-like shape. */
export type TimestampLike = {
  toDate: () => Date;
};

/** Time-range break inside a zone session. */
export type ZoneBreak = {
  start: string;
  end: string;
};

/** A single attendance zone with optional time bounds and breaks. */
export type AttendanceZone = {
  id: string;
  name?: string;
  goalMinutes?: number;
  start?: string;
  end?: string;
  breaks?: ZoneBreak[];
  ruleDate?: string;
};

/** Rule for a single date key inside AttendanceSettings.rules. */
export type AttendanceRule = {
  zones?: Array<Omit<AttendanceZone, "ruleDate">>;
  completionMode?: "DAILY_SEPARATE" | "CUMULATIVE";
  globalGoalMinutes?: number;
  cumulativeGoalMinutes?: number;
};

/** Top-level attendance settings document stored under settings/attendance. */
export type AttendanceSettings = {
  rules?: Record<string, AttendanceRule>;
};

// ---------------------------------------------------------------------------
// Badge config types (menu visibility / labels / misc)
// ---------------------------------------------------------------------------

/** Controls which tab/menu sections are visible on the badge page. */
export type BadgeMenuVisibility = {
  status?: boolean;
  sessions?: boolean;
  materials?: boolean;
  program?: boolean;
  translation?: boolean;
  stampTour?: boolean;
  home?: boolean;
  qna?: boolean;
  certificate?: boolean;
};

/** Per-menu-item bilingual labels stored in badge_config Firestore doc. */
export type BadgeMenuLabels = {
  status?: { ko?: string; en?: string };
  sessions?: { ko?: string; en?: string };
  materials?: { ko?: string; en?: string };
  program?: { ko?: string; en?: string };
  translation?: { ko?: string; en?: string };
  stampTour?: { ko?: string; en?: string };
  home?: { ko?: string; en?: string };
  qna?: { ko?: string; en?: string };
  certificate?: { ko?: string; en?: string };
};

/** Badge config document stored under settings/badge_config. */
export type BadgeConfig = {
  materialsUrls?: Array<{ name: string; url: string }>;
  translationUrl?: string;
  menuVisibility?: BadgeMenuVisibility;
  menuLabels?: BadgeMenuLabels;
  bgColor?: string;
  textColor?: string;
};

// ---------------------------------------------------------------------------
// Badge UI state (the shape passed from data-loading to badge rendering)
// ---------------------------------------------------------------------------

/**
 * Canonical UI state used by badge rendering components.
 *
 * StandAloneBadgePage and UnifiedBadgeView already use a nearly-identical shape.
 * ConferenceBadgePage has a slightly different `BadgeUiData` that adds `qrValue`
 * and duplicates `zone`/`time`; it can migrate incrementally.
 */
export type BadgeUiState = {
  name: string;
  aff: string;
  id: string;
  userId: string;
  issued: boolean;
  status: string;
  badgeQr: string | null;
  receiptNumber?: string;
  isCompleted?: boolean;
  lastCheckIn?: TimestampLike;
  baseMinutes?: number;
  isCheckedIn?: boolean;
  paymentStatus?: string;
  amount?: number;
  license?: string;
  zone?: string;
  time?: string;
  dailyMinutes?: Record<string, number>;
  zoneMinutes?: Record<string, number>;
  zoneCompleted?: Record<string, boolean>;
};

// ---------------------------------------------------------------------------
// Resolved / normalised menu visibility (all keys present, no undefined)
// ---------------------------------------------------------------------------

/** Every key guaranteed to be `boolean` after normalisation. */
export type ResolvedMenuVisibility = {
  status: boolean;
  sessions: boolean;
  materials: boolean;
  program: boolean;
  translation: boolean;
  stampTour: boolean;
  home: boolean;
  qna: boolean;
  certificate: boolean;
};
