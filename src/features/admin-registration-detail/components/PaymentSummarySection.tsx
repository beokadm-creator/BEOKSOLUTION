import React from "react";

import type { ExtendedRegistration } from "../types";

const paymentMethodToKorean = (method: string | undefined): string => {
  if (!method) return "-";
  switch (method) {
    case "CARD":
      return "카드";
    case "TRANSFER":
      return "계좌이체";
    case "VIRTUAL":
      return "가상계좌";
    case "CASH":
      return "현금";
    case "ADMIN_FREE":
      return "관리자 무료 등록";
    default:
      return method;
  }
};

type Props = {
  data: ExtendedRegistration;
};

export const PaymentSummarySection: React.FC<Props> = ({ data }) => (
  <>
    <div className="col-span-2 border-t my-2"></div>

    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">결제금액 (Amount)</h3>
      <p className="text-xl font-bold text-blue-600">{Number(data.amount).toLocaleString()}원</p>
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">결제수단 (Payment)</h3>
      <p className="text-lg">
        {paymentMethodToKorean(data.paymentMethod) || data.paymentType || data.method || "-"}
      </p>
    </div>
  </>
);

