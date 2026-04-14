import React from "react";

import type { ExtendedRegistration } from "../types";

type Props = {
  data: ExtendedRegistration;
};

export const PaymentDetailSection: React.FC<Props> = ({ data }) => (
  <>
    <div className="col-span-2 border-t my-2"></div>

    <div className="col-span-2">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-gray-500">결제 상세 정보 (Payment Detail)</h3>
        {data.amount !==
          (data.baseAmount !== undefined && data.baseAmount !== data.amount
            ? data.baseAmount
            : data.amount - (data.optionsTotal || 0)) &&
          !(data.options?.length || data.selectedOptions?.length) && (
            <span className="text-[10px] bg-red-50 text-red-500 px-2 py-1 rounded border border-red-100 font-bold animate-pulse">
              [진단] {Number(data.amount).toLocaleString()}원 중{" "}
              {(Number(data.amount) - (data.baseAmount || data.amount)).toLocaleString()}원의 옵션 내역이 데이터베이스에서
              누락되었습니다.
            </span>
          )}
      </div>
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">등록비 (Registration Fee)</span>
          <span className="font-medium">
            {(data.baseAmount !== undefined && data.baseAmount !== data.amount
              ? data.baseAmount
              : data.amount - (data.optionsTotal || 0)
            ).toLocaleString()}
            원
          </span>
        </div>

        {((data.options && data.options.length > 0) || (data.selectedOptions && data.selectedOptions.length > 0)) && (
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <p className="text-xs font-bold text-gray-400 uppercase">선택 옵션 (Selected Options)</p>
            {(data.options || data.selectedOptions || []).map((opt, idx) => (
              <div key={idx} className="flex justify-between items-start text-sm">
                <div className="flex flex-col">
                  <span className="text-gray-800 font-medium">
                    {typeof opt.name === "string" ? opt.name : opt.name.ko || opt.name.en || "Option"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {opt.price.toLocaleString()}원 × {opt.quantity}
                  </span>
                </div>
                <span className="font-medium">
                  {(opt.totalPrice || opt.price * opt.quantity).toLocaleString()}원
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
          <span className="font-bold text-gray-900">최종 결제 금액 (Total Amount)</span>
          <span className="text-xl font-bold text-blue-600">{Number(data.amount).toLocaleString()}원</span>
        </div>
      </div>
    </div>
  </>
);

