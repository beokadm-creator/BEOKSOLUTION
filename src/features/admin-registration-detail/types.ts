import type { Registration } from "@/types/schema";

export type VoucherTokenStatus = "loading" | "active" | "expired" | "issued" | "none";

export type EditFormData = {
  userName: string;
  userOrg: string;
  userPhone: string;
  licenseNumber: string;
};

export interface ExtendedRegistration extends Omit<Registration, "baseAmount" | "optionsTotal" | "selectedOptions"> {
  tier?: string;
  grade?: string;
  categoryName?: string;
  userOrg?: string;
  paymentKey?: string;
  paidAt?: { seconds: number; nanoseconds?: number } | Date | string;
  orderId?: string;
  paymentType?: string;
  method?: string;
  userInfo?: {
    licenseNumber?: string;
    grade?: string;
    [key: string]: unknown;
  };
  license?: string;
  baseAmount?: number;
  optionsTotal?: number;
  options?: Array<{
    optionId: string;
    name: { ko: string; en?: string } | string;
    price: number;
    quantity: number;
    totalPrice: number;
  }>;
  selectedOptions?: Array<{
    optionId: string;
    name: { ko: string; en?: string } | string;
    price: number;
    quantity: number;
    totalPrice: number;
  }>;
}

