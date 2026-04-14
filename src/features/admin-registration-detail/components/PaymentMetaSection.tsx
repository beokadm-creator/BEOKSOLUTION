import React from "react";

import type { ExtendedRegistration } from "../types";

const formatPaidAt = (paidAt: ExtendedRegistration["paidAt"]) => {
  if (!paidAt) return "-";
  if (paidAt instanceof Date) return paidAt.toLocaleString();
  if (typeof paidAt === "object" && paidAt && "toDate" in paidAt) {
    const maybe = paidAt as unknown as { toDate: () => Date };
    return maybe.toDate().toLocaleString();
  }
  return String(paidAt);
};

type Props = {
  data: ExtendedRegistration;
};

export const PaymentMetaSection: React.FC<Props> = ({ data }) => (
  <>
    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">결제일시 (Paid At)</h3>
      <p className="text-lg">{formatPaidAt(data.paidAt)}</p>
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">PG 거래번호 (Payment Key)</h3>
      <p className="font-mono text-sm">{data.paymentKey || "-"}</p>
    </div>
  </>
);

