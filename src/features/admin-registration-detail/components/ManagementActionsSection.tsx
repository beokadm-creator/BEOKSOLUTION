import React from "react";
import { CheckCircle, CreditCard, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { ExtendedRegistration } from "../types";

type Props = {
  data: ExtendedRegistration;
  canceling: boolean;
  onPaymentCancel: () => void;
  onRefundRequest: () => void;
  onManualApprove: () => void;
};

export const ManagementActionsSection: React.FC<Props> = ({
  data,
  canceling,
  onPaymentCancel,
  onRefundRequest,
  onManualApprove,
}) => {
  const canCancel = data.status === "PAID" && Boolean(data.paymentKey);
  const canRequestRefund = data.status === "PAID";
  const canManualApprove =
    data.status === "PENDING" ||
    data.status === "FAILED" ||
    data.status === "WAITING_FOR_DEPOSIT" ||
    data.status === "PENDING_PAYMENT" ||
    (data.status === "PAID" && (data as unknown as { paymentStatus?: string }).paymentStatus !== "PAID");

  return (
    <>
      {(canCancel || canRequestRefund) && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> 결제 관리
          </h3>
          <div className="flex gap-3">
            {canCancel && (
              <Button
                variant="destructive"
                onClick={onPaymentCancel}
                disabled={canceling}
                className="flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                {canceling ? "처리중..." : "결제 취소 (PG 환불)"}
              </Button>
            )}
            {canRequestRefund && (
              <Button
                variant="outline"
                onClick={onRefundRequest}
                className="flex items-center gap-2 border-yellow-500 text-yellow-600 hover:bg-yellow-50"
              >
                <CheckCircle className="w-4 h-4" />
                환불 요청 처리
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">* 결제 취소는 PG사 직접 환불 처리됩니다.</p>
        </div>
      )}

      {canManualApprove && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-bold mb-3 flex items-center gap-2 text-blue-800">
            <CheckCircle className="w-4 h-4" /> 수동 관리 (Manual Action)
          </h3>
          <div className="flex gap-3 items-center">
            <Button
              variant="default"
              onClick={onManualApprove}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {data.status === "PAID"
                ? "결제 상태 강제 정정 (Fix Payment Status)"
                : "수동 결제 완료 처리 (Force Approve)"}
            </Button>
            <p className="text-sm text-blue-600 ml-2">* 실제 결제가 되었으나 시스템 오류로 대기 상태인 경우 사용하세요.</p>
          </div>
        </div>
      )}
    </>
  );
};

