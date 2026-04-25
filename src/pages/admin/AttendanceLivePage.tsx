import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, doc, updateDoc, getDoc, Timestamp, addDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Loader2, LogIn, LogOut, RefreshCw, CheckCircle, FileText, Search, Clock, MapPin, Calendar, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { getKstToday } from '../../utils/dateUtils';
import type { AttendanceZone } from '../../types/attendance';

import { AdjustAttendanceModal } from '../../components/admin/attendance/AdjustAttendanceModal';
import { AttendanceLogModal } from '../../components/admin/attendance/AttendanceLogModal';

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
    ruleDate?: string;
}
interface DailyRule {
    date: string;
    globalGoalMinutes: number;
    zones: ZoneRule[];
    // 계산 방식: DAILY_SEPARATE = 날짜별 독립 완료, CUMULATIVE = 전체 기간 누적 합산
    completionMode?: 'DAILY_SEPARATE' | 'CUMULATIVE';
    // 전체 기간 누적 목표 (CUMULATIVE 모드일 때 사용)
    cumulativeGoalMinutes?: number;
}

interface Registration {
    id: string;
    userName: string;
    userEmail: string;
    attendanceStatus: 'INSIDE' | 'OUTSIDE' | null;
    currentZone: string | null;
    lastCheckIn?: Timestamp;
    totalMinutes: number;
    dailyMinutes?: Record<string, number>;
    zoneMinutes?: Record<string, number>;
    zoneCompleted?: Record<string, boolean>;
    isCompleted: boolean;
    slug: string;
    affiliation?: string;
    isExternal?: boolean;
}

interface LogEntry {
    id: string;
    type: 'ENTER' | 'EXIT' | 'ADJUST';
    timestamp: Timestamp;
    zoneId: string;
    rawDuration?: number;
    deduction?: number;
    recognizedMinutes?: number;
    accumulatedTotal?: number;
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
    const [selectedDate, setSelectedDate] = useState<string>(getKstToday());
    const [searchTerm, setSearchTerm] = useState<string>('');

    const [showLogModal, setShowLogModal] = useState(false);
    const [selectedRegForLog, setSelectedRegForLog] = useState<Registration | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const logsUnsubRef = useRef<null | (() => void)>(null);

    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [selectedRegForAdjust, setSelectedRegForAdjust] = useState<Registration | null>(null);
    const [adjustMode, setAdjustMode] = useState<'CHECKIN' | 'CHECKOUT' | 'ADJUST_MINUTES'>('ADJUST_MINUTES');
    const [adjustZoneId, setAdjustZoneId] = useState<string>('');
    const [adjustCheckInTime, setAdjustCheckInTime] = useState<string>('');
    const [adjustCheckOutTime, setAdjustCheckOutTime] = useState<string>('');
    const [adjustRecognizedMinutes, setAdjustRecognizedMinutes] = useState<string>('');
    const [adjustTodayMinutes, setAdjustTodayMinutes] = useState<string>('');

    // For live tracking
    const [currentTime, setCurrentTime] = useState(new Date());

    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // UI update every minute
        return () => clearInterval(timer);
    }, []);

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
                        list.push(getKstToday(curr));
                        curr.setDate(curr.getDate() + 1);
                    }
                    setAvailableDates(list);
                    const today = getKstToday();
                    if (list.includes(today)) {
                        setSelectedDate(today);
                    } else if (list.length > 0) {
                        setSelectedDate(list[0]);
                    }
                }
            }
        };
        fetchDates();
    }, [cid]);

    // Keep allZones globally to safely check rules for zones spanning across days
    const allZonesRef = useRef<AttendanceZone[]>([]);

    useEffect(() => {
        if (!cid) return;

        console.log('[AttendanceLive] Setting up snapshot listeners for:', cid);
        // Defer loading state to avoid synchronous setState warning
        setTimeout(() => setLoading(true), 0);

        // 1. Listen to rules
        const rulesRef = doc(db, `conferences/${cid}/settings/attendance`);
        const unsubscribeRules = onSnapshot(rulesRef, (snap) => {
            if (snap.exists()) {
                const allRules = snap.data().rules || {};
                
                // Extract all zones into allZonesRef
                const allZones: AttendanceZone[] = [];
                Object.entries(allRules).forEach(([dateStr, rule]: [string, DailyRule | undefined]) => {
                    if (rule?.zones) {
                        rule.zones.forEach((z: ZoneRule) => {
                            allZones.push({
                                ...z,
                                ruleDate: dateStr,
                                globalGoalMinutes: rule.globalGoalMinutes || 0,
                                completionMode: rule.completionMode || 'DAILY_SEPARATE',
                                cumulativeGoalMinutes: rule.cumulativeGoalMinutes || 0
                            } as AttendanceZone);
                        });
                    }
                });
                allZonesRef.current = allZones;
                
                const targetRule = allRules[selectedDate];
                setRules(targetRule || null);
                if (targetRule) setZones(targetRule.zones || []);
                else setZones([]);
            }
        });

        // 2. Listen to registrations (PAID only)
        const qReg = query(
            collection(db, 'conferences', cid, 'registrations'),
            where('paymentStatus', '==', 'PAID')
        );

        // 3. Listen to external attendees
        const qExt = query(
            collection(db, 'conferences', cid, 'external_attendees'),
            where('deleted', '==', false)
        );

        let regs: Registration[] = [];
        let exts: Registration[] = [];

        const updateCombined = () => {
            const combinedData = [...regs, ...exts];
            combinedData.sort((a, b) => {
                if (a.attendanceStatus === 'INSIDE' && b.attendanceStatus !== 'INSIDE') return -1;
                if (a.attendanceStatus !== 'INSIDE' && b.attendanceStatus === 'INSIDE') return 1;
                return a.userName.localeCompare(b.userName);
            });
            setRegistrations(combinedData);
            setLoading(false);
        };

        const unsubscribeReg = onSnapshot(qReg, (snap) => {
            regs = snap.docs
                .filter(d => {
                    const data = d.data();
                    return data.badgeIssued === true && !!data.badgeQr;
                })
                .map(d => {
                    const docData = d.data();
                    const flattened = {
                        id: d.id,
                        ...docData,
                        totalMinutes: docData.totalMinutes || 0,
                        dailyMinutes: docData.dailyMinutes || {},
                        zoneMinutes: docData.zoneMinutes || {},
                        zoneCompleted: docData.zoneCompleted || {},
                        attendanceStatus: docData.attendanceStatus || 'OUTSIDE',
                        isExternal: false
                    } as Registration;

                    flattened.userName = docData.userName || docData.name || docData.userInfo?.name || 'Unknown';
                    flattened.userEmail = docData.userEmail || docData.userInfo?.email || '';
                    flattened.affiliation = docData.userOrg || docData.organization || docData.affiliation || docData.userInfo?.affiliation || docData.userInfo?.organization || '';

                    if (docData.userInfo) {
                        flattened.userName = docData.userInfo.name || flattened.userName;
                        flattened.userEmail = docData.userInfo.email || flattened.userEmail;
                        flattened.affiliation = docData.userInfo.affiliation || docData.userInfo.organization || flattened.affiliation;
                    }
                    return flattened;
                });
            updateCombined();
        });

        const unsubscribeExt = onSnapshot(qExt, (snap) => {
            exts = snap.docs
                .filter(d => {
                    const data = d.data();
                    return data.badgeIssued === true && !!data.badgeQr;
                })
                .map(d => {
                    const docData = d.data();
                    return {
                        id: d.id,
                        userName: docData.name || 'Unknown',
                        userEmail: docData.email || '',
                        attendanceStatus: docData.attendanceStatus || 'OUTSIDE',
                        currentZone: docData.currentZone || null,
                        lastCheckIn: docData.lastCheckIn,
                        totalMinutes: docData.totalMinutes || 0,
                        dailyMinutes: docData.dailyMinutes || {},
                        zoneMinutes: docData.zoneMinutes || {},
                        zoneCompleted: docData.zoneCompleted || {},
                        isCompleted: !!docData.isCompleted,
                        slug: docData.slug || '',
                        affiliation: docData.userOrg || docData.organization || docData.affiliation || '',
                        isExternal: true
                    } as Registration;
                });
            updateCombined();
        });

        return () => {
            unsubscribeRules();
            unsubscribeReg();
            unsubscribeExt();
        };
    }, [cid, selectedDate]);

    // Keep refreshData for manual button if needed, but it's now redundant
    const refreshData = useCallback(async () => {
        // Just a dummy now as onSnapshot handles it, but keep signature to avoid breaking other calls
        console.log('[AttendanceLive] Manual refresh requested (handled by onSnapshot)');
    }, []);

    const getDateTimeKst = (dateStr: string, timeStr: string): Date | null => {
        const t = timeStr.trim();
        if (!/^\d{2}:\d{2}$/.test(t)) return null;
        const dt = new Date(`${dateStr}T${t}:00+09:00`);
        return isNaN(dt.getTime()) ? null : dt;
    };

    const getGoalMinutes = () => {
        if (!rules) return 0;
        return rules.completionMode === 'CUMULATIVE'
            ? (rules.cumulativeGoalMinutes || 0)
            : (rules.globalGoalMinutes || 0);
    };

    const recomputeIsCompleted = (newTotalMinutes: number, zoneMinutes: Record<string, number>, zoneCompleted: Record<string, boolean>) => {
        if (!rules) return false;
        const anyZoneCompleted = Object.values(zoneCompleted).some(v => v === true);
        const goalMinutes = getGoalMinutes();
        const cumulativeCompleted = rules.completionMode === 'CUMULATIVE' && goalMinutes > 0 && newTotalMinutes >= goalMinutes;
        return anyZoneCompleted || cumulativeCompleted;
    };

    const handleCheckIn = async (regId: string, zoneId: string, checkInAt?: Date) => {
        try {
            const reg = registrations.find(r => r.id === regId);

            if (reg?.attendanceStatus === 'INSIDE' && reg.currentZone) {
                if (reg.currentZone === zoneId) {
                    toast.error("Already checked in to this zone.");
                    return;
                }
                await handleCheckOut(regId, reg.currentZone, reg.lastCheckIn, true); // Silent checkout for switch
            }

            const collectionName = reg?.isExternal ? 'external_attendees' : 'registrations';
            const regRef = doc(db, 'conferences', cid!, collectionName, regId);
            const nowDate = checkInAt || new Date();
            const now = Timestamp.fromDate(nowDate);
            
            // Use the actual ruleDate of the zone being checked into
            const todayStr = getKstToday();
            const zoneRule = zones.find(z => z.id === zoneId) || allZonesRef.current.find(z => z.id === zoneId && z.ruleDate === todayStr) || allZonesRef.current.find(z => z.id === zoneId);
            const actualDateStr = zoneRule?.ruleDate || selectedDate;

            await updateDoc(regRef, {
                attendanceStatus: 'INSIDE',
                currentZone: zoneId,
                lastCheckIn: now
            });

            // [1] 서브컬렉션 로그 (개인별 상세 기록)
            await addDoc(collection(db, 'conferences', cid!, collectionName, regId, 'logs'), {
                type: 'ENTER',
                zoneId,
                timestamp: now,
                date: actualDateStr,
                method: checkInAt ? 'MANUAL_ADMIN_OVERRIDE' : 'MANUAL_ADMIN'
            });

            // [2] 루트 access_logs (통계용)
            try {
                const latestSnap = await getDoc(regRef);
                const badgeQr = latestSnap.data()?.badgeQr || regId;
                await addDoc(collection(db, `conferences/${cid}/access_logs`), {
                    action: 'ENTRY',
                    scannedQr: badgeQr,
                    locationId: zoneId,
                    timestamp: now,
                    date: actualDateStr,
                    method: checkInAt ? 'MANUAL_ADMIN_OVERRIDE' : 'MANUAL_ADMIN',
                    registrationId: regId,
                    isExternal: reg?.isExternal || false,
                });
            } catch (e) {
                console.warn('[AccessLog] Failed to write root access_log on ENTRY (admin):', e);
            }

            toast.success("입장 처리됨 (Checked In)");
            refreshData();
        } catch {
            toast.error("Check-in failed");
        }
    };

    const handleCheckOut = async (regId: string, currentZoneId: string | null, lastCheckIn: Timestamp | undefined, isSwitching = false, isBulk = false, checkOutAt?: Date, recognizedOverride?: number) => {
        if (!lastCheckIn || !rules) {
            if (!isBulk) toast.error("체크인 정보가 없거나 규칙이 로드되지 않았습니다.");
            return;
        }

        try {
            const now = checkOutAt || new Date();
            const checkInTime = lastCheckIn.toDate();

            let durationMinutes = 0;
            let deduction = 0;
            let boundedStart = checkInTime;
            let boundedEnd = now;

            // Safe cross-day zone lookup based on CHECK-IN time
            const checkInDateStr = getKstToday(checkInTime);
            const zoneRule = allZonesRef.current.find(z => z.id === currentZoneId && z.ruleDate === checkInDateStr) || zones.find(z => z.id === currentZoneId) || allZonesRef.current.find(z => z.id === currentZoneId);
            const zoneDateStr = zoneRule?.ruleDate || checkInDateStr;

            if (zoneRule && zoneRule.start && zoneRule.end) {
                const sessionStart = new Date(`${zoneDateStr}T${zoneRule.start}:00+09:00`);
                const sessionEnd = new Date(`${zoneDateStr}T${zoneRule.end}:00+09:00`);

                boundedStart = new Date(Math.max(checkInTime.getTime(), sessionStart.getTime()));
                boundedEnd = new Date(Math.min(now.getTime(), sessionEnd.getTime()));
            }

            if (boundedEnd > boundedStart) {
                durationMinutes = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);

                if (zoneRule && zoneRule.breaks) {
                    zoneRule.breaks.forEach((brk: BreakTime) => {
                        const breakStart = new Date(`${zoneDateStr}T${brk.start}:00+09:00`);
                        const breakEnd = new Date(`${zoneDateStr}T${brk.end}:00+09:00`);
                        const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
                        const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
                        if (overlapEnd > overlapStart) {
                            const overlapMins = Math.floor((overlapEnd - overlapStart) / 60000);
                            deduction += overlapMins;
                        }
                    });
                }
            }

            const computedMinutes = Math.max(0, durationMinutes - deduction);
            const finalMinutes = typeof recognizedOverride === 'number' && !isNaN(recognizedOverride) ? Math.max(0, Math.floor(recognizedOverride)) : computedMinutes;
            const reg = registrations.find(r => r.id === regId);
            const collectionName = reg?.isExternal ? 'external_attendees' : 'registrations';
            const regRef = doc(db, 'conferences', cid!, collectionName, regId);

            const currentTotal = reg?.totalMinutes || 0;
            const newTotal = currentTotal + finalMinutes;

            const dailyMinutes = { ...(reg?.dailyMinutes || {}) };
            dailyMinutes[checkInDateStr] = (dailyMinutes[checkInDateStr] || 0) + finalMinutes;

            // Per-zone tracking
            const zoneMinutes = { ...(reg?.zoneMinutes || {}) };
            const zoneCompleted = { ...(reg?.zoneCompleted || {}) };

            if (currentZoneId && finalMinutes > 0) {
                zoneMinutes[currentZoneId] = (zoneMinutes[currentZoneId] || 0) + finalMinutes;
            }

            // Per-zone completion check — only in non-CUMULATIVE mode
            if (currentZoneId && rules.completionMode !== 'CUMULATIVE') {
                const zoneRuleForCompletion = zones.find(z => z.id === currentZoneId);
                if (zoneRuleForCompletion) {
                    const zoneGoal = zoneRuleForCompletion.goalMinutes || rules.globalGoalMinutes || 0;
                    if (zoneGoal > 0 && (zoneMinutes[currentZoneId] || 0) >= zoneGoal) {
                        zoneCompleted[currentZoneId] = true;
                    }
                }
            }

            // isCompleted = any zone completed OR cumulative goal met
            const anyZoneCompleted = Object.values(zoneCompleted).some(v => v === true);
            const cumulativeCompleted = rules.completionMode === 'CUMULATIVE'
                && rules.cumulativeGoalMinutes
                && newTotal >= rules.cumulativeGoalMinutes;
            const isCompleted = anyZoneCompleted || !!cumulativeCompleted;

            const exitNow = Timestamp.fromDate(now);

            await updateDoc(regRef, {
                attendanceStatus: 'OUTSIDE',
                currentZone: null,
                totalMinutes: newTotal,
                dailyMinutes: dailyMinutes,
                zoneMinutes: zoneMinutes,
                zoneCompleted: zoneCompleted,
                isCompleted: isCompleted,
                lastCheckOut: exitNow
            });

            // [1] 서브컬렉션 로그 (개인별 상세 기록)
            await addDoc(collection(db, 'conferences', cid!, collectionName, regId, 'logs'), {
                type: 'EXIT',
                zoneId: currentZoneId,
                timestamp: exitNow,
                date: checkInDateStr,
                method: checkOutAt || typeof recognizedOverride === 'number' ? 'MANUAL_ADMIN_OVERRIDE' : 'MANUAL_ADMIN',
                rawDuration: durationMinutes,
                deduction,
                recognizedMinutes: finalMinutes
            });

            // [2] 루트 access_logs (통계용)
            try {
                const latestSnap = await getDoc(regRef);
                const badgeQr = latestSnap.data()?.badgeQr || regId;
                await addDoc(collection(db, `conferences/${cid}/access_logs`), {
                    action: 'EXIT',
                    scannedQr: badgeQr,
                    locationId: currentZoneId,
                    timestamp: exitNow,
                    date: checkInDateStr,
                    method: checkOutAt || typeof recognizedOverride === 'number' ? 'MANUAL_ADMIN_OVERRIDE' : 'MANUAL_ADMIN',
                    registrationId: regId,
                    isExternal: reg?.isExternal || false,
                    recognizedMinutes: finalMinutes,
                    accumulatedTotal: newTotal,
                    rawDuration: durationMinutes,
                    deduction,
                });
            } catch (e) {
                console.warn('[AccessLog] Failed to write root access_log on EXIT (admin):', e);
            }

            if (!isSwitching && !isBulk) {
                toast.success(`퇴장 완료 (+${finalMinutes}분 인정)`);
                refreshData();
            }
        } catch {
            if (!isBulk) toast.error("Check-out failed");
            throw new Error("Check-out failed");
        }
    };

    const handleBulkCheckOut = async () => {
        const insideUsers = registrations.filter(r => r.attendanceStatus === 'INSIDE');
        if (insideUsers.length === 0) {
            toast.error("현재 입장 중인 참석자가 없습니다.");
            return;
        }

        const confirmMsg = `현재 입장 중인 ${insideUsers.length}명을 모두 강제 퇴장 처리 하시겠습니까?\n이 작업은 시간이 소요될 수 있으며 되돌릴 수 없습니다.`;
        if (!window.confirm(confirmMsg)) {
            return;
        }

        setIsBulkProcessing(true);
        setBulkProgress({ current: 0, total: insideUsers.length });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < insideUsers.length; i++) {
            const user = insideUsers[i];
            try {
                // Pass isBulk = true, which also suppresses individual toasts
                await handleCheckOut(user.id, user.currentZone, user.lastCheckIn, false, true);
                successCount++;
            } catch (e) {
                console.error(`Bulk checkout failed for ${user.id}`, e);
                failCount++;
            }
            setBulkProgress({ current: i + 1, total: insideUsers.length });
        }

        setIsBulkProcessing(false);
        toast.success(`일괄 퇴장 완료: 성공 ${successCount}명, 실패 ${failCount}명`);
    };

    const openLogs = (reg: Registration) => {
        if (logsUnsubRef.current) {
            logsUnsubRef.current();
            logsUnsubRef.current = null;
        }

        setSelectedRegForLog(reg);
        setShowLogModal(true);
        setLogs([]);

        const collectionName = reg.isExternal ? 'external_attendees' : 'registrations';
        const q = query(collection(db, 'conferences', cid!, collectionName, reg.id, 'logs'), orderBy('timestamp', 'desc'));
        logsUnsubRef.current = onSnapshot(q, (snap) => {
            const loadedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as LogEntry[];
            setLogs(loadedLogs);
        }, () => {
            toast.error("기록을 불러오지 못했습니다.");
        });
    };

    useEffect(() => {
        if (!showLogModal && logsUnsubRef.current) {
            logsUnsubRef.current();
            logsUnsubRef.current = null;
        }
    }, [showLogModal]);

    const openAdjust = (reg: Registration) => {
        setSelectedRegForAdjust(reg);
        setAdjustMode('ADJUST_MINUTES');
        setAdjustZoneId(reg.currentZone || zones[0]?.id || '');
        setAdjustCheckInTime('');
        setAdjustCheckOutTime('');
        setAdjustRecognizedMinutes('');
        setAdjustTodayMinutes(String(reg.dailyMinutes?.[selectedDate] ?? ''));
        setShowAdjustModal(true);
    };

    const applyAdjust = async () => {
        if (!selectedRegForAdjust || !cid || !rules) return;
        const reg = selectedRegForAdjust;
        const collectionName = reg.isExternal ? 'external_attendees' : 'registrations';
        const regRef = doc(db, 'conferences', cid, collectionName, reg.id);
        const zoneId = adjustZoneId || reg.currentZone || zones[0]?.id || null;
        const goalMinutes = getGoalMinutes();

        try {
            if (adjustMode === 'CHECKIN') {
                if (!zoneId) {
                    toast.error('Zone이 없습니다.');
                    return;
                }
                const dt = getDateTimeKst(selectedDate, adjustCheckInTime);
                if (!dt) {
                    toast.error('입장 시간을 HH:MM 형식으로 입력하세요.');
                    return;
                }
                await handleCheckIn(reg.id, zoneId, dt);
                setShowAdjustModal(false);
                return;
            }

            if (adjustMode === 'CHECKOUT') {
                const checkInDate = reg.lastCheckIn?.toDate() || new Date();
                const checkInDateStr = getKstToday(checkInDate);
                const zoneRule = allZonesRef.current.find(z => z.id === reg.currentZone && z.ruleDate === checkInDateStr) || zones.find(z => z.id === reg.currentZone) || allZonesRef.current.find(z => z.id === reg.currentZone);
                const zoneDateStr = zoneRule?.ruleDate || checkInDateStr;
                const dt = getDateTimeKst(zoneDateStr, adjustCheckOutTime);
                if (!dt) {
                    toast.error('퇴장 시간을 HH:MM 형식으로 입력하세요.');
                    return;
                }
                const override = adjustRecognizedMinutes.trim() === '' ? undefined : Number(adjustRecognizedMinutes);
                await handleCheckOut(reg.id, reg.currentZone, reg.lastCheckIn, false, false, dt, override);
                setShowAdjustModal(false);
                return;
            }

            const inputToday = adjustTodayMinutes.trim();
            if (inputToday === '' || isNaN(Number(inputToday))) {
                toast.error('오늘 인정시간(분)을 숫자로 입력하세요.');
                return;
            }

            const newTodayMinutes = Math.max(0, Math.floor(Number(inputToday)));
            const oldDailyMinutes = reg.dailyMinutes?.[selectedDate] || 0;
            const delta = newTodayMinutes - oldDailyMinutes;

            const currentTotal = reg.totalMinutes || 0;
            const newTotalMinutes = Math.max(0, currentTotal + delta);

            const dailyMinutes = { ...(reg.dailyMinutes || {}) };
            dailyMinutes[selectedDate] = newTodayMinutes;

            const zoneMinutes = { ...(reg.zoneMinutes || {}) };
            if (zoneId) {
                zoneMinutes[zoneId] = Math.max(0, (zoneMinutes[zoneId] || 0) + delta);
            }

            const zoneCompleted = { ...(reg.zoneCompleted || {}) };
            if (zoneId && rules.completionMode !== 'CUMULATIVE') {
                const zRule = zones.find(z => z.id === zoneId);
                const zGoal = zRule?.goalMinutes || rules.globalGoalMinutes || 0;
                zoneCompleted[zoneId] = zGoal > 0 ? (zoneMinutes[zoneId] || 0) >= zGoal : (zoneCompleted[zoneId] || false);
            }

            const isCompleted = rules.completionMode === 'CUMULATIVE'
                ? (goalMinutes > 0 ? newTotalMinutes >= goalMinutes : reg.isCompleted)
                : recomputeIsCompleted(newTotalMinutes, zoneMinutes, zoneCompleted);

            await updateDoc(regRef, {
                totalMinutes: newTotalMinutes,
                dailyMinutes,
                zoneMinutes,
                zoneCompleted,
                isCompleted,
            });

            await addDoc(collection(db, 'conferences', cid, collectionName, reg.id, 'logs'), {
                type: 'ADJUST',
                zoneId,
                timestamp: Timestamp.now(),
                date: selectedDate,
                method: 'MANUAL_ADMIN_OVERRIDE',
                recognizedMinutes: delta,
                accumulatedTotal: newTotalMinutes,
            });

            toast.success('수정되었습니다.');
            setShowAdjustModal(false);
        } catch (e) {
            console.error(e);
            toast.error('수정 실패');
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

    const goalMinutes = rules?.completionMode === 'CUMULATIVE'
        ? (rules?.cumulativeGoalMinutes || 0)
        : (rules?.globalGoalMinutes || 0);
    const goalLabel = rules?.completionMode === 'CUMULATIVE' ? '누적 목표 시간' : '일일 목표 시간';

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
                        {filteredRegistrations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                                <Search className="w-8 h-8 opacity-50" />
                                <p className="text-sm">검색 결과가 없습니다.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredRegistrations.map(r => {
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
