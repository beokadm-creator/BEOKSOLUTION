import React from "react";

import type { ExtendedRegistration } from "../types";

const statusToKorean = (status: string) => {
  if (status === "PAID") return "결제완료";
  if (status === "REFUND_REQUESTED") return "환불요청";
  if (status === "REFUNDED") return "환불완료";
  if (status === "CANCELED") return "취소됨";
  return status;
};

const statusClassName = (status: string) => {
  if (status === "PAID") return "bg-green-100 text-green-800";
  if (status === "REFUND_REQUESTED") return "bg-yellow-100 text-yellow-800";
  if (status === "REFUNDED") return "bg-blue-100 text-blue-800";
  if (status === "CANCELED") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
};

type Props = {
  data: ExtendedRegistration;
};

export const SummarySection: React.FC<Props> = ({ data }) => (
  <>
    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">주문번호 (Order ID)</h3>
      <p className="font-mono text-lg">{data.orderId || data.id}</p>
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-500 mb-1">등록상태 (Status)</h3>
      <span className={`px-2 py-1 rounded font-bold ${statusClassName(String(data.status))}`}>
        {statusToKorean(String(data.status))}
      </span>
    </div>
  </>
);

