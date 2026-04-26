import React from 'react';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { LogIn, LogOut, CheckCircle, FileText, Search, Clock, MapPin, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getKstToday } from '@/utils/dateUtils';
import type { Registration, ZoneRule } from '@/hooks/useAttendanceLive';

interface AttendanceTableProps {
    registrations: Registration[];
    zones: ZoneRule[];
    selectedDate: string;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    handleCheckIn: (regId: string, zoneId: string, checkInAt?: Date) => Promise<void>;
    handleCheckOut: (regId: string, currentZoneId: string | null, lastCheckIn: Timestamp | undefined) => Promise<void>;
    openLogs: (reg: Registration) => void;
    openAdjust: (reg: Registration) => void;
    goalMinutes: number;
    goalLabel: string;
    currentTime: Date;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
    registrations,
    zones,
    selectedDate,
    searchTerm,
    setSearchTerm,
    handleCheckIn,
    handleCheckOut,
    openLogs,
    openAdjust,
    goalMinutes,
    goalLabel,
    currentTime,
}) => {
    return (
        <div className="flex-1 overflow-hidden p-6 space-y-6 flex flex-col">

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="shadow-sm border-slate-200 bg-white">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                {goalLabel}
                            </span>
                            <div className="text-2xl font-bold text-slate-900">
                                {goalMinutes} <span className="text-sm font-normal text-slate-400">분</span>
                            </div>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 bg-white">
                    <CardContent className="p-4">
                        <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5 mb-2">
                            <MapPin className="w-4 h-4" />
                            입장 가능 Zone ({zones.length})
                        </span>
                        <div className="flex gap-2 flex-wrap">
                            {zones.length === 0 && <span className="text-xs text-slate-400">설정된 Zone이 없습니다.</span>}
                            {zones.map(z => (
                                <Badge key={z.id} variant="secondary" className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 font-normal">
                                    <span className="font-semibold">{z.name}</span>
                                    <span className="mx-1.5 text-slate-300">|</span>
                                    {z.start}~{z.end}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter & Table Container */}
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
                    <div className="col-span-2 text-right px-4">오늘 / 누적</div>
                    <div className="col-span-3 text-right">관리 작업</div>
                </div>

                {/* Table Body - Virtualized-ish Scroll */}
                <div className="flex-1 overflow-y-auto">
                    {registrations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                            <Search className="w-8 h-8 opacity-50" />
                            <p className="text-sm">검색 결과가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {registrations.map(r => {
                                // Calculate live minutes if INSIDE
                                let displayTotal = r.totalMinutes;
                                let isLive = false;

                                if (r.attendanceStatus === 'INSIDE' && r.lastCheckIn) {
                                    const checkInTime = r.lastCheckIn.toDate ? r.lastCheckIn.toDate() : new Date();

                                    let diffMins = 0;
                                    let liveDeduction = 0;
                                    let boundedStart = checkInTime;
                                    let boundedEnd = currentTime;

                                    const checkInDateStr = getKstToday(checkInTime);
                                    const rZoneRule = zones.find(z => z.id === r.currentZone && z.ruleDate === checkInDateStr) || zones.find(z => z.id === r.currentZone);
                                    const rZoneDateStr = rZoneRule?.ruleDate || checkInDateStr;

                                    if (rZoneRule && rZoneRule.start && rZoneRule.end) {
                                        const sessionStart = new Date(`${rZoneDateStr}T${rZoneRule.start}:00+09:00`);
                                        const sessionEnd = new Date(`${rZoneDateStr}T${rZoneRule.end}:00+09:00`);

                                        boundedStart = new Date(Math.max(checkInTime.getTime(), sessionStart.getTime()));
                                        boundedEnd = new Date(Math.min(currentTime.getTime(), sessionEnd.getTime()));
                                    }

                                    if (boundedEnd > boundedStart) {
                                        diffMins = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);

                                        if (rZoneRule && rZoneRule.breaks) {
                                            rZoneRule.breaks.forEach(brk => {
                                                const breakStart = new Date(`${selectedDate}T${brk.start}:00+09:00`);
                                                const breakEnd = new Date(`${selectedDate}T${brk.end}:00+09:00`);
                                                const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
                                                const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
                                                if (overlapEnd > overlapStart) {
                                                    liveDeduction += Math.floor((overlapEnd - overlapStart) / 60000);
                                                }
                                            });
                                        }
                                    }

                                    displayTotal = r.totalMinutes + Math.max(0, diffMins - liveDeduction);
                                    isLive = true;
                                }

                                const liveSessionMinutes = isLive ? Math.max(0, displayTotal - r.totalMinutes) : 0;
                                const todayMinutes = Number(r.dailyMinutes?.[selectedDate] || 0) + liveSessionMinutes;
                                const remainingMinutes = goalMinutes > 0 ? Math.max(0, goalMinutes - displayTotal) : 0;

                                return (
                                    <div key={r.id} className={cn(
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
                                                onClick={() => openAdjust(r)}
                                            >
                                                {displayTotal}
                                            </Button>
                                            <div className="mt-1 text-[10px] font-bold text-slate-500 flex items-center gap-2">
                                                <span className="text-indigo-600">{todayMinutes}m</span>
                                                <span className="text-slate-300">|</span>
                                                <span className="text-emerald-700">{remainingMinutes}m</span>
                                            </div>
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
                                                    onClick={() => handleCheckOut(r.id, r.currentZone, r.lastCheckIn)}
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
                                                            onClick={() => handleCheckIn(r.id, z.id)}
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
                                                onClick={() => openAdjust(r)}
                                            >
                                                <Settings className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full"
                                                onClick={() => openLogs(r)}
                                            >
                                                <FileText className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
