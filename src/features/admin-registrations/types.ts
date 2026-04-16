import type { Timestamp } from "firebase/firestore";

import type { RootRegistration as PaginationRootRegistration } from "@/hooks/useRegistrationsPagination";
import type { BadgeElement } from "@/types/schema";

export type RootRegistration = PaginationRootRegistration & {
  baseAmount?: number;
  optionsTotal?: number;
  options?: RegistrationOptionSummary[];
};

export type RegistrationOptionSummary = {
  name?: string | { ko?: string };
  quantity?: number;
};

export type BadgeLayout = {
  width: number;
  height: number;
  elements: BadgeElement[];
  unit?: "px" | "mm";
  enableCutting?: boolean;
  printerFont?: string;
  printerDpmm?: number;
  printOffsetXmm?: number;
  printOffsetYmm?: number;
  printStartOffsetMm?: number;
  mediaType?: number;
  labelGapMm?: number;
  cutFeedMm?: number;
  marginXMm?: number;
  marginYMm?: number;
  cutPaperType?: 0 | 1;
};

export type BulkSendResult = {
  sent: number;
  failed: number;
  skipped: number;
  tokenGenerated: number;
};

export type BulkSendModalState = {
  open: boolean;
  step: "confirm" | "processing" | "done";
  targetIds: string[];
  confirmInput: string;
  checks: boolean[];
  result: BulkSendResult | null;
};

export type BadgeConfigDoc = {
  badgeLayoutEnabled?: boolean;
  badgeLayout?: {
    width?: number;
    height?: number;
    elements?: BadgeElement[];
    unit?: "px" | "mm";
    enableCutting?: boolean;
    printerFont?: string;
    printerDpmm?: number;
    printOffsetXmm?: number;
    printOffsetYmm?: number;
    printStartOffsetMm?: number;
    mediaType?: number;
    labelGapMm?: number;
    cutFeedMm?: number;
    marginXMm?: number;
    marginYMm?: number;
    cutPaperType?: 0 | 1;
  };
  updatedAt?: Timestamp;
};
