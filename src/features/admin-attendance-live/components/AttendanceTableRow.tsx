import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, MapPin, FileText, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Registration, ZoneRule } from '../types';
import { calculateAttendanceMinutes } from '../utils/attendanceCalculator';

interface AttendanceTableRowProps {
    r: Registration;
    zones: ZoneRule[];
    currentTime: Date;
    selectedDate: string;
    onCheckIn: (regId: string, zoneId: string) => void;
    onCheckOut: (regId: string, currentZoneId: string | null, lastCheckIn: any) => void;
    onOpenLogs: (reg: Registration) => void;
    onUpdateTotalMinutes: (reg: Registration, newTotal: number) => void;
}

export const AttendanceTableRow = React.memo<AttendanceTableRowProps>(({
    r,
    zones,
    currentTime,
    selectedDate,
    onCheckIn,
    onCheckOut,
    onOpenLogs,
    onUpdateTotalMinutes
}) => {
    let displayTotal = r.totalMinutes;
    let isLive = false;

    if (r.attendanceStatus === 'INSIDE' && r.lastCheckIn) {
        const checkInTime = r.lastCheckIn.toDate ? r.lastCheckIn.toDate() : new Date();
        const rZoneRule = zones.find(z => z.id === r.currentZone);

        const { finalMinutes } = calculateAttendanceMinutes(
            checkInTime,
            currentTime,
            rZoneRule,
            selectedDate
        );

        displayTotal = r.totalMinutes + finalMinutes;
        isLive = true;
    }

    return (
        <div className={cn(
            "grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors hover:bg-slate-50/50",
            r.attendanceStatus === 'INSIDE' && "bg-blue-50/30"
        )}>
            {/* User Info */}
            <div className="col-span-3 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 truncate">{r.userName}</span>
                    {zones.length <= 1 ? (
                        r.isCompleted && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                        <div className="flex gap-1">
                            {zones.map(z => {
                                const done = r.zoneCompleted?.[z.id] === true;
                                return (
                                    <span key={z.id} className={cn(
                                        "text-[10px] px-1 py-0.5 rounded font-medium",
                                        done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                                    )} title={`${z.name}: ${done ? '완료' : '진행중'}`}>
                                        {z.name.slice(0, 2)}{done ? '✓' : '…'}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="text-xs text-slate-500 truncate" title={r.affiliation || r.userEmail}>
                    {r.affiliation || r.userEmail}
                </div>
            </div>

            {/* Status */}
            <div className="col-span-2 flex justify-center">
                {r.attendanceStatus === 'INSIDE' ? (
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 px-3 py-1 shadow-sm gap-1.5 animate-pulse">
                        <LogIn className="w-3 h-3" /> INSIDE
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 px-3 py-1 gap-1.5">
                        <LogOut className="w-3 h-3" /> OUTSIDE
                    </Badge>
                )}
            </div>

            {/* Current Zone */}
            <div className="col-span-2">
                {r.currentZone ? (
                    <div className="text-sm font-medium text-blue-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {zones.find(z => z.id === r.currentZone)?.name || 'Unknown'}
                    </div>
                ) : (
                    <span className="text-slate-300 text-sm">-</span>
                )}
            </div>

            {/* Total Time */}
            <div className="col-span-2 text-right px-4 flex flex-col items-end">
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-auto p-1 font-mono text-lg font-bold leading-none hover:bg-blue-50 transition-colors",
                        isLive ? "text-purple-600" : "text-slate-800"
                    )}
                    onClick={() => {
                        const newVal = prompt(`${r.userName}님의 누적 시간을 수정하시겠습니까? (단위: 분)`, String(r.totalMinutes));
                        if (newVal !== null) {
                            const mins = parseInt(newVal);
                            if (!isNaN(mins)) {
                                onUpdateTotalMinutes(r, mins);
                            }
                        }
                    }}
                >
                    {displayTotal}
                </Button>
                <div className={cn(
                    "text-[10px] mt-0.5 font-bold px-1 rounded",
                    isLive ? "text-purple-400 bg-purple-50 animate-pulse" : "text-slate-400"
                )}>
                    {isLive ? 'LIVE (MINS)' : 'FINAL MINS'}
                </div>
            </div>

            {/* Actions */}
            <div className="col-span-3 flex justify-end items-center gap-2">
                {r.attendanceStatus === 'INSIDE' ? (
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onCheckOut(r.id, r.currentZone, r.lastCheckIn)}
                        className="h-8 px-4 shadow-sm"
                    >
                        <LogOut className="w-3.5 h-3.5 mr-1.5" /> 퇴장
                    </Button>
                ) : (
                    <div className="flex gap-1.5 flex-wrap justify-end">
                        {zones.map(z => (
                            <Button
                                key={z.id}
                                size="sm"
                                variant="outline"
                                onClick={() => onCheckIn(r.id, z.id)}
                                className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-300 flex-shrink-0"
                            >
                                {z.name}
                            </Button>
                        ))}
                        {zones.length === 0 && <span className="text-xs text-red-300">No Zone</span>}
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full"
                    onClick={() => onOpenLogs(r)}
                >
                    <FileText className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
});
