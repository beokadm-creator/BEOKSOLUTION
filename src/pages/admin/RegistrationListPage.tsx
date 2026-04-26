import React from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MessageCircle } from 'lucide-react';
import { EregiButton } from '../../components/eregi/EregiForm';
import { useRegistrationList } from '../../hooks/useRegistrationList';
import { RegistrationTable } from '../../components/admin/registration/RegistrationTable';
import { BulkSendModal } from '../../components/admin/registration/BulkSendModal';
import { RegistrationPagination } from '../../components/admin/registration/RegistrationPagination';

const RegistrationListPage: React.FC = () => {
    const { cid } = useParams<{ cid: string }>();
    const conferenceId = cid || null;

    const {
        filterStatus,
        setFilterStatus,
        searchName,
        setSearchName,
        filteredData,
        loading,
        error,
        fieldSettings,
        selectedIds,
        isProcessing,
        exporting,
        bixolonPrinting,
        bulkModal,
        setBulkModal,
        currentPage,
        itemsPerPage,
        setCurrentPage,
        setItemsPerPage,
        hasMore,
        registrations,
        handleIssueBadge,
        handleResendNotification,
        handleBixolonPrint,
        handleDeleteRegistration,
        prepareBulkSend,
        executeBulkSend,
        toggleSelection,
        toggleSelectAll,
        handleExport,
    } = useRegistrationList(conferenceId);

    if (!conferenceId) return (
        <div className="p-8 text-red-600 font-bold border border-red-400 bg-red-50 m-4 rounded">
            잘못된 학술대회 경로입니다.
        </div>
    );

    if (loading) return (
        <div className="p-8 flex flex-col items-center">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-4" />
            <div className="text-gray-500 text-sm font-mono mb-4">
                Loading registrations...
            </div>
        </div>
    );

    if (error) return (
        <div className="p-8 text-red-600 font-bold border border-red-400 bg-red-50 m-4 rounded">
            Error Loading Registrations: {error}
            <br />
            <span className="text-sm font-normal text-gray-700">Check the browser console for a Firestore Index Link if this is a "Missing Index" error.</span>
        </div>
    );

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">등록 현황 (Registration List)</h1>


            <div className="flex gap-4 mb-6 items-center flex-wrap">
                <input
                    placeholder="이름, 이메일, 전화번호 검색 (Search by Name, Email, Phone)"
                    value={searchName}
                    onChange={e => setSearchName(e.target.value)}
                    className="p-2 border rounded w-64 focus:outline-none focus:ring-2 focus:ring-[#2d80c6] rounded-xl"
                />
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
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
                        onClick={() => prepareBulkSend('selected')}
                        disabled={isProcessing || selectedIds.length === 0}
                        variant="secondary"
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 py-2 px-4 h-auto text-sm"
                    >
                        <MessageCircle size={14} className="mr-1.5" />
                        선택 발송 ({selectedIds.length})
                    </EregiButton>
                    <EregiButton
                        onClick={() => prepareBulkSend('all')}
                        disabled={isProcessing || filteredData.length === 0}
                        variant="secondary"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white border-none py-2 px-4 h-auto text-sm"
                    >
                        <MessageCircle size={14} className="mr-1.5" />
                        전체 발송 (전체)
                    </EregiButton>
                    <EregiButton
                        onClick={handleExport}
                        disabled={exporting}
                        isLoading={exporting}
                        variant="primary"
                        className="bg-green-600 hover:bg-green-700 text-white border-none py-2 px-4 h-auto text-sm"
                    >
                        엑셀 다운로드 (Excel)
                    </EregiButton>
                </div>
            </div>

            <RegistrationTable
                conferenceId={conferenceId}
                filteredData={filteredData}
                fieldSettings={fieldSettings}
                selectedIds={selectedIds}
                isProcessing={isProcessing}
                bixolonPrinting={bixolonPrinting}
                toggleSelection={toggleSelection}
                toggleSelectAll={toggleSelectAll}
                handleIssueBadge={handleIssueBadge}
                handleBixolonPrint={handleBixolonPrint}
                handleResendNotification={handleResendNotification}
                handleDeleteRegistration={handleDeleteRegistration}
            />

            <RegistrationPagination
                loading={loading}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                setCurrentPage={setCurrentPage}
                setItemsPerPage={setItemsPerPage}
                hasMore={hasMore}
                registrationsCount={registrations.length}
            />

            <BulkSendModal
                bulkModal={bulkModal}
                setBulkModal={setBulkModal}
                executeBulkSend={executeBulkSend}
            />
        </div>
    );
};

export default RegistrationListPage;
