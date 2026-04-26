import React from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, RefreshCw, Calendar, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAttendanceLive } from '@/hooks/useAttendanceLive';
import { AttendanceTable } from '@/components/admin/attendance/AttendanceTable';
import { AdjustAttendanceModal } from '@/components/admin/attendance/AdjustAttendanceModal';
import { AttendanceLogModal } from '@/components/admin/attendance/AttendanceLogModal';

const AttendanceLivePage: React.FC = () => {
    const { cid } = useParams<{ cid: string }>();
    const {
        loading, registrations, filteredRegistrations, zones,
        selectedDate, setSelectedDate, availableDates,
        searchTerm, setSearchTerm,
        showLogModal, setShowLogModal, selectedRegForLog, logs,
        showAdjustModal, setShowAdjustModal, selectedRegForAdjust,
        adjustMode, setAdjustMode, adjustZoneId, setAdjustZoneId,
        adjustCheckInTime, setAdjustCheckInTime, adjustCheckOutTime, setAdjustCheckOutTime,
        adjustRecognizedMinutes, setAdjustRecognizedMinutes, adjustTodayMinutes, setAdjustTodayMinutes,
        handleBulkCheckOut, refreshData, handleCheckIn, handleCheckOut,
        openLogs, openAdjust, applyAdjust,
        isBulkProcessing, bulkProgress, goalMinutes, goalLabel, currentTime,
    } = useAttendanceLive(cid);

    if (loading) return (
        <div className="flex h-[50vh] items-center justify-center text-slate-400 gap-2">
            <Loader2 className="animate-spin w-6 h-6" />
            <span className="font-medium">실시간 데이터 동기화 중...</span>
        </div>
    );

    return (
        <div className="w-full h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-slate-50/50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
                <div className="space-y-1">
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <RefreshCw className={cn("w-5 h-5 text-blue-600", loading && "animate-spin")} />
                        실시간 출결 현황
                    </h1>
                    <p className="text-xs text-slate-500">
                        {selectedDate} 기준 | 전체 등록자 {registrations.length}명
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleBulkCheckOut}
                        variant="destructive"
                        size="sm"
                        className="h-9"
                        disabled={isBulkProcessing}
                    >
                        {isBulkProcessing ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {bulkProgress.current} / {bulkProgress.total}</>
                        ) : (
                            <><LogOut className="w-4 h-4 mr-2" /> 일괄 퇴장</>
                        )}
                    </Button>
                    <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                            {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <Button onClick={refreshData} variant="outline" size="icon" className="h-9 w-9">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <AttendanceTable
                registrations={filteredRegistrations}
                zones={zones}
                selectedDate={selectedDate}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                handleCheckIn={handleCheckIn}
                handleCheckOut={handleCheckOut}
                openLogs={openLogs}
                openAdjust={openAdjust}
                goalMinutes={goalMinutes}
                goalLabel={goalLabel}
                currentTime={currentTime}
            />

            {/* Adjust Modal */}
            <AdjustAttendanceModal
                show={showAdjustModal}
                onClose={() => setShowAdjustModal(false)}
                reg={selectedRegForAdjust}
                zones={zones}
                adjustMode={adjustMode}
                setAdjustMode={setAdjustMode}
                adjustZoneId={adjustZoneId}
                setAdjustZoneId={setAdjustZoneId}
                adjustCheckInTime={adjustCheckInTime}
                setAdjustCheckInTime={setAdjustCheckInTime}
                adjustCheckOutTime={adjustCheckOutTime}
                setAdjustCheckOutTime={setAdjustCheckOutTime}
                adjustRecognizedMinutes={adjustRecognizedMinutes}
                setAdjustRecognizedMinutes={setAdjustRecognizedMinutes}
                adjustTodayMinutes={adjustTodayMinutes}
                setAdjustTodayMinutes={setAdjustTodayMinutes}
                applyAdjust={applyAdjust}
            />

            {/* Log Modal */}
            <AttendanceLogModal
                show={showLogModal}
                onClose={() => setShowLogModal(false)}
                reg={selectedRegForLog}
                logs={logs}
                zones={zones}
            />
        </div>
    );
};

export default AttendanceLivePage;
