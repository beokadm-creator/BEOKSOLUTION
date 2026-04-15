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
  printerDpmm?: number;
  printOffsetXmm?: number;
  printOffsetYmm?: number;
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
    printerDpmm?: number;
    printOffsetXmm?: number;
    printOffsetYmm?: number;
  };
  updatedAt?: Timestamp;
};
