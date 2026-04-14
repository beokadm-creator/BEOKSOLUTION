import { useState } from 'react';
import { collection, doc, updateDoc, addDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import toast from 'react-hot-toast';
import { Registration, DailyRule, ZoneRule } from '../types';
import { calculateAttendanceMinutes } from '../utils/attendanceCalculator';

interface UseAttendanceActionsProps {
    cid: string | undefined;
    registrations: Registration[];
    zones: ZoneRule[];
    rules: DailyRule | null;
    selectedDate: string;
}

export function useAttendanceActions({ cid, registrations, zones, rules, selectedDate }: UseAttendanceActionsProps) {
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

    const handleCheckIn = async (regId: string, zoneId: string) => {
        if (!cid) return;
        try {
            const reg = registrations.find(r => r.id === regId);

            if (reg?.attendanceStatus === 'INSIDE' && reg.currentZone) {
                if (reg.currentZone === zoneId) {
                    toast.error("Already checked in to this zone.");
                    return;
                }
                await handleCheckOut(regId, reg.currentZone, reg.lastCheckIn, true);
            }

            const collectionName = reg?.isExternal ? 'external_attendees' : 'registrations';
            const regRef = doc(db, 'conferences', cid, collectionName, regId);
            const now = Timestamp.now();
            const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

            await updateDoc(regRef, {
                attendanceStatus: 'INSIDE',
                currentZone: zoneId,
                lastCheckIn: now
            });

            await addDoc(collection(db, 'conferences', cid, collectionName, regId, 'logs'), {
                type: 'ENTER',
                zoneId,
                timestamp: now,
                date: todayStr,
                method: 'MANUAL_ADMIN'
            });

            try {
                const latestSnap = await getDoc(regRef);
                const badgeQr = latestSnap.data()?.badgeQr || regId;
                await addDoc(collection(db, `conferences/${cid}/access_logs`), {
                    action: 'ENTRY',
                    scannedQr: badgeQr,
                    locationId: zoneId,
                    timestamp: now,
                    date: todayStr,
                    method: 'MANUAL_ADMIN',
                    registrationId: regId,
                    isExternal: reg?.isExternal || false,
                });
            } catch (e) {
                console.warn('[AccessLog] Failed to write root access_log on ENTRY (admin):', e);
            }

            toast.success("입장 처리됨 (Checked In)");
        } catch {
            toast.error("Check-in failed");
        }
    };

    const handleCheckOut = async (regId: string, currentZoneId: string | null, lastCheckIn: Timestamp | undefined, isSwitching = false, isBulk = false) => {
        if (!cid) return;
        if (!lastCheckIn || !rules) {
            if (!isBulk) toast.error("체크인 정보가 없거나 규칙이 로드되지 않았습니다.");
            return;
        }

        try {
            const now = new Date();
            const checkInTime = lastCheckIn.toDate();
            const zoneRule = zones.find(z => z.id === currentZoneId);

            const { durationMinutes, deduction, finalMinutes } = calculateAttendanceMinutes(
                checkInTime,
                now,
                zoneRule,
                selectedDate
            );

            const reg = registrations.find(r => r.id === regId);
            const collectionName = reg?.isExternal ? 'external_attendees' : 'registrations';
            const regRef = doc(db, 'conferences', cid, collectionName, regId);

            const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
            const currentTotal = reg?.totalMinutes || 0;
            const newTotal = currentTotal + finalMinutes;

            const dailyMinutes = { ...(reg?.dailyMinutes || {}) };
            dailyMinutes[todayStr] = (dailyMinutes[todayStr] || 0) + finalMinutes;

            const zoneMinutes = { ...(reg?.zoneMinutes || {}) };
            const zoneCompleted = { ...(reg?.zoneCompleted || {}) };

            if (currentZoneId && finalMinutes > 0) {
                zoneMinutes[currentZoneId] = (zoneMinutes[currentZoneId] || 0) + finalMinutes;
            }

            if (currentZoneId && rules.completionMode !== 'CUMULATIVE') {
                const zoneRuleForCompletion = zones.find(z => z.id === currentZoneId);
                if (zoneRuleForCompletion) {
                    const zoneGoal = zoneRuleForCompletion.goalMinutes || rules.globalGoalMinutes || 0;
                    if (zoneGoal > 0 && (zoneMinutes[currentZoneId] || 0) >= zoneGoal) {
                        zoneCompleted[currentZoneId] = true;
                    }
                }
            }

            const anyZoneCompleted = Object.values(zoneCompleted).some(v => v === true);
            const cumulativeCompleted = rules.completionMode === 'CUMULATIVE'
                && rules.cumulativeGoalMinutes
                && newTotal >= rules.cumulativeGoalMinutes;
            const isCompleted = anyZoneCompleted || !!cumulativeCompleted;

            const exitNow = Timestamp.now();

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

            await addDoc(collection(db, 'conferences', cid, collectionName, regId, 'logs'), {
                type: 'EXIT',
                zoneId: currentZoneId,
                timestamp: exitNow,
                date: todayStr,
                method: 'MANUAL_ADMIN',
                rawDuration: durationMinutes,
                deduction,
                recognizedMinutes: finalMinutes
            });

            try {
                const latestSnap = await getDoc(regRef);
                const badgeQr = latestSnap.data()?.badgeQr || regId;
                await addDoc(collection(db, `conferences/${cid}/access_logs`), {
                    action: 'EXIT',
                    scannedQr: badgeQr,
                    locationId: currentZoneId,
                    timestamp: exitNow,
                    date: todayStr,
                    method: 'MANUAL_ADMIN',
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

    return {
        handleCheckIn,
        handleCheckOut,
        handleBulkCheckOut,
        isBulkProcessing,
        bulkProgress
    };
}
