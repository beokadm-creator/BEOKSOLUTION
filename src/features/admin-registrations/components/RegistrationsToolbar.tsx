import { MessageCircle } from "lucide-react";

import { EregiButton } from "@/components/eregi/EregiForm";

type Props = {
  searchName: string;
  filterStatus: string;
  onSearchNameChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onBulkSendSelected: () => void;
  onBulkSendAll: () => void;
  onExport: () => void;
  exporting: boolean;
  isProcessing: boolean;
  selectedCount: number;
  filteredCount: number;
};

export function RegistrationsToolbar(props: Props) {
  const {
    searchName,
    filterStatus,
    onSearchNameChange,
    onFilterStatusChange,
    onBulkSendSelected,
    onBulkSendAll,
    onExport,
    exporting,
    isProcessing,
    selectedCount,
    filteredCount,
  } = props;

  return (
    <div className="flex gap-4 mb-6 items-center flex-wrap">
      <input
        placeholder="이름, 이메일, 전화번호 검색 (Search by Name, Email, Phone)"
        value={searchName}
        onChange={(e) => onSearchNameChange(e.target.value)}
        className="p-2 border rounded w-64 focus:outline-none focus:ring-2 focus:ring-[#2d80c6] rounded-xl"
      />
      <select
        value={filterStatus}
        onChange={(e) => onFilterStatusChange(e.target.value)}
        className="p-2 border rounded rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d80c6]"
      >
        <option value="ALL">전체 상태 (All Status)</option>
        <option value="SUCCESSFUL">성공 접수 (Successful)</option>
        <option value="PAID">결제완료 (PAID)</option>
        <option value="WAITING">입금대기 (Waiting)</option>
        <option value="CANCELED">취소/환불 (Canceled)</option>
      </select>
      <div className="ml-auto flex gap-2">
        <EregiButton
          onClick={onBulkSendSelected}
          disabled={isProcessing || selectedCount === 0}
          variant="secondary"
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 py-2 px-4 h-auto text-sm"
        >
          <MessageCircle size={14} className="mr-1.5" />
          선택 발송 ({selectedCount})
        </EregiButton>
        <EregiButton
          onClick={onBulkSendAll}
          disabled={isProcessing || filteredCount === 0}
          variant="secondary"
          className="bg-indigo-600 hover:bg-indigo-700 text-white border-none py-2 px-4 h-auto text-sm"
        >
          <MessageCircle size={14} className="mr-1.5" />
          전체 발송 (전체)
        </EregiButton>
        <EregiButton
          onClick={onExport}
          disabled={exporting}
          isLoading={exporting}
          variant="primary"
          className="bg-green-600 hover:bg-green-700 text-white border-none py-2 px-4 h-auto text-sm"
        >
          엑셀 다운로드 (Excel)
        </EregiButton>
      </div>
    </div>
  );
}

