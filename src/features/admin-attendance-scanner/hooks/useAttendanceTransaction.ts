import { doc, collection, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Zone } from '../types';

export function useAttendanceTransaction(cid: string | undefined, zones: Zone[]) {
    const runAttendanceTransaction = async (id: string, targetZoneId: string, isExt: boolean, curMode: string) => {
        if (!cid) throw new Error('Conference ID missing');

        const col = isExt ? 'external_attendees' : 'registrations';
        const regRef = doc(db, `conferences/${cid}/${col}/${id}`);

        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(regRef);
            if (!snap.exists()) throw new Error('Data not found');
            const data = snap.data();

            if (data.status !== 'PAID' && data.paymentStatus !== 'PAID') throw new Error('결제 미완료');

            const name = data.userName || data.name || data.userInfo?.name || 'Unknown';
            const aff = data.userOrg || data.organization || data.affiliation || data.userInfo?.affiliation || data.userInfo?.organization || data.userEmail || '';
            const status = data.attendanceStatus || 'OUTSIDE';
            const curZoneId = data.currentZone;
            const lastIn = data.lastCheckIn?.toDate();
            const totalMins = data.totalMinutes || 0;

            let action: 'ENTER' | 'EXIT' = 'ENTER';
            let actionText = '';
            let minsToAdd = 0;
            const tsNow = Timestamp.now();
            const now = new Date();

            if (curMode === 'ENTER_ONLY') {
                if (status === 'INSIDE' && curZoneId === targetZoneId) throw new Error('이미 입장 상태');
                action = 'ENTER'; actionText = status === 'INSIDE' ? 'Zone Switch' : '입장 완료';
            } else if (curMode === 'EXIT_ONLY') {
                if (status !== 'INSIDE') throw new Error('입장 기록 없음');
                action = 'EXIT'; actionText = '퇴장 완료';
            } else { // AUTO
                if (status === 'INSIDE') {
                    if (curZoneId !== targetZoneId) { action = 'ENTER'; actionText = 'Zone Switch'; }
                    else { action = 'EXIT'; actionText = '퇴장 완료'; }
                } else { action = 'ENTER'; actionText = '입장 완료'; }
            }

            if (status === 'INSIDE' && (action === 'EXIT' || actionText === 'Zone Switch')) {
                const rule = zones.find(z => z.id === curZoneId);

                // M7 Fix: Missing lastCheckIn fallback handling
                if (!lastIn) {
                    throw new Error('입장 시간 기록(lastCheckIn)이 누락되어 처리할 수 없습니다.');
                }

                let bS = lastIn, bE = now;
                if (rule && rule.start && rule.end) {
                    // Fix: Extract KST date correctly
                    const kstMs = bS.getTime() + 9 * 60 * 60 * 1000;
                    const ds = new Date(kstMs).toISOString().split('T')[0];
                    bS = new Date(Math.max(bS.getTime(), new Date(`${ds}T${rule.start}:00+09:00`).getTime()));
                    bE = new Date(Math.min(now.getTime(), new Date(`${ds}T${rule.end}:00+09:00`).getTime()));
                }
                if (bE > bS) {
                    const diff = Math.floor((bE.getTime() - bS.getTime()) / 60000);
                    let ded = 0;
                    if (rule?.breaks) {
                        rule.breaks.forEach((b: any) => {
                            const kstMs = bS.getTime() + 9 * 60 * 60 * 1000;
                            const ds = new Date(kstMs).toISOString().split('T')[0];
                            const bsS = new Date(`${ds}T${b.start}:00+09:00`), bsE = new Date(`${ds}T${b.end}:00+09:00`);
                            const oS = Math.max(bS.getTime(), bsS.getTime()), oE = Math.min(bE.getTime(), bsE.getTime());
                            if (oE > oS) ded += Math.floor((oE - oS) / 60000);
                        });
                    }
                    minsToAdd = Math.max(0, diff - ded);
                }
            }

            const newTotal = totalMins + minsToAdd;

            const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
            const dailyMinutes = { ...(data.dailyMinutes || {}) };
            dailyMinutes[todayStr] = (dailyMinutes[todayStr] || 0) + minsToAdd;

            const zoneMinutes: Record<string, number> = { ...(data.zoneMinutes || {}) };
            const zoneCompleted: Record<string, boolean> = { ...(data.zoneCompleted || {}) };

            if (curZoneId && minsToAdd > 0) {
                zoneMinutes[curZoneId] = (zoneMinutes[curZoneId] || 0) + minsToAdd;
            }

            // Per-zone completion check — only in DAILY_SEPARATE mode
            // In CUMULATIVE mode, completion is determined solely by cumulativeGoalMinutes
            if (curZoneId && minsToAdd > 0) {
                const ruleForZone = zones.find(z => z.id === curZoneId);
                if (ruleForZone && ruleForZone.completionMode !== 'CUMULATIVE') {
                    const zoneGoal = ruleForZone.goalMinutes || ruleForZone.globalGoalMinutes || 0;
                    if (zoneGoal > 0 && (zoneMinutes[curZoneId] || 0) >= zoneGoal) {
                        zoneCompleted[curZoneId] = true;
                    }
                }
            }

            let isComp = data.isCompleted || false;
            const anyZoneCompleted = Object.values(zoneCompleted).some(v => v === true);
            const ruleForCumulative = zones.length > 0 ? zones[0] : null;
            const cumulativeCompleted = ruleForCumulative?.completionMode === 'CUMULATIVE'
                && ruleForCumulative.cumulativeGoalMinutes
                && newTotal >= ruleForCumulative.cumulativeGoalMinutes;
            isComp = anyZoneCompleted || !!cumulativeCompleted || isComp;

            tx.update(regRef, {
                attendanceStatus: action === 'ENTER' ? 'INSIDE' : 'OUTSIDE',
                currentZone: action === 'ENTER' ? targetZoneId : null,
                totalMinutes: newTotal,
                dailyMinutes: dailyMinutes,
                zoneMinutes: zoneMinutes,
                zoneCompleted: zoneCompleted,
                isCompleted: isComp,
                [action === 'ENTER' ? 'lastCheckIn' : 'lastCheckOut']: tsNow
            });

            const logRef = doc(collection(db, `conferences/${cid}/${col}/${id}/logs`));
            tx.set(logRef, { type: action, zoneId: action === 'ENTER' ? targetZoneId : curZoneId, timestamp: tsNow, date: todayStr, method: 'KIOSK', recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });

            const accRef = doc(collection(db, `conferences/${cid}/access_logs`));
            tx.set(accRef, { action: action === 'ENTER' ? 'ENTRY' : 'EXIT', scannedQr: data.badgeQr || id, locationId: action === 'ENTER' ? targetZoneId : curZoneId, timestamp: tsNow, date: todayStr, method: 'KIOSK_DESK', registrationId: id, isExternal: isExt, recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });

            return { actionText, actionType: action, userName: name, affiliation: aff };
        });
    };

    return { runAttendanceTransaction };
}
