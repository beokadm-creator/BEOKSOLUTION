import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Registration, ZoneRule } from '../types';
import { AttendanceTableRow } from './AttendanceTableRow';

interface AttendanceTableProps {
    registrations: Registration[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    zones: ZoneRule[];
    currentTime: Date;
    selectedDate: string;
    onCheckIn: (regId: string, zoneId: string) => void;
    onCheckOut: (regId: string, currentZoneId: string | null, lastCheckIn: any) => void;
    onOpenLogs: (reg: Registration) => void;
    onUpdateTotalMinutes: (reg: Registration, newTotal: number) => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
    registrations,
    searchTerm,
    setSearchTerm,
    zones,
    currentTime,
    selectedDate,
    onCheckIn,
    onCheckOut,
    onOpenLogs,
    onUpdateTotalMinutes
}) => {
    return (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-white">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="이름, 소속, 이메일 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 bg-slate-50 border-slate-200"
                    />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 ml-auto">
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-md border border-green-100">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        입장중
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 text-slate-600 rounded-md border border-slate-100">
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        퇴장
                    </span>
                </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div className="col-span-3">참가자 정보</div>
                <div className="col-span-2 text-center">출결 상태</div>
                <div className="col-span-2">현재 위치 (Zone)</div>
                <div className="col-span-2 text-right px-4">누적 시간</div>
                <div className="col-span-3 text-right">관리 작업</div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto">
                {registrations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                        <Search className="w-8 h-8 opacity-50" />
                        <p className="text-sm">검색 결과가 없습니다.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {registrations.map(r => (
                            <AttendanceTableRow
                                key={r.id}
                                r={r}
                                zones={zones}
                                currentTime={currentTime}
                                selectedDate={selectedDate}
                                onCheckIn={onCheckIn}
                                onCheckOut={onCheckOut}
                                onOpenLogs={onOpenLogs}
                                onUpdateTotalMinutes={onUpdateTotalMinutes}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
