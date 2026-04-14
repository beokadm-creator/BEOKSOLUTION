import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";

import { BulkSendSafetyModal } from "./components/BulkSendSafetyModal";
import { RegistrationsPagination } from "./components/RegistrationsPagination";
import { RegistrationsTable } from "./components/RegistrationsTable";
import { RegistrationsToolbar } from "./components/RegistrationsToolbar";
import { useAdminRegistrations } from "./hooks/useAdminRegistrations";

export default function AdminRegistrationListPage() {
  const { cid } = useParams<{ cid: string }>();
  const conferenceId = cid || null;

  const state = useAdminRegistrations({ conferenceId });

  if (!conferenceId)
    return (
      <div className="p-8 text-red-600 font-bold border border-red-400 bg-red-50 m-4 rounded">
        잘못된 학술대회 경로입니다.
      </div>
    );

  if (state.loading)
    return (
      <div className="p-8 flex flex-col items-center">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-4" />
        <div className="text-gray-500 text-sm font-mono mb-4">Loading registrations...</div>
      </div>
    );

  if (state.error)
    return (
      <div className="p-8 text-red-600 font-bold border border-red-400 bg-red-50 m-4 rounded">
        Error Loading Registrations: {state.error}
        <br />
        <span className="text-sm font-normal text-gray-700">
          Check the browser console for a Firestore Index Link if this is a &quot;Missing Index&quot; error.
        </span>
      </div>
    );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">등록 현황 (Registration List)</h1>

      <RegistrationsToolbar
        searchName={state.searchName}
        filterStatus={state.filterStatus}
        onSearchNameChange={state.setSearchName}
        onFilterStatusChange={state.setFilterStatus}
        onBulkSendSelected={() => state.actions.prepareBulkSend("selected")}
        onBulkSendAll={() => state.actions.prepareBulkSend("all")}
        onExport={state.actions.handleExport}
        exporting={state.exporting}
        isProcessing={state.isProcessing}
        selectedCount={state.selectedIds.length}
        filteredCount={state.filteredData.length}
      />

      <RegistrationsTable
        data={state.filteredData}
        selectedIds={state.selectedIds}
        onToggleSelection={state.actions.toggleSelection}
        onToggleSelectAll={state.actions.toggleSelectAll}
        onRowClick={state.actions.handleRowClick}
        onIssueBadge={state.actions.handleIssueBadge}
        onBixolonPrint={state.actions.handleBixolonPrint}
        onResendNotification={state.actions.handleResendNotification}
        onDeleteRegistration={state.actions.handleDeleteRegistration}
        bixolonPrinting={state.bixolonPrinting}
        isProcessing={state.isProcessing}
      />

      {!state.loading && state.registrations.length > 0 && (
        <RegistrationsPagination
          registrationsLength={state.registrations.length}
          currentPage={state.currentPage}
          itemsPerPage={state.itemsPerPage}
          hasMore={state.hasMore}
          onSetCurrentPage={state.setCurrentPage}
          onSetItemsPerPage={state.setItemsPerPage}
        />
      )}

      <BulkSendSafetyModal
        bulkModal={state.bulkModal}
        onClose={state.actions.closeBulkModal}
        onExecute={state.actions.executeBulkSend}
        onToggleCheck={state.actions.toggleBulkCheck}
        onConfirmInputChange={state.actions.setBulkConfirmInput}
      />
    </div>
  );
}

