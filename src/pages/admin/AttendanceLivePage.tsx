import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, Timestamp, addDoc, increment, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Loader2, LogIn, LogOut, RefreshCw, CheckCircle, FileText, X, Search, Clock, MapPin, Calendar, AlertCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface BreakTime {
    label: string;
    start: string;
    end: string;
}
interface ZoneRule {
    id: string;
    name: string;
    start: string;
    end: string;
    goalMinutes: number;
    breaks: BreakTime[];
}
interface DailyRule {
    date: string;
    globalGoalMinutes: number;
    zones: ZoneRule[];
}

interface Registration {
    id: string;
    userName: string;
    userEmail: string;
    attendanceStatus: 'INSIDE' | 'OUTSIDE' | null;
    currentZone: string | null;
    lastCheckIn?: Timestamp;
    totalMinutes: number;
    isCompleted: boolean;
    slug: string;
    affiliation?: string;
}

interface LogEntry {
    id: string;
    type: 'ENTER' | 'EXIT';
    timestamp: Timestamp;
    zoneId: string;
    rawDuration?: number;
    deduction?: number;
    recognizedMinutes?: number;
    method?: string;
}

const AttendanceLivePage: React.FC = () => {
    const { cid } = useParams<{ cid: string }>();
    console.log('[AttendanceLive] Component rendered, cid:', cid);

    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [loading, setLoading] = useState(true);
    const [rules, setRules] = useState<DailyRule | null>(null);
    const [zones, setZones] = useState<ZoneRule[]>([]);

    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [searchTerm, setSearchTerm] = useState<string>('');

    const [showLogModal, setShowLogModal] = useState(false);
    const [selectedRegForLog, setSelectedRegForLog] = useState<Registration | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        if (!cid) return;
        const fetchDates = async () => {
            const confRef = doc(db, 'conferences', cid);
            const confSnap = await getDoc(confRef);
            if (confSnap.exists()) {
                const data = confSnap.data();
                const start = (data.dates?.start || data.startDate)?.toDate();
                const end = (data.dates?.end || data.endDate)?.toDate();
                if (start && end) {
                    const list = [];
                    const curr = new Date(start);
                    while (curr <= end) {
                        list.push(curr.toISOString().split('T')[0]);
                        curr.setDate(curr.getDate() + 1);
                    }
                    setAvailableDates(list);
                    const today = new Date().toISOString().slice(0, 10);
                    if (!list.includes(today) && list.length > 0) {
                        setSelectedDate(list[0]);
                    }
                }
            }
        };
        fetchDates();
    }, [cid]);

    const refreshData = useCallback(async () => {
        if (!cid || !cid) return;
        setLoading(true);
        try {
            console.log('[AttendanceLive] Loading data for conference:', cid);

            const rulesRef = doc(db, `conferences/${cid}/settings/attendance`);
            const rulesSnap = await getDoc(rulesRef);
            if (rulesSnap.exists()) {
                const allRules = rulesSnap.data().rules || {};
                const targetRule = allRules[selectedDate];
                setRules(targetRule || null);
                if (targetRule) setZones(targetRule.zones || []);
                else setZones([]);
            }

            console.log('[AttendanceLive] Querying registrations...');
            // 임시: 인덱스 문제 확인을 위해 badgeQr 조건 제외
            const q = query(
                collection(db, 'conferences', cid, 'registrations'),
                where('paymentStatus', '==', 'PAID')
            );
            const snap = await getDocs(q);
            console.log('[AttendanceLive] Query result:', snap.docs.length, 'documents');

            // 클라이언트에서 필터링: 디지털명찰 발급자만
            // badgeQr 또는 badgeIssued가 있으면 발급된 것으로 간주
            const filteredData = snap.docs
                .filter(d => {
                    const docData = d.data();
                    console.log('[AttendanceLive] Registration doc:', d.id, 'badgeQr:', docData.badgeQr, 'badgeIssued:', docData.badgeIssued);
                    return !!docData.badgeQr || docData.badgeIssued === true;
                })
                .map(d => {
                    const docData = d.data();
                    // userInfo를 top level로 flatten (RegistrationListPage와 동일하게)
                    const flattened = {
                        id: d.id,
                        ...docData,
                        totalMinutes: docData.totalMinutes || 0,
                        attendanceStatus: docData.attendanceStatus || 'OUTSIDE'
                    } as Registration;

                    if (docData.userInfo) {
                        flattened.userName = docData.userInfo.name || docData.userName;
                        flattened.userEmail = docData.userInfo.email || docData.userEmail;
                        flattened.affiliation = docData.userInfo.affiliation || docData.affiliation;
                    }

                    return flattened;
                }) as Registration[];
            console.log('[AttendanceLive] Filtered to badge-issued:', filteredData.length, 'registrations');

            filteredData.sort((a, b) => {
                if (a.attendanceStatus === 'INSIDE' && b.attendanceStatus !== 'INSIDE') return -1;
                if (a.attendanceStatus !== 'INSIDE' && b.attendanceStatus === 'INSIDE') return 1;
                return a.userName.localeCompare(b.userName);
            });

            setRegistrations(filteredData);
            console.log('[AttendanceLive] Data loaded successfully:', filteredData.length, 'registrations');
        } catch (error) {
            console.error('[AttendanceLive] Error details:', error);
            console.error('[AttendanceLive] Error stack:', error instanceof Error ? error.stack : 'No stack');
            toast.error(`Failed to load data: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLoading(false);
        }
    }, [cid, cid, selectedDate]);

    useEffect(() => {
        console.log('[AttendanceLive] useEffect triggered, cid:', cid, 'selectedDate:', selectedDate);
        refreshData();
    }, [cid, selectedDate, refreshData]);

    const handleCheckIn = async (regId: string, zoneId: string) => {
        try {
            const reg = registrations.find(r => r.id === regId);

            if (reg?.attendanceStatus === 'INSIDE' && reg.currentZone) {
                if (reg.currentZone === zoneId) {
                    toast.error("Already checked in to this zone.");
                    return;
                }
                await handleCheckOut(regId, reg.currentZone, reg.lastCheckIn, true); // Silent checkout for switch
            }

            const regRef = doc(db, 'conferences', cid!, 'registrations', regId);
            const now = Timestamp.now();

            await updateDoc(regRef, {
                attendanceStatus: 'INSIDE',
                currentZone: zoneId,
                lastCheckIn: now
            });

            await addDoc(collection(db, 'conferences', cid!, 'registrations', regId, 'logs'), {
                type: 'ENTER',
                zoneId,
                timestamp: now,
                method: 'MANUAL_ADMIN'
            });

            toast.success("입장 처리됨 (Checked In)");
            refreshData();
        } catch {
            toast.error("Check-in failed");
        }
    };

    const handleCheckOut = async (regId: string, currentZoneId: string | null, lastCheckIn: Timestamp | undefined, isSwitching = false) => {
        if (!lastCheckIn || !rules) {
            toast.error("체크인 정보가 없거나 규칙이 로드되지 않았습니다.");
            return;
        }

        try {
            const now = new Date();
            const checkInTime = lastCheckIn.toDate();

            let durationMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / 60000);
            if (durationMinutes < 0) durationMinutes = 0;

            const zoneRule = zones.find(z => z.id === currentZoneId);
            let deduction = 0;

            if (zoneRule && zoneRule.breaks) {
                zoneRule.breaks.forEach(brk => {
                    const breakStart = new Date(`${selectedDate}T${brk.start}:00`);
                    const breakEnd = new Date(`${selectedDate}T${brk.end}:00`);
                    const overlapStart = Math.max(checkInTime.getTime(), breakStart.getTime());
                    const overlapEnd = Math.min(now.getTime(), breakEnd.getTime());
                    if (overlapEnd > overlapStart) {
                        const overlapMins = Math.floor((overlapEnd - overlapStart) / 60000);
                        deduction += overlapMins;
                    }
                });
            }

            const finalMinutes = Math.max(0, durationMinutes - deduction);
            const regRef = doc(db, 'conferences', cid!, 'registrations', regId);

            const goal = (zoneRule?.goalMinutes && zoneRule.goalMinutes > 0)
                ? zoneRule.goalMinutes
                : rules.globalGoalMinutes;

            const currentTotal = registrations.find(r => r.id === regId)?.totalMinutes || 0;
            const newTotal = currentTotal + finalMinutes;
            const isCompleted = newTotal >= goal;

            await updateDoc(regRef, {
                attendanceStatus: 'OUTSIDE',
                currentZone: null,
                totalMinutes: increment(finalMinutes),
                isCompleted: isCompleted,
                lastCheckOut: Timestamp.now()
            });

            await addDoc(collection(db, 'conferences', cid!, 'registrations', regId, 'logs'), {
                type: 'EXIT',
                zoneId: currentZoneId,
                timestamp: Timestamp.now(),
                method: 'MANUAL_ADMIN',
                rawDuration: durationMinutes,
                deduction,
                recognizedMinutes: finalMinutes
            });

            if (!isSwitching) {
                toast.success(`퇴장 완료 (+${finalMinutes}분 인정)`);
                refreshData();
            }
        } catch {
            toast.error("Check-out failed");
        }
    };

    const openLogs = async (reg: Registration) => {
        setSelectedRegForLog(reg);
        setShowLogModal(true);
        setLogs([]);
        try {
            const q = query(collection(db, 'conferences', cid!, 'registrations', reg.id, 'logs'), orderBy('timestamp', 'desc'));
            const snap = await getDocs(q);
            const loadedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as LogEntry[];
            setLogs(loadedLogs);
        } catch {
            toast.error("기록을 불러오지 못했습니다.");
        }
    };

    const filteredRegistrations = useMemo(() => {
        if (!searchTerm) return registrations;
        const lower = searchTerm.toLowerCase();
        return registrations.filter(r =>
            r.userName.toLowerCase().includes(lower) ||
            r.userEmail.toLowerCase().includes(lower) ||
            r.affiliation?.toLowerCase().includes(lower)
        );
    }, [registrations, searchTerm]);

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

            <div className="flex-1 overflow-hidden p-6 space-y-6 flex flex-col">

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="shadow-sm border-slate-200 bg-white">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    일일 목표 시간
                                </span>
                                <div className="text-2xl font-bold text-slate-900">
                                    {rules?.globalGoalMinutes || 0} <span className="text-sm font-normal text-slate-400">분</span>
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
                        <div className="col-span-2 text-right px-4">누적 시간</div>
                        <div className="col-span-3 text-right">관리 작업</div>
                    </div>

                    {/* Table Body - Virtualized-ish Scroll */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredRegistrations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                                <Search className="w-8 h-8 opacity-50" />
                                <p className="text-sm">검색 결과가 없습니다.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredRegistrations.map(r => (
                                    <div key={r.id} className={cn(
                                        "grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors hover:bg-slate-50/50",
                                        r.attendanceStatus === 'INSIDE' && "bg-blue-50/30"
                                    )}>
                                        {/* User Info */}
                                        <div className="col-span-3 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-900 truncate">{r.userName}</span>
                                                {r.isCompleted && (
                                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
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
                                        <div className="col-span-2 text-right px-4">
                                            <div className="font-mono text-lg font-bold text-slate-800 leading-none">
                                                {r.totalMinutes}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">MINUTES</div>
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
                                                onClick={() => openLogs(r)}
                                            >
                                                <FileText className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Log Modal */}
            {showLogModal && selectedRegForLog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">{selectedRegForLog.userName}</h3>
                                <p className="text-xs text-slate-500 mt-0.5 font-mono">{selectedRegForLog.userEmail}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowLogModal(false)} className="rounded-full hover:bg-slate-200/50">
                                <X className="w-5 h-5 text-slate-500" />
                            </Button>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1 bg-white">
                            {logs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                                    <Clock className="w-10 h-10 opacity-20" />
                                    <p className="text-sm">출결 기록이 없습니다.</p>
                                </div>
                            ) : (
                                <div className="relative p-6 space-y-8">
                                    <div className="absolute left-[29px] top-6 bottom-6 w-0.5 bg-slate-100" />

                                    {logs.map((log) => (
                                        <div key={log.id} className="relative flex gap-5 group">
                                            {/* Timeline Dot */}
                                            <div className={cn(
                                                "relative z-10 w-2.5 h-2.5 rounded-full mt-1.5 ring-4 ring-white flex-shrink-0",
                                                log.type === 'ENTER' ? "bg-blue-500" : "bg-slate-400"
                                            )} />

                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className={cn(
                                                            "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border mb-1 inline-block",
                                                            log.type === 'ENTER' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-50 text-slate-500 border-slate-100"
                                                        )}>
                                                            {log.type}
                                                        </span>
                                                        <div className="font-semibold text-slate-800 text-sm mt-0.5">
                                                            {zones.find(z => z.id === log.zoneId)?.name || log.zoneId || 'Unknown Zone'}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-slate-400 font-mono">
                                                        {log.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {log.type === 'EXIT' && (
                                                    <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs space-y-2">
                                                        <div className="flex justify-between text-slate-500">
                                                            <span>체류 시간 (Raw)</span>
                                                            <span className="font-mono">{log.rawDuration}분</span>
                                                        </div>
                                                        <div className="flex justify-between text-red-400">
                                                            <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> 휴게 차감</span>
                                                            <span className="font-mono">-{log.deduction}분</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold text-blue-600 text-sm">
                                                            <span>최종 인정</span>
                                                            <span className="font-mono text-base">{log.recognizedMinutes}m</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceLivePage;
