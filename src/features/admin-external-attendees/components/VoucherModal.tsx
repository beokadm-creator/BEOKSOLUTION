import React from 'react';
import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { safeFormatDate } from '@/utils/dateUtils';
import type { ExternalAttendeeDoc, ReceiptConfig } from '../types';
import { VoucherLinkSection } from './VoucherLinkSection';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendee: ExternalAttendeeDoc | null;
  confId: string | null;
  confBaseUrl: string;
  confSlug: string;
  isProcessing: boolean;
  onResend: (attendee: ExternalAttendeeDoc) => void;
  receiptConfig: ReceiptConfig | null;
  issuerFallbackName: string;
};

export const VoucherModal: React.FC<Props> = ({
  open,
  onOpenChange,
  attendee,
  confId,
  confBaseUrl,
  confSlug,
  isProcessing,
  onResend,
  receiptConfig,
  issuerFallbackName,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>바우처 / 등록 확인서</DialogTitle>
      </DialogHeader>
      {attendee && (
        <div className="mt-4 space-y-4">
          <div className="p-5 bg-white border rounded-lg">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">등록 정보</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">성명</span>
                <p className="font-bold text-gray-900">{attendee.name}</p>
              </div>
              <div>
                <span className="text-gray-500">소속</span>
                <p className="font-bold text-gray-900">{attendee.organization}</p>
              </div>
              <div>
                <span className="text-gray-500">이메일</span>
                <p className="font-medium">{attendee.email}</p>
              </div>
              <div>
                <span className="text-gray-500">전화번호</span>
                <p className="font-medium">{attendee.phone}</p>
              </div>
              <div>
                <span className="text-gray-500">등록비</span>
                <p className="font-bold text-blue-700">₩{attendee.amount.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-gray-500">영수증 번호</span>
                <p className="font-mono font-medium">{attendee.receiptNumber}</p>
              </div>
              <div>
                <span className="text-gray-500">등록일</span>
                <p className="font-medium">{safeFormatDate(attendee.createdAt)}</p>
              </div>
              <div>
                <span className="text-gray-500">발행처</span>
                <p className="font-medium">{receiptConfig?.issuerName || issuerFallbackName || 'eRegi'}</p>
              </div>
            </div>
          </div>

          <VoucherLinkSection
            attendee={attendee}
            confId={confId}
            confBaseUrl={confBaseUrl}
            confSlug={confSlug}
            onResend={() => onResend(attendee)}
            isProcessing={isProcessing}
          />

          {attendee.password && (
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-gray-600 mb-2">마이페이지 로그인 비밀번호</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-bold text-blue-800">{attendee.password}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(attendee.password || '');
                    toast.success('비밀번호가 복사되었습니다.');
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  복사
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">이 비밀번호로 마이페이지에 로그인할 수 있습니다.</p>
            </div>
          )}
        </div>
      )}
    </DialogContent>
  </Dialog>
);

