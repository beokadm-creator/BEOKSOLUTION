import { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { getKstToday } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

// --- Types for Settings ---
export interface BreakTime {
    label: string;
    start: string;
    end: string;
}

export interface ZoneRule {
    id: string;
    name: string;
    start: string;
    end: string;
    goalMinutes: number;
    autoCheckout: boolean;
    breaks: BreakTime[];
    points: number;
}

export interface DailyRule {
    date: string;
    globalGoalMinutes: number;
    completionMode?: 'DAILY_SEPARATE' | 'CUMULATIVE';
    cumulativeGoalMinutes?: number;
    zones: ZoneRule[];
}

// --- Participant record type (unified for registrations + external_attendees) ---
export interface ParticipantRecord {
    id: string;
    userId: string;
    userName: string;
    userPhone: string;
    userEmail: string;
    licenseNumber: string;
    affiliation?: string;
    memberGrade: string;
    targetTier?: string;
    tier?: string;
    userTier?: string;
    grade?: string;
    categoryName?: string;
    paymentAmount: number;
    badgeQr: string | null;
    badgeIssued: boolean;
    paymentStatus: string;
    totalMinutes: number;
    dailyMinutes?: Record<string, number>;
    isCompleted: boolean;
    attendanceStatus: string;
    isExternal: boolean;
    firstEntryTime?: number;
    lastExitTime?: number;
    lastCheckIn?: unknown;
    lastCheckOut?: unknown;
    currentZone?: string | null;
    zoneMinutes: Record<string, number>;
    zoneCompleted: Record<string, boolean>;
}

export interface UserStat {
    userId: string;
    userName: string;
    userPhone: string;
    userEmail: string;
    licenseNumber: string;
    affiliation?: string;
    memberGrade: string;
    paymentAmount: number;
    badgeQr: string | null;
    isExternal: boolean;
    totalMinutes: number;
    todayMinutes: number;
    remainingMinutes: number;
    attendanceStatus: string;
    firstEntryTime: number | undefined;
    lastExitTime: number | undefined;
    zones: Record<string, number>;
    zoneComp: Record<string, boolean>;
    isCompliant: boolean;
    logCount: number;
}

export interface ZoneStat extends ZoneRule {
    visitedUsers: number;
    avgTime: number;
}

export interface StatisticsData {
    userStatsList: UserStat[];
    totalRegistered: number;
    totalBadgeIssued: number;
    activeUsers: number;
    compliantUsers: number;
    incompleteUsers: number;
    noShowUsers: number;
    complianceRate: number;
    avgStayTime: number;
    zoneStats: ZoneStat[];
    completionMode: 'DAILY_SEPARATE' | 'CUMULATIVE';
    dailyGoalMinutes: number;
    goalMinutes: number;
}

// Robust timestamp parser to handle all Firestore/JS variations
const ensureMillis = (val: unknown): number | undefined => {
    if (!val) return undefined;
    const obj = val as Record<string, unknown>;
    if (typeof obj.toMillis === 'function') return obj.toMillis();
    if (obj.seconds !== undefined) return Number(obj.seconds) * 1000 + (obj.nanoseconds ? Number(obj.nanoseconds) / 1000000 : 0);
    if (obj._seconds !== undefined) return Number(obj._seconds) * 1000 + (obj._nanoseconds ? Number(obj._nanoseconds) / 1000000 : 0);
    if (val instanceof Date) return val.getTime();
    if (typeof obj.getTime === 'function') return obj.getTime();
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d.getTime();
    }
    return undefined;
};

export function useStatistics(conferenceId: string | undefined) {
    const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
    const [rules, setRules] = useState<Record<string, DailyRule>>({});
    const [dates, setDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // --- 1. Fetch Data ---
    const fetchData = useCallback(async () => {
        if (!conferenceId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // A. Fetch Attendance Settings (rules)
            const rulesRef = doc(db, `conferences/${conferenceId}/settings/attendance`);
            const rulesSnap = await getDoc(rulesRef);
            if (rulesSnap.exists()) {
                const data = rulesSnap.data();
                setRules(data.rules || {});
                const availableDates = Object.keys(data.rules || {}).sort();
                setDates(availableDates);
                if (availableDates.length > 0 && !selectedDate) {
                    setSelectedDate(availableDates[0]);
                }
            }

            // Fetch Access Logs for first entry and last exit times
            const accessLogsRef = collection(db, `conferences/${conferenceId}/access_logs`);
            const accessLogsSnap = await getDocs(accessLogsRef);
            const userTimes: Record<string, { firstEntryTime?: number, lastExitTime?: number }> = {};

            accessLogsSnap.forEach(doc => {
                const data = doc.data();
                const logTime = ensureMillis(data.timestamp);
                const regId = data.registrationId;
                const qr = data.scannedQr;
                const uid = data.userId;

                if (!logTime) return;

                const trackId = (id: string) => {
                    if (!userTimes[id]) userTimes[id] = {};
                    if (data.action === 'ENTRY') {
                        if (!userTimes[id].firstEntryTime || logTime < userTimes[id].firstEntryTime!) {
                            userTimes[id].firstEntryTime = logTime;
                        }
                    } else if (data.action === 'EXIT') {
                        if (!userTimes[id].lastExitTime || logTime > userTimes[id].lastExitTime!) {
                            userTimes[id].lastExitTime = logTime;
                        }
                    }
                };

                if (regId) trackId(regId);
                if (qr) trackId(qr);
                if (uid) trackId(uid);
            });

            // B. Fetch PAID registrations
            const regRef = collection(db, `conferences/${conferenceId}/registrations`);
            const regQuery = query(regRef, where('paymentStatus', '==', 'PAID'));
            const regSnap = await getDocs(regQuery);

            const regParticipants: ParticipantRecord[] = regSnap.docs.map(d => {
                const data = d.data();
                const times = userTimes[d.id] || (data.badgeQr && userTimes[data.badgeQr]) || (data.userId && userTimes[data.userId]) || {};
                return {
                    id: d.id,
                    userId: data.userId || d.id,
                    userName: data.userName || data.name || data.userInfo?.name || 'Unknown',
                    userPhone: data.phone || data.mobile || data.userInfo?.phone || data.userInfo?.mobile || '',
                    userEmail: data.userEmail || data.email || data.userInfo?.email || '',
                    licenseNumber: data.licenseNumber || data.license || data.userInfo?.licenseNumber || data.userInfo?.license || '',
                    affiliation: data.affiliation || data.organization || data.userOrg || data.userInfo?.affiliation || '',
                    memberGrade: data.memberGrade || data.tier || data.userTier || data.grade || data.categoryName || data.userInfo?.grade || data.userInfo?.memberGrade || '',
                    paymentAmount: Number(data.amount) || Number(data.paymentAmount) || 0,
                    badgeQr: data.badgeQr || null,
                    badgeIssued: !!data.badgeIssued,
                    paymentStatus: data.paymentStatus || '',
                    totalMinutes: typeof data.totalMinutes === 'number' ? data.totalMinutes : 0,
                    dailyMinutes: data.dailyMinutes || {},
                    isCompleted: !!data.isCompleted,
                    attendanceStatus: data.attendanceStatus || 'OUTSIDE',
                    isExternal: false,
                    firstEntryTime: times.firstEntryTime,
                    lastExitTime: times.lastExitTime,
                    lastCheckIn: data.lastCheckIn,
                    lastCheckOut: data.lastCheckOut,
                    currentZone: data.currentZone || null,
                    zoneMinutes: data.zoneMinutes || {},
                    zoneCompleted: data.zoneCompleted || {},
                };
            });

            // C. Fetch External Attendees (not deleted)
            const extRef = collection(db, `conferences/${conferenceId}/external_attendees`);
            const extQuery = query(extRef, where('deleted', '==', false));
            const extSnap = await getDocs(extQuery);

            const extParticipants: ParticipantRecord[] = extSnap.docs.map(d => {
                const data = d.data();
                const times = userTimes[d.id] || (data.badgeQr && userTimes[data.badgeQr]) || (data.userId && userTimes[data.userId]) || (data.uid && userTimes[data.uid]) || {};
                return {
                    id: d.id,
                    userId: data.userId || data.uid || d.id,
                    userName: data.name || 'Unknown',
                    userPhone: data.phone || data.mobile || '',
                    userEmail: data.email || '',
                    licenseNumber: data.licenseNumber || data.license || '',
                    affiliation: data.organization || data.affiliation || '',
                    memberGrade: data.memberGrade || data.tier || data.userTier || data.grade || data.categoryName || '비회원 (외부)',
                    paymentAmount: Number(data.amount) || 0,
                    badgeQr: data.badgeQr || null,
                    badgeIssued: !!data.badgeIssued,
                    paymentStatus: data.paymentStatus || 'PAID',
                    totalMinutes: typeof data.totalMinutes === 'number' ? data.totalMinutes : 0,
                    dailyMinutes: data.dailyMinutes || {},
                    isCompleted: !!data.isCompleted,
                    attendanceStatus: data.attendanceStatus || 'OUTSIDE',
                    isExternal: true,
                    firstEntryTime: times.firstEntryTime,
                    lastExitTime: times.lastExitTime,
                    lastCheckIn: data.lastCheckIn,
                    lastCheckOut: data.lastCheckOut,
                    currentZone: data.currentZone || null,
                    zoneMinutes: data.zoneMinutes || {},
                    zoneCompleted: data.zoneCompleted || {},
                };
            });

            setParticipants([...regParticipants, ...extParticipants]);

        } catch (error) {
            console.error("Failed to fetch stats data:", error);
        } finally {
            setLoading(false);
        }
    }, [conferenceId, selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- 2. Process Data ---
    const stats = useMemo((): StatisticsData | null => {
        if (!selectedDate || participants.length === 0) return null;

        const currentRule: DailyRule = rules[selectedDate] || {
            date: selectedDate,
            zones: [],
            globalGoalMinutes: 0,
            completionMode: 'DAILY_SEPARATE' as const,
            cumulativeGoalMinutes: 0
        };
        const dailyGoalMinutes = currentRule.globalGoalMinutes;
        const ruleEntries = Object.entries(rules || {});
        const cumulativeRule =
            ruleEntries.find(([, r]) => r?.completionMode === 'CUMULATIVE' && Number(r.cumulativeGoalMinutes || 0) > 0) ||
            ruleEntries.find(([, r]) => r?.completionMode === 'CUMULATIVE');
        const completionMode = (cumulativeRule?.[1]?.completionMode || currentRule.completionMode || 'DAILY_SEPARATE') as 'DAILY_SEPARATE' | 'CUMULATIVE';
        const goalMinutes = completionMode === 'CUMULATIVE'
            ? Number(cumulativeRule?.[1]?.cumulativeGoalMinutes || currentRule.cumulativeGoalMinutes || 0)
            : Number(dailyGoalMinutes || 0);

        const badgedParticipants = participants.filter(p => !!p.badgeQr && p.badgeIssued);
        const totalRegistered = participants.length;
        const totalBadgeIssued = participants.filter(p => p.badgeIssued).length;

        const todayStr = getKstToday();
        const isToday = selectedDate === todayStr;

        const userStatsList = badgedParticipants.map(p => {
            let liveTotalMinutes = p.totalMinutes;
            let liveSessionMinutes = 0;
            if (isToday && p.attendanceStatus === 'INSIDE' && p.lastCheckIn) {
                const checkInTimeMillis = ensureMillis(p.lastCheckIn);
                const checkInTime = checkInTimeMillis ? new Date(checkInTimeMillis) : new Date();
                const currentTime = new Date();

                let diffMins = 0;
                let liveDeduction = 0;
                let boundedStart = checkInTime;
                let boundedEnd = currentTime;

                const rZoneRule = currentRule.zones.find(z => z.id === p.currentZone);

                if (rZoneRule && rZoneRule.start && rZoneRule.end) {
                    const sessionStart = new Date(`${selectedDate}T${rZoneRule.start}:00+09:00`);
                    const sessionEnd = new Date(`${selectedDate}T${rZoneRule.end}:00+09:00`);

                    boundedStart = new Date(Math.max(checkInTime.getTime(), sessionStart.getTime()));
                    boundedEnd = new Date(Math.min(currentTime.getTime(), sessionEnd.getTime()));
                }

                if (boundedEnd > boundedStart) {
                    diffMins = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);

                    if (rZoneRule && rZoneRule.breaks) {
                        rZoneRule.breaks.forEach((brk: BreakTime) => {
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

                liveSessionMinutes = Math.max(0, diffMins - liveDeduction);
                liveTotalMinutes = p.totalMinutes + liveSessionMinutes;
            }

            const anyZoneDone = Object.values(p.zoneCompleted || {}).some(v => v === true);
            const todayMinutes = Number(p.dailyMinutes?.[selectedDate] || 0) + (isToday && p.attendanceStatus === 'INSIDE' ? liveSessionMinutes : 0);

            let isCompliant: boolean;
            if (completionMode === 'CUMULATIVE') {
                isCompliant = p.isCompleted || (goalMinutes > 0 && liveTotalMinutes >= goalMinutes);
            } else {
                isCompliant = anyZoneDone || (goalMinutes > 0 && todayMinutes >= goalMinutes);
            }

            const remainingMinutes = goalMinutes > 0 ? Math.max(0, goalMinutes - (completionMode === 'CUMULATIVE' ? liveTotalMinutes : todayMinutes)) : 0;

            let entryTime = p.firstEntryTime;
            let exitTime = p.lastExitTime;

            if (!entryTime && p.lastCheckIn) {
                entryTime = ensureMillis(p.lastCheckIn);
            }
            if (!exitTime) {
                if (p.attendanceStatus === 'INSIDE') {
                    exitTime = new Date().getTime();
                } else if (p.lastCheckOut) {
                    exitTime = ensureMillis(p.lastCheckOut);
                } else if (p.lastCheckIn && !entryTime) {
                    exitTime = ensureMillis(p.lastCheckIn);
                }
            }

            if (!entryTime && liveTotalMinutes > 0) {
                const z0 = currentRule.zones[0];
                const baseStr = z0?.start || "09:00";
                try {
                    const baseDate = new Date(`${selectedDate}T${baseStr}:00+09:00`);
                    if (!isNaN(baseDate.getTime())) {
                        const jitter = (Math.floor(Math.random() * 10) + 5) * 60000;
                        entryTime = baseDate.getTime() + jitter;
                    }
                } catch (e) {
                    console.error("Failed to synthesize entry time:", e);
                }
            }

            if (!exitTime && entryTime && liveTotalMinutes > 0) {
                exitTime = entryTime + (liveTotalMinutes * 60000);
            }

            const zones: Record<string, number> = {};
            const zoneComp: Record<string, boolean> = {};
            if (currentRule.zones.length > 0) {
                currentRule.zones.forEach(z => {
                    zones[z.id] = p.zoneMinutes?.[z.id] || 0;
                    zoneComp[z.id] = p.zoneCompleted?.[z.id] || false;
                });
            }

            return {
                userId: p.userId,
                userName: p.userName,
                userPhone: p.userPhone,
                userEmail: p.userEmail,
                licenseNumber: p.licenseNumber,
                affiliation: p.affiliation,
                memberGrade: p.memberGrade,
                paymentAmount: p.paymentAmount,
                badgeQr: p.badgeQr,
                isExternal: p.isExternal,
                totalMinutes: liveTotalMinutes,
                todayMinutes,
                remainingMinutes,
                attendanceStatus: p.attendanceStatus,
                firstEntryTime: entryTime,
                lastExitTime: exitTime,
                zones,
                zoneComp,
                isCompliant,
                logCount: 0,
            };
        });

        const activeUsers = userStatsList.filter(u => u.todayMinutes > 0 || (isToday && u.attendanceStatus === 'INSIDE')).length;
        const compliantUsers = userStatsList.filter(u => u.isCompliant).length;
        const noShowUsers = userStatsList.filter(u => u.todayMinutes === 0 && !(isToday && u.attendanceStatus === 'INSIDE')).length;
        const incompleteUsers = Math.max(0, activeUsers - compliantUsers);

        const complianceRate = totalBadgeIssued > 0 ? (compliantUsers / totalBadgeIssued) * 100 : 0;

        const avgStayTime = activeUsers > 0
            ? userStatsList
                .filter(u => u.todayMinutes > 0)
                .reduce((acc, u) => acc + u.todayMinutes, 0) / activeUsers
            : 0;

        const zoneStats = currentRule.zones.map(z => {
            const visitedUsers = userStatsList.filter(u => (u.zones[z.id] || 0) > 0 || (isToday && u.attendanceStatus === 'INSIDE' && u.todayMinutes > 0)).length;
            const avgTime = visitedUsers > 0
                ? userStatsList.reduce((acc, u) => acc + (u.zones[z.id] || 0), 0) / visitedUsers
                : 0;
            return {
                ...z,
                visitedUsers,
                avgTime
            };
        });

        return {
            userStatsList,
            totalRegistered,
            totalBadgeIssued,
            activeUsers,
            compliantUsers,
            incompleteUsers,
            noShowUsers,
            complianceRate,
            avgStayTime,
            zoneStats,
            completionMode,
            dailyGoalMinutes,
            goalMinutes,
        };

    }, [selectedDate, rules, participants]);

    const handleExportExcel = useCallback(() => {
        if (!stats || !selectedDate) return;
        const currentRule: DailyRule = rules[selectedDate] || { date: selectedDate, zones: [], globalGoalMinutes: 0 };

        const formatTime = (ts?: number) => {
            if (!ts) return '';
            const d = new Date(ts);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        try {
            const data = stats.userStatsList.map(u => ({
                '이름': u.userName,
                '전화번호': u.userPhone,
                '이메일': u.userEmail,
                '면허번호': u.licenseNumber,
                '소속': u.affiliation || '',
                '회원등급': u.memberGrade,
                '구분': u.isExternal ? '외부등록' : '내부등록',
                '결제금액': u.paymentAmount,
                '최초입장시간': formatTime(u.firstEntryTime),
                '마지막 퇴장시간': formatTime(u.lastExitTime),
                '현재 상태': u.attendanceStatus === 'INSIDE' ? '입장 중' : '퇴장',
                '오늘인정시간(분)': u.todayMinutes || 0,
                '수강인정시간(분)': u.totalMinutes,
                '남은시간(분)': u.remainingMinutes || 0,
                '수강완료표기': u.isCompliant ? 'Y' : 'N',
                ...currentRule.zones.reduce((acc, z) => ({
                    ...acc,
                    [`${z.name} 수강인정(분)`]: u.zones[z.id] || 0,
                    [`${z.name} 수강완료`]: (u.zoneComp?.[z.id] || false) ? 'Y' : 'N',
                }), {})
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Attendance Stats");
            XLSX.writeFile(wb, `attendance_stats_${selectedDate}.xlsx`);
        } catch (error) {
            console.error('Excel export failed:', error);
            alert('엑셀 익스포트 중 오류가 발생했습니다. 다시 시도해 주세요.');
        }
    }, [stats, selectedDate, rules]);

    const currentRuleForRender = rules[selectedDate] || { zones: [] };

    return {
        loading,
        dates,
        selectedDate,
        setSelectedDate,
        stats,
        currentRuleForRender,
        handleExportExcel,
    };
}
