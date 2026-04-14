import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, LogOut, Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceHeaderProps {
    loading: boolean;
    selectedDate: string;
    registrationsCount: number;
    availableDates: string[];
    isBulkProcessing: boolean;
    bulkProgress: { current: number; total: number };
    onSelectedDateChange: (date: string) => void;
    onBulkCheckOut: () => void;
    onRefresh: () => void;
}

export const AttendanceHeader: React.FC<AttendanceHeaderProps> = ({
    loading,
    selectedDate,
    registrationsCount,
    availableDates,
    isBulkProcessing,
    bulkProgress,
    onSelectedDateChange,
    onBulkCheckOut,
    onRefresh
}) => {
    return (
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
            <div className="space-y-1">
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <RefreshCw className={cn("w-5 h-5 text-blue-600", loading && "animate-spin")} />
                    실시간 출결 현황
                </h1>
                <p className="text-xs text-slate-500">
                    {selectedDate} 기준 | 전체 등록자 {registrationsCount}명
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    onClick={onBulkCheckOut}
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
                        onChange={(e) => onSelectedDateChange(e.target.value)}
                        className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <Button onClick={onRefresh} variant="outline" size="icon" className="h-9 w-9">
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};
