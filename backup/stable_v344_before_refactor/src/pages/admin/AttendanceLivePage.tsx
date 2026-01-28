import React, { useState, useEffect } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, Timestamp, addDoc, increment, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Loader2, LogIn, LogOut, RefreshCw, CheckCircle, Clock, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';

// Re-use types from Settings
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
    slug: string; // Ensure we filter by slug
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
    const { selectedConferenceId, selectedConferenceSlug } = useAdminStore();
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [loading, setLoading] = useState(true);
    const [rules, setRules] = useState<DailyRule | null>(null);
    const [zones, setZones] = useState<ZoneRule[]>([]);
    
    // [Fix-Step 157] Date Selector
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

    // Log Modal
    const [showLogModal, setShowLogModal] = useState(false);
    const [selectedRegForLog, setSelectedRegForLog] = useState<Registration | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    // 0. Initialize Dates
    useEffect(() => {
        if (!selectedConferenceId) return;
        const fetchDates = async () => {
             const confRef = doc(db, 'conferences', selectedConferenceId);
             const confSnap = await getDoc(confRef);
             if (confSnap.exists()) {
                 const data = confSnap.data();
                 const start = data.startDate?.toDate();
                 const end = data.endDate?.toDate();
                 if (start && end) {
                     const list = [];
                     const curr = new Date(start);
                     while (curr <= end) {
                         list.push(curr.toISOString().split('T')[0]);
                         curr.setDate(curr.getDate() + 1);
                     }
                     setAvailableDates(list);
                     // If today is in range, keep today, else use first day
                     const today = new Date().toISOString().slice(0, 10);
                     if (!list.includes(today) && list.length > 0) {
                         setSelectedDate(list[0]);
                     }
                 }
             }
        };
        fetchDates();
    }, [selectedConferenceId]);

    // 1. Fetch Rules & Registrations
    const refreshData = async () => {
        if (!selectedConferenceId || !selectedConferenceSlug) return;
        setLoading(true);
        try {
            // A. Fetch Rules for SELECTED DATE
            const rulesRef = doc(db, `conferences/${selectedConferenceId}/settings/attendance`);
            const rulesSnap = await getDoc(rulesRef);
            if (rulesSnap.exists()) {
                const allRules = rulesSnap.data().rules || {};
                const targetRule = allRules[selectedDate];
                setRules(targetRule || null);
                if (targetRule) setZones(targetRule.zones || []);
                else setZones([]); // Clear if no rule for date
            }

            // B. Fetch Registrations (PAID only)
            const q = query(
                collection(db, 'registrations'), 
                where('slug', '==', selectedConferenceSlug),
                where('status', '==', 'PAID')
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ 
                id: d.id, 
                ...d.data(),
                totalMinutes: d.data().totalMinutes || 0,
                attendanceStatus: d.data().attendanceStatus || 'OUTSIDE'
            })) as Registration[];
            
            // Sort: INSIDE first, then Name
            data.sort((a, b) => {
                if (a.attendanceStatus === 'INSIDE' && b.attendanceStatus !== 'INSIDE') return -1;
                if (a.attendanceStatus !== 'INSIDE' && b.attendanceStatus === 'INSIDE') return 1;
                return a.userName.localeCompare(b.userName);
            });

            setRegistrations(data);
        } catch (e) {
            console.error("Fetch Error:", e);
            toast.error("Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, [selectedConferenceId, selectedDate]); // Trigger on date change

    // 2. Action: Check-In (Enforce Single Zone)
    const handleCheckIn = async (regId: string, zoneId: string) => {
        try {
            // Find existing status from local state for immediate feedback/logic
            const reg = registrations.find(r => r.id === regId);
            
            // IF ALREADY INSIDE A DIFFERENT ZONE -> SWITCH (Checkout first)
            if (reg?.attendanceStatus === 'INSIDE' && reg.currentZone) {
                if (reg.currentZone === zoneId) {
                    toast.error("Already checked in to this zone.");
                    return;
                }

                // Auto-Checkout previous session
                const oldZoneName = zones.find(z => z.id === reg.currentZone)?.name || 'Unknown';
                const newZoneName = zones.find(z => z.id === zoneId)?.name || 'Unknown';
                
                toast(`Zone Switching: ${oldZoneName} -> ${newZoneName}`, { icon: '🔄' });
                
                // Call checkout logic (await it)
                await handleCheckOut(regId, reg.currentZone, reg.lastCheckIn);
                
                // Proceed to check-in to new zone
            }

            const regRef = doc(db, 'registrations', regId);
            const now = Timestamp.now();
            
            await updateDoc(regRef, {
                attendanceStatus: 'INSIDE',
                currentZone: zoneId,
                lastCheckIn: now
            });

            // Log
            await addDoc(collection(db, `registrations/${regId}/logs`), {
                type: 'ENTER',
                zoneId,
                timestamp: now,
                method: 'MANUAL_ADMIN'
            });

            toast.success("입장 처리됨 (Checked In)");
            refreshData(); 
        } catch (e) {
            console.error("Check-in failed:", e);
            toast.error("Check-in failed");
        }
    };

    // 3. Action: Check-Out (Calculation Engine)
    const handleCheckOut = async (regId: string, currentZoneId: string | null, lastCheckIn: Timestamp | undefined) => {
        if (!lastCheckIn || !rules) {
            toast.error("체크인 정보가 없거나 규칙이 로드되지 않았습니다.");
            return;
        }

        try {
            const now = new Date();
            const checkInTime = lastCheckIn.toDate();
            
            // Raw Duration (Minutes)
            let durationMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / 60000);
            if (durationMinutes < 0) durationMinutes = 0;

            // Find Zone Rules for Breaks
            const zoneRule = zones.find(z => z.id === currentZoneId);
            let deduction = 0;

            if (zoneRule && zoneRule.breaks) {
                zoneRule.breaks.forEach(brk => {
                    // Parse Break Times (Today + HH:MM)
                    // USE SELECTED DATE, NOT TODAY
                    const breakStart = new Date(`${selectedDate}T${brk.start}:00`);
                    const breakEnd = new Date(`${selectedDate}T${brk.end}:00`);

                    // Check Overlap
                    const overlapStart = Math.max(checkInTime.getTime(), breakStart.getTime());
                    const overlapEnd = Math.min(now.getTime(), breakEnd.getTime());
                    
                    if (overlapEnd > overlapStart) {
                        const overlapMins = Math.floor((overlapEnd - overlapStart) / 60000);
                        deduction += overlapMins;
                    }
                });
            }

            const finalMinutes = Math.max(0, durationMinutes - deduction);

            // Update Doc
            const regRef = doc(db, 'registrations', regId);
            
            // Check Completion Goal
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

             // Log
             await addDoc(collection(db, `registrations/${regId}/logs`), {
                type: 'EXIT',
                zoneId: currentZoneId,
                timestamp: Timestamp.now(),
                method: 'MANUAL_ADMIN',
                rawDuration: durationMinutes,
                deduction,
                recognizedMinutes: finalMinutes
            });

            toast.success(`퇴장 완료 (+${finalMinutes}분 인정)`);
            refreshData();

        } catch (e) {
            console.error("Check-out failed:", e);
            toast.error("Check-out failed");
        }
    };

    // 4. Log Viewer
    const openLogs = async (reg: Registration) => {
        setSelectedRegForLog(reg);
        setShowLogModal(true);
        setLogs([]);
        try {
            const q = query(collection(db, `registrations/${reg.id}/logs`), orderBy('timestamp', 'desc'));
            const snap = await getDocs(q);
            const loadedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as LogEntry[];
            setLogs(loadedLogs);
        } catch (e) {
            console.error("Failed to load logs", e);
            toast.error("기록을 불러오지 못했습니다.");
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">실시간 출결 현황 (Live Attendance)</h1>
                    <p className="text-gray-500 mt-1">
                        목표 이수 시간: {rules?.globalGoalMinutes || 0}분 (Date: {selectedDate})
                    </p>
                </div>
                <div className="flex gap-2">
                    <select 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="border p-2 rounded"
                    >
                        {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <Button onClick={refreshData} variant="outline" className="gap-2">
                        <RefreshCw className="w-4 h-4" /> 새로고침
                    </Button>
                </div>
            </div>

            {/* Zone Selector for Manual Check-In */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                <h3 className="font-bold text-blue-900 mb-2">입장 가능한 Zone ({selectedDate})</h3>
                <div className="flex gap-2 flex-wrap">
                    {zones.length === 0 && <span className="text-gray-500 text-sm">설정된 Zone이 없습니다. 설정 페이지에서 날짜와 규칙을 확인해주세요.</span>}
                    {zones.map(z => (
                        <Badge key={z.id} variant="secondary" className="px-3 py-1 bg-white border">
                            {z.name} ({z.start}~{z.end})
                        </Badge>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-medium text-gray-600">이름 / 소속</th>
                            <th className="p-4 font-medium text-gray-600">상태</th>
                            <th className="p-4 font-medium text-gray-600">현재 위치</th>
                            <th className="p-4 font-medium text-gray-600">누적 시간</th>
                            <th className="p-4 font-medium text-gray-600">이수 여부</th>
                            <th className="p-4 font-medium text-gray-600">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {registrations.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50">
                                <td className="p-4">
                                    <div className="font-bold">{r.userName}</div>
                                    <div className="text-xs text-gray-500">{r.affiliation || r.userEmail}</div>
                                </td>
                                <td className="p-4">
                                    {r.attendanceStatus === 'INSIDE' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold animate-pulse">
                                            <LogIn className="w-3 h-3" /> 입장중
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                                            <LogOut className="w-3 h-3" /> 퇴장
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-sm">
                                    {r.currentZone ? (
                                        <span className="font-mono text-blue-600">
                                            {zones.find(z => z.id === r.currentZone)?.name || 'Unknown Zone'}
                                        </span>
                                    ) : '-'}
                                </td>
                                <td className="p-4 font-mono font-bold text-lg">
                                    {r.totalMinutes} <span className="text-xs font-normal text-gray-500">분</span>
                                </td>
                                <td className="p-4">
                                    {r.isCompleted ? (
                                        <span className="text-green-600 flex items-center gap-1 font-bold">
                                            <CheckCircle className="w-4 h-4" /> 이수완료
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 text-sm">진행중</span>
                                    )}
                                </td>
                                <td className="p-4 flex gap-2">
                                    {r.attendanceStatus === 'INSIDE' ? (
                                        <Button 
                                            size="sm" 
                                            variant="destructive" 
                                            onClick={() => handleCheckOut(r.id, r.currentZone, r.lastCheckIn)}
                                            className="w-20"
                                        >
                                            퇴장 처리
                                        </Button>
                                    ) : (
                                        <div className="flex gap-1">
                                            {zones.map(z => (
                                                <Button 
                                                    key={z.id}
                                                    size="sm" 
                                                    variant="outline"
                                                    onClick={() => handleCheckIn(r.id, z.id)}
                                                    className="text-xs h-8"
                                                >
                                                    {z.name} 입장
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => openLogs(r)}>
                                        <FileText className="w-4 h-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* LOG MODAL */}
            {showLogModal && selectedRegForLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg">출결 기록 상세: {selectedRegForLog.userName}</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowLogModal(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {logs.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">기록이 없습니다.</p>
                            ) : (
                                <div className="space-y-4">
                                    {logs.map(log => (
                                        <div key={log.id} className="flex gap-4 border-l-2 border-gray-200 pl-4 pb-4 relative">
                                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ${log.type === 'ENTER' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${log.type === 'ENTER' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                                        {log.type === 'ENTER' ? '입장 (Check-In)' : '퇴장 (Check-Out)'}
                                                    </span>
                                                    <span className="text-xs text-gray-400 font-mono">
                                                        {log.timestamp?.toDate().toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-sm">
                                                    Zone: <span className="font-semibold">{zones.find(z => z.id === log.zoneId)?.name || log.zoneId || 'Unknown'}</span>
                                                </div>
                                                {log.type === 'EXIT' && (
                                                    <div className="mt-2 bg-gray-50 p-2 rounded text-xs text-gray-600 font-mono">
                                                        <p>⏱️ 체류시간: {log.rawDuration}분</p>
                                                        <p>🛑 휴게차감: -{log.deduction}분</p>
                                                        <p className="font-bold text-blue-600 border-t border-gray-200 mt-1 pt-1">
                                                            ✅ 인정시간: {log.recognizedMinutes}분
                                                        </p>
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
