import type { RootRegistration } from "../types";

export const statusToKorean = (status: string) => {
  switch (status) {
    case "PAID":
      return "결제완료";
    case "PENDING":
      return "대기";
    case "WAITING_FOR_DEPOSIT":
      return "입금대기";
    case "PENDING_PAYMENT":
      return "결제진행중";
    case "REFUNDED":
      return "환불완료";
    case "REFUND_REQUESTED":
      return "환불요청";
    case "CANCELED":
      return "취소됨";
    default:
      return status;
  }
};

export const displayTier = (tier: string | undefined): string => tier || "-";

export const getRegistrationDisplayAmount = (reg: RootRegistration) => {
  if (reg.amount !== undefined) return reg.amount;
  if (reg.baseAmount !== undefined) return (reg.baseAmount || 0) + (reg.optionsTotal || 0);
  return 0;
};

