import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import toast from 'react-hot-toast';

import { useLiveAttendance } from '../../features/admin-attendance-live/hooks/useLiveAttendance';
import { useAttendanceActions } from '../../features/admin-attendance-live/hooks/useAttendanceActions';
import { AttendanceHeader } from '../../features/admin-attendance-live/components/AttendanceHeader';
import { AttendanceStats } from '../../features/admin-attendance-live/components/AttendanceStats';
import { AttendanceTable } from '../../features/admin-attendance-live/components/AttendanceTable';
import { AttendanceLogModal } from '../../features/admin-attendance-live/components/AttendanceLogModal';
import { Registration } from '../../features/admin-attendance-live/types';

const AttendanceLivePage: React.FC = () => {
    const { cid } = useParams<{ cid: string }>();
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showLogModal, setShowLogModal] = useState(false);
    const [selectedRegForLog, setSelectedRegForLog] = useState<Registration | null>(null);

    const {
        registrations,
        loading,
        rules,
        zones,
        availableDates,
        selectedDate,
        setSelectedDate,
        currentTime
    } = useLiveAttendance(cid);

    const {
        handleCheckIn,
        handleCheckOut,
        handleBulkCheckOut,
        isBulkProcessing,
        bulkProgress
    } = useAttendanceActions({ cid, registrations, zones, rules, selectedDate });

    const filteredRegistrations = useMemo(() => {
        if (!searchTerm) return registrations;
        const lower = searchTerm.toLowerCase();
        return registrations.filter(r =>
            r.userName.toLowerCase().includes(lower) ||
            r.userEmail.toLowerCase().includes(lower) ||
            r.affiliation?.toLowerCase().includes(lower)
        );
    }, [registrations, searchTerm]);

    const handleOpenLogs = (reg: Registration) => {
        setSelectedRegForLog(reg);
        setShowLogModal(true);
    };

    const handleUpdateTotalMinutes = async (reg: Registration, mins: number) => {
        if (!cid) return;
        try {
            const collectionName = reg.isExternal ? 'external_attendees' : 'registrations';
            const updatedDailyMinutes = { ...(reg.dailyMinutes || {}) };
            updatedDailyMinutes[selectedDate] = mins;
            const updatedZoneMinutes = { ...(reg.zoneMinutes || {}) };
            if (reg.currentZone) {
                updatedZoneMinutes[reg.currentZone] = mins;
            }
            await updateDoc(doc(db, 'conferences', cid, collectionName, reg.id), {
                totalMinutes: mins,
                dailyMinutes: updatedDailyMinutes,
                zoneMinutes: updatedZoneMinutes,
            });
            toast.success('수정되었습니다.');
        } catch {
            toast.error('수정에 실패했습니다.');
        }
    };

    if (loading) return (
        <div className="flex h-[50vh] items-center justify-center text-slate-400 gap-2">
            <Loader2 className="animate-spin w-6 h-6" />
            <span className="font-medium">실시간 데이터 동기화 중...</span>
        </div>
    );

    return (
        <div className="w-full h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-slate-50/50">
            <AttendanceHeader
                loading={loading}
                selectedDate={selectedDate}
                registrationsCount={registrations.length}
                availableDates={availableDates}
                isBulkProcessing={isBulkProcessing}
                bulkProgress={bulkProgress}
                onSelectedDateChange={setSelectedDate}
                onBulkCheckOut={handleBulkCheckOut}
                onRefresh={() => { /* Handled by onSnapshot in useLiveAttendance automatically */ }}
            />

            <div className="flex-1 overflow-hidden p-6 space-y-6 flex flex-col">
                <AttendanceStats rules={rules} zones={zones} />

                <AttendanceTable
                    registrations={filteredRegistrations}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    zones={zones}
                    currentTime={currentTime}
                    selectedDate={selectedDate}
                    onCheckIn={handleCheckIn}
                    onCheckOut={handleCheckOut}
                    onOpenLogs={handleOpenLogs}
                    onUpdateTotalMinutes={handleUpdateTotalMinutes}
                />
            </div>

            {showLogModal && selectedRegForLog && (
                <AttendanceLogModal
                    cid={cid}
                    registration={selectedRegForLog}
                    zones={zones}
                    onClose={() => setShowLogModal(false)}
                />
            )}
        </div>
    );
};

export default AttendanceLivePage;
