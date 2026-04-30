import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, query, where, doc, updateDoc, getDoc, Timestamp, addDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import toast from 'react-hot-toast';
import { getKstToday } from '@/utils/dateUtils';
import { flattenRegistrationFields } from '@/utils/registrationMapper';
import type { AttendanceZone } from '@/types/attendance';

// ─── Local interfaces ───────────────────────────────────────────────

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
    breaks: BreakTime[];
    ruleDate?: string;
}
export interface DailyRule {
    date: string;
    globalGoalMinutes: number;
    zones: ZoneRule[];
    // 계산 방식: DAILY_SEPARATE = 날짜별 독립 완료, CUMULATIVE = 전체 기간 누적 합산
    completionMode?: 'DAILY_SEPARATE' | 'CUMULATIVE';
    // 전체 기간 누적 목표 (CUMULATIVE 모드일 때 사용)
    cumulativeGoalMinutes?: number;
}

export interface Registration {
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

export interface LogEntry {
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

// ─── Hook ───────────────────────────────────────────────────────────

export function useAttendanceLive(confId: string | undefined, _zoneId?: string) {
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
        if (!confId) return;
        const fetchDates = async () => {
            const confRef = doc(db, 'conferences', confId);
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
    }, [confId]);

    // Keep allZones globally to safely check rules for zones spanning across days
    const allZonesRef = useRef<AttendanceZone[]>([]);

    useEffect(() => {
        if (!confId) return;

        // Defer loading state to avoid synchronous setState warning
        setTimeout(() => setLoading(true), 0);

        // 1. Listen to rules
        const rulesRef = doc(db, `conferences/${confId}/settings/attendance`);
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
            collection(db, 'conferences', confId, 'registrations'),
            where('paymentStatus', '==', 'PAID')
        );

        // 3. Listen to external attendees
        const qExt = query(
            collection(db, 'conferences', confId, 'external_attendees'),
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

                    const norm = flattenRegistrationFields(docData);
                    flattened.userName = norm.userName || 'Unknown';
                    flattened.userEmail = norm.userEmail || '';
                    flattened.affiliation = norm.affiliation || '';
                    flattened.position = norm.position || '';

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
                    const norm = flattenRegistrationFields(docData);
                    return {
                        id: d.id,
                        userName: docData.name || norm.userName || 'Unknown',
                        userEmail: docData.email || norm.userEmail || '',
                        attendanceStatus: docData.attendanceStatus || 'OUTSIDE',
                        currentZone: docData.currentZone || null,
                        lastCheckIn: docData.lastCheckIn,
                        totalMinutes: docData.totalMinutes || 0,
                        dailyMinutes: docData.dailyMinutes || {},
                        zoneMinutes: docData.zoneMinutes || {},
                        zoneCompleted: docData.zoneCompleted || {},
                        isCompleted: !!docData.isCompleted,
                        slug: docData.slug || '',
                        affiliation: docData.organization || docData.affiliation || norm.affiliation || '',
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
    }, [confId, selectedDate]);

    // Keep refreshData for manual button if needed, but it's now redundant
    const refreshData = useCallback(async () => {
        // onSnapshot handles real-time updates
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
            const regRef = doc(db, 'conferences', confId!, collectionName, regId);
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
            await addDoc(collection(db, 'conferences', confId!, collectionName, regId, 'logs'), {
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
                await addDoc(collection(db, `conferences/${confId}/access_logs`), {
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
            const regRef = doc(db, 'conferences', confId!, collectionName, regId);

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
            await addDoc(collection(db, 'conferences', confId!, collectionName, regId, 'logs'), {
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
                await addDoc(collection(db, `conferences/${confId}/access_logs`), {
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
        const q = query(collection(db, 'conferences', confId!, collectionName, reg.id, 'logs'), orderBy('timestamp', 'desc'));
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
        if (!selectedRegForAdjust || !confId || !rules) return;
        const reg = selectedRegForAdjust;
        const collectionName = reg.isExternal ? 'external_attendees' : 'registrations';
        const regRef = doc(db, 'conferences', confId, collectionName, reg.id);
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

            await addDoc(collection(db, 'conferences', confId, collectionName, reg.id, 'logs'), {
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

    return {
        // Loading
        loading,

        // Data
        registrations,
        filteredRegistrations,
        zones,
        rules,

        // Search & date
        searchTerm, setSearchTerm,
        selectedDate, setSelectedDate,
        availableDates,

        // Log modal
        showLogModal, setShowLogModal,
        selectedRegForLog,
        logs,
        openLogs,
        openAdjust,

        // Adjust modal
        showAdjustModal, setShowAdjustModal,
        selectedRegForAdjust,
        adjustMode, setAdjustMode,
        adjustZoneId, setAdjustZoneId,
        adjustCheckInTime, setAdjustCheckInTime,
        adjustCheckOutTime, setAdjustCheckOutTime,
        adjustRecognizedMinutes, setAdjustRecognizedMinutes,
        adjustTodayMinutes, setAdjustTodayMinutes,
        applyAdjust,

        // Actions
        handleCheckIn,
        handleCheckOut,
        handleBulkCheckOut,
        refreshData,

        // Bulk processing
        isBulkProcessing,
        bulkProgress,

        // Computed
        goalMinutes,
        goalLabel,

        // Live tracking
        currentTime,
    };
}
