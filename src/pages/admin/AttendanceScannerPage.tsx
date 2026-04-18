import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, Timestamp, addDoc, collection, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2, AlertCircle, CheckCircle, X, MapPin, LogIn } from 'lucide-react';
import { Button } from '../../components/ui/button';
import toast from 'react-hot-toast';
import { getKstToday } from '../../utils/dateUtils';

interface ScannerState {
    status: 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
    message: string;
    subMessage?: string;
    lastScanned: string;
    userData?: {
        name: string;
        affiliation: string;
    };
    actionType?: 'ENTER' | 'EXIT';
}

const AttendanceScannerPage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const [loading, setLoading] = useState(true);

    const [zones, setZones] = useState<any[]>([]);
    const [selectedZoneId, setSelectedZoneId] = useState<string>('');
    const [mode, setMode] = useState<'ENTER_ONLY' | 'EXIT_ONLY' | 'AUTO'>('ENTER_ONLY');
    const [conferenceTitle, setConferenceTitle] = useState('');
    const [conferenceSubtitle, setConferenceSubtitle] = useState('');

    const [scannerState, setScannerState] = useState<ScannerState>({
        status: 'IDLE',
        message: 'Ready to Scan',
        lastScanned: ''
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const scanMemoryRef = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        if (!cid) return;
        const init = async () => {
            try {
                const confRef = doc(db, 'conferences', cid);
                const confSnap = await getDoc(confRef);
                if (confSnap.exists()) {
                    setConferenceTitle(confSnap.data().title?.ko || 'Conference');
                    setConferenceSubtitle(confSnap.data().subtitle || '');
                }

                const rulesRef = doc(db, `conferences/${cid}/settings/attendance`);
                const rulesSnap = await getDoc(rulesRef);
                if (rulesSnap.exists()) {
                    const allRules = rulesSnap.data().rules || {};
                    const allZones: any[] = [];
                    Object.entries(allRules).forEach(([dateStr, rule]: [string, any]) => {
                        if (rule?.zones) {
                            rule.zones.forEach((z: any) => {
                                allZones.push({
                                    ...z,
                                    ruleDate: dateStr,
                                    globalGoalMinutes: rule.globalGoalMinutes || 240,
                                    completionMode: rule.completionMode || 'DAILY_SEPARATE',
                                    cumulativeGoalMinutes: rule.cumulativeGoalMinutes || 0
                                });
                            });
                        }
                    });

                    const uniqueZones = Array.from(new Map(allZones.map((item: any) => [item.id, item])).values());
                    setZones(uniqueZones);
                    if (uniqueZones.length > 0) setSelectedZoneId(uniqueZones[0].id);
                }
            } catch (e) {
                console.error(e);
                toast.error("Failed to load scanner config");
            } finally {
                setLoading(false);
            }
        };
        init();
        setTimeout(() => inputRef.current?.focus(), 500);
    }, [cid]);

    const handleBlur = () => setTimeout(() => inputRef.current?.focus(), 100);

    const processScan = async (code: string) => {
        if (scannerState.status === 'PROCESSING') return;
        setInputValue('');

        const nowMs = Date.now();
        const lastScanMs = scanMemoryRef.current.get(code);
        if (lastScanMs && nowMs - lastScanMs < 10000) {
            setScannerState({ status: 'ERROR', message: '너무 빠릅니다. (10초 대기)', lastScanned: code });
            setTimeout(() => setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE' }), 1000);
            return;
        }

        if (!selectedZoneId || !cid) { setScannerState({ status: 'ERROR', message: '설정 미완료', lastScanned: code }); return; }

        setScannerState({ status: 'PROCESSING', message: '확인 중...', lastScanned: code });

        try {
            const decodeTypos = (s: string) => {
                const map: any = { 'ㅂ': 'q', 'ㅈ': 'w', 'ㄷ': 'e', 'ㄱ': 'r', 'ㅅ': 't', 'ㅛ': 'y', 'ㅕ': 'u', 'ㅑ': 'i', 'ㅐ': 'o', 'ㅔ': 'p', 'ㅁ': 'a', 'ㄴ': 's', 'ㅇ': 'd', 'ㄹ': 'f', 'ㅎ': 'g', 'ㅗ': 'h', 'ㅓ': 'j', 'ㅏ': 'k', 'ㅣ': 'l', 'ㅋ': 'z', 'ㅌ': 'x', 'ㅊ': 'c', 'ㅍ': 'v', 'ㅠ': 'b', 'ㅜ': 'n', 'ㅡ': 'm' };
                return s.split('').map(c => map[c] || c).join('').replace(/[^a-zA-Z0-9-]/g, '');
            };

            const raw = decodeTypos(code).trim();
            let id = raw;
            if (raw.toUpperCase().startsWith('BADGE-')) id = raw.substring(6);

            const isExt = id.startsWith('EXT-');
            const res = await runAttendanceTransaction(id, selectedZoneId, isExt, mode);

            scanMemoryRef.current.set(code, Date.now());
            setScannerState({
                status: 'SUCCESS',
                message: res.actionText,
                subMessage: res.userName,
                lastScanned: id,
                userData: { name: res.userName, affiliation: res.affiliation },
                actionType: res.actionType
            });
        } catch (e: any) {
            console.error(e);
            setScannerState({ status: 'ERROR', message: e.message || 'Error', lastScanned: code });
        } finally {
            setTimeout(() => setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE' }), 2000);
        }
    };

    const runAttendanceTransaction = async (id: string, targetZoneId: string, isExt: boolean, curMode: string) => {
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
            const lastOut = data.lastCheckOut?.toDate();
            const totalMins = data.totalMinutes || 0;

            let action: 'ENTER' | 'EXIT' = 'ENTER';
            let actionText = '';
            let minsToAdd = 0;
            let rawDuration = 0;
            let deduction = 0;
            const tsNow = Timestamp.now();
            const now = new Date();

            // 1분(60초) 이내 중복 스캔 방지 (더블 스캔 원천 차단)
            if (lastIn && status === 'INSIDE' && (now.getTime() - lastIn.getTime() < 60000)) {
                throw new Error('방금 입장하셨습니다. (1분 대기)');
            }
            if (lastOut && status === 'OUTSIDE' && (now.getTime() - lastOut.getTime() < 60000)) {
                throw new Error('방금 퇴장하셨습니다. (1분 대기)');
            }

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

            const isZoneSwitch = status === 'INSIDE' && actionText === 'Zone Switch' && curZoneId && curZoneId !== targetZoneId;
            if (status === 'INSIDE' && (action === 'EXIT' || isZoneSwitch)) {
                // M7 Fix: Missing lastCheckIn fallback handling
                if (!lastIn) {
                    throw new Error('입장 시간 기록(lastCheckIn)이 누락되어 처리할 수 없습니다.');
                }
                const checkInDateStr = getKstToday(lastIn);
                const rule = zones.find(z => z.id === curZoneId) || allZones.find(z => z.id === curZoneId && z.ruleDate === checkInDateStr) || allZones.find(z => z.id === curZoneId);

                let bS = lastIn, bE = now;
                if (rule && rule.start && rule.end) {
                    // Fix: Extract KST date correctly using getKstToday
                    const ds = rule.ruleDate || getKstToday(bS);
                    const zs = new Date(`${ds}T${rule.start}:00+09:00`);
                    const ze = new Date(`${ds}T${rule.end}:00+09:00`);
                    if (ze < zs) ze.setDate(ze.getDate() + 1);
                    bS = new Date(Math.max(bS.getTime(), zs.getTime()));
                    bE = new Date(Math.min(now.getTime(), ze.getTime()));
                }
                if (bE > bS) {
                    const diff = Math.floor((bE.getTime() - bS.getTime()) / 60000);
                    let ded = 0;
                    if (rule?.breaks) {
                        rule.breaks.forEach((b: any) => {
                            const ds = rule.ruleDate || getKstToday(bS);
                            const bsS = new Date(`${ds}T${b.start}:00+09:00`);
                            const bsE = new Date(`${ds}T${b.end}:00+09:00`);
                            if (bsE < bsS) bsE.setDate(bsE.getDate() + 1);
                            const oS = Math.max(bS.getTime(), bsS.getTime()), oE = Math.min(bE.getTime(), bsE.getTime());
                            if (oE > oS) ded += Math.floor((oE - oS) / 60000);
                        });
                    }
                    rawDuration = diff;
                    deduction = ded;
                    minsToAdd = Math.max(0, diff - ded);
                }
            }

            const newTotal = totalMins + minsToAdd;

            const fallbackDateStr = getKstToday();
            const dailyDateStr = (action === 'EXIT' || isZoneSwitch) && lastIn ? getKstToday(lastIn) : fallbackDateStr;
            const dailyMinutes = { ...(data.dailyMinutes || {}) };
            dailyMinutes[dailyDateStr] = (dailyMinutes[dailyDateStr] || 0) + minsToAdd;

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

            if (isZoneSwitch) {
                tx.update(regRef, {
                    attendanceStatus: 'INSIDE',
                    currentZone: targetZoneId,
                    totalMinutes: newTotal,
                    dailyMinutes: dailyMinutes,
                    zoneMinutes: zoneMinutes,
                    zoneCompleted: zoneCompleted,
                    isCompleted: isComp,
                    lastCheckOut: tsNow,
                    lastCheckIn: tsNow
                });
            } else {
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
            }

            if (isZoneSwitch) {
                const logExitRef = doc(collection(db, `conferences/${cid}/${col}/${id}/logs`));
                tx.set(logExitRef, { type: 'EXIT', zoneId: curZoneId, timestamp: tsNow, date: todayStr, method: 'KIOSK_DESK', rawDuration, deduction, recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });

                const logEnterRef = doc(collection(db, `conferences/${cid}/${col}/${id}/logs`));
                tx.set(logEnterRef, { type: 'ENTER', zoneId: targetZoneId, timestamp: tsNow, date: todayStr, method: 'KIOSK_DESK', recognizedMinutes: 0, accumulatedTotal: newTotal });

                const accExitRef = doc(collection(db, `conferences/${cid}/access_logs`));
                tx.set(accExitRef, { action: 'EXIT', scannedQr: data.badgeQr || id, locationId: curZoneId, timestamp: tsNow, date: todayStr, method: 'KIOSK_DESK', registrationId: id, isExternal: isExt, rawDuration, deduction, recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });

                const accEnterRef = doc(collection(db, `conferences/${cid}/access_logs`));
                tx.set(accEnterRef, { action: 'ENTRY', scannedQr: data.badgeQr || id, locationId: targetZoneId, timestamp: tsNow, date: todayStr, method: 'KIOSK_DESK', registrationId: id, isExternal: isExt, recognizedMinutes: 0, accumulatedTotal: newTotal });
            } else {
                const logRef = doc(collection(db, `conferences/${cid}/${col}/${id}/logs`));
                tx.set(logRef, { type: action, zoneId: action === 'ENTER' ? targetZoneId : curZoneId, timestamp: tsNow, date: todayStr, method: 'KIOSK_DESK', rawDuration: action === 'EXIT' ? rawDuration : 0, deduction: action === 'EXIT' ? deduction : 0, recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });

                const accRef = doc(collection(db, `conferences/${cid}/access_logs`));
                tx.set(accRef, { action: action === 'ENTER' ? 'ENTRY' : 'EXIT', scannedQr: data.badgeQr || id, locationId: action === 'ENTER' ? targetZoneId : curZoneId, timestamp: tsNow, date: todayStr, method: 'KIOSK_DESK', registrationId: id, isExternal: isExt, rawDuration: action === 'EXIT' ? rawDuration : 0, deduction: action === 'EXIT' ? deduction : 0, recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });
            }

            return { actionText, actionType: action, userName: name, affiliation: aff };
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && inputValue.trim()) processScan(inputValue.trim()); };

    if (loading) return <div className="p-20 text-center font-bold animate-pulse">Initializing Kiosk...</div>;

    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col font-sans">
            <div className="bg-slate-100 p-3 flex justify-between items-center border-b shadow-sm">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-500"><X className="w-4 h-4 mr-1" /> Close</Button>
                <div className="flex gap-4 items-center">
                    <select value={selectedZoneId} onChange={e => setSelectedZoneId(e.target.value)} className="bg-white border rounded p-1 font-bold text-sm">
                        {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                    <div className="flex bg-white rounded p-0.5 border shadow-inner">
                        {(['ENTER_ONLY', 'EXIT_ONLY', 'AUTO'] as const).map(m => (
                            <button key={m} onClick={() => setMode(m)} className={`px-4 py-1 rounded text-[10px] font-black transition-all ${mode === m ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{m}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                <div className="mb-12 pointer-events-none">
                    <h1 className="text-4xl font-black text-slate-900 mb-2">{conferenceTitle}</h1>
                    <p className="text-slate-500 text-xl font-medium">{conferenceSubtitle}</p>
                    <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 px-4 py-1 rounded-full text-slate-600 font-bold border border-slate-200"><MapPin className="w-4 h-4" /> {zones.find(z => z.id === selectedZoneId)?.name}</div>
                </div>

                <div className={cn("mb-10 px-8 py-3 rounded-full text-white font-black tracking-widest shadow-2xl animate-pulse", mode === 'ENTER_ONLY' ? 'bg-blue-600' : mode === 'EXIT_ONLY' ? 'bg-red-600' : 'bg-purple-600')}>
                    {mode} MODE
                </div>

                <div className="w-full max-w-2xl bg-white rounded-[50px] shadow-[0_40px_80px_rgba(0,0,0,0.1)] border border-slate-50 p-16 flex flex-col items-center">
                    <div className="mb-10 p-10 rounded-full bg-slate-50 shadow-inner">
                        {scannerState.status === 'IDLE' && <LogIn className="w-16 h-16 text-slate-200" />}
                        {scannerState.status === 'PROCESSING' && <Loader2 className="w-16 h-16 animate-spin text-blue-500" />}
                        {scannerState.status === 'SUCCESS' && <CheckCircle className="w-16 h-16 text-green-500 animate-in zoom-in duration-300" />}
                        {scannerState.status === 'ERROR' && <AlertCircle className="w-16 h-16 text-red-500 animate-in shake-in duration-300" />}
                    </div>
                    <h2 className={cn("text-6xl font-black mb-6 transition-all", scannerState.status === 'ERROR' ? 'text-red-600' : scannerState.status === 'SUCCESS' ? 'text-green-600' : 'text-slate-900')}>
                        {scannerState.message}
                    </h2>
                    {scannerState.status === 'SUCCESS' && (
                        <div className="text-2xl font-bold text-slate-500 mb-8 bg-slate-100 px-6 py-2 rounded-full border border-slate-200">
                            {scannerState.actionType === 'ENTER' ? '입장 시간' : '퇴장 시간'}: {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    )}
                    {scannerState.subMessage && <p className="text-3xl font-bold text-slate-700">{scannerState.subMessage}</p>}
                    {scannerState.userData && <p className="text-xl text-slate-400 mt-4 font-bold">{scannerState.userData.affiliation}</p>}
                </div>

                <div className="mt-12 flex items-center gap-3 text-slate-300 font-black uppercase tracking-[0.3em]">
                    <div className="w-2 h-2 rounded-full bg-slate-200 animate-ping" /> SCAN QR
                </div>

                <input ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleBlur} className="absolute opacity-0 pointer-events-none" autoFocus />
            </div>
        </div>
    );
};

export default AttendanceScannerPage;
