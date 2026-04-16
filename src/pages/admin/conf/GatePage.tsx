import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../../../store/adminStore';
import { doc, getDoc, Timestamp, collection, runTransaction } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Loader2, ArrowLeft, AlertCircle, CheckCircle, Palette, MapPin, LogIn, ScanLine } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';

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
    recognizedMinutes?: number;
    totalMinutes?: number;
    todayMinutes?: number;
    goalMinutes?: number;
    remainingMinutes?: number;
    isCompleted?: boolean;
    rawSessionMinutes?: number;
    deductedMinutes?: number;
}

type ConferenceNameState = {
    ko: string;
    en: string;
    subtitle: string;
};

const GatePage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const { selectedConferenceId } = useAdminStore();
    const [loading, setLoading] = useState(true);

    const [zones, setZones] = useState<any[]>([]);
    const [selectedZoneId, setSelectedZoneId] = useState<string>('');
    const [mode, setMode] = useState<'ENTER_ONLY' | 'EXIT_ONLY' | 'AUTO'>('AUTO');
    const [conferenceName, setConferenceName] = useState<ConferenceNameState>({
        ko: '',
        en: '',
        subtitle: ''
    });

    const [showSettings, setShowSettings] = useState(false);
    const [design, setDesign] = useState<{ textColor: string }>({ textColor: '#000000' });

    const [scannerState, setScannerState] = useState<ScannerState>({
        status: 'IDLE',
        message: 'Ready to Scan',
        lastScanned: ''
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const scanMemoryRef = useRef<Map<string, number>>(new Map());
    const allZonesRef = useRef<any[]>([]);

    useEffect(() => {
        const confId = cid || selectedConferenceId;
        if (!confId) return;

        const init = async () => {
            try {
                const confRef = doc(db, 'conferences', confId);
                const confSnap = await getDoc(confRef);
                if (confSnap.exists()) {
                    const confData = confSnap.data();
                    setConferenceName({
                        ko: confData.title?.ko || 'Conference',
                        en: confData.title?.en || '',
                        subtitle: confData.subtitle || ''
                    });
                }

                const rulesRef = doc(db, `conferences/${confId}/settings/attendance`);
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
                                    globalGoalMinutes: rule.globalGoalMinutes || 0,
                                    completionMode: rule.completionMode || 'DAILY_SEPARATE',
                                    cumulativeGoalMinutes: rule.cumulativeGoalMinutes || 0
                                });
                            });
                        }
                    });
                    allZonesRef.current = allZones;

                    const kstToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
                    const zonesToUse = allZones.some(z => z.ruleDate === kstToday)
                        ? allZones.filter(z => z.ruleDate === kstToday)
                        : allZones;
                    const uniqueZones = Array.from(new Map(zonesToUse.map(item => [item.name || item.id, item])).values());
                    setZones(uniqueZones);

                    const key = `eregi_conf_${confId}_settings`;
                    const saved = localStorage.getItem(key);
                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            if (parsed.gate?.mode) setMode(parsed.gate.mode);
                            if (parsed.gate?.zoneId && uniqueZones.some(z => z.id === parsed.gate.zoneId)) {
                                setSelectedZoneId(parsed.gate.zoneId);
                            }
                        } catch (e) {
                            console.error("Failed to parse settings", e);
                        }
                    }

                    if (uniqueZones.length > 0 && !selectedZoneId) {
                        setSelectedZoneId(uniqueZones[0].id);
                    }
                }
            } catch (e) {
                console.error(e);
                toast.error("Failed to load config");
            } finally {
                setLoading(false);
            }
        };
        init();
        setTimeout(() => inputRef.current?.focus(), 500);
    }, [selectedConferenceId, cid, selectedZoneId]);

    useEffect(() => {
        const confId = cid || selectedConferenceId;
        if (!confId) return;
        const key = `eregi_conf_${confId}_settings`;
        const currentSettings = { gate: { mode, zoneId: selectedZoneId } };
        localStorage.setItem(key, JSON.stringify(currentSettings));
    }, [mode, selectedZoneId, cid, selectedConferenceId]);

    const handleBlur = () => {
        if (!showSettings) setTimeout(() => inputRef.current?.focus(), 100);
    };

    const processScan = async (code: string) => {
        if (scannerState.status === 'PROCESSING') return;
        setInputValue('');

        const nowMs = Date.now();
        // Debounce based on the parsed clean ID, not the raw barcode input
        let parsedIdForDebounce = code;
        const decodeTypos = (s: string) => {
            const map: any = { 'ㅂ': 'q', 'ㅈ': 'w', 'ㄷ': 'e', 'ㄱ': 'r', 'ㅅ': 't', 'ㅛ': 'y', 'ㅕ': 'u', 'ㅑ': 'i', 'ㅐ': 'o', 'ㅔ': 'p', 'ㅁ': 'a', 'ㄴ': 's', 'ㅇ': 'd', 'ㄹ': 'f', 'ㅎ': 'g', 'ㅗ': 'h', 'ㅓ': 'j', 'ㅏ': 'k', 'ㅣ': 'l', 'ㅋ': 'z', 'ㅌ': 'x', 'ㅊ': 'c', 'ㅍ': 'v', 'ㅠ': 'b', 'ㅜ': 'n', 'ㅡ': 'm' };
            // Fix: Do not strip underscores/special chars that might be in IDs
            return s.split('').map(c => map[c] || c).join('').replace(/[^a-zA-Z0-9-_]/g, '');
        };
        const raw = decodeTypos(code).trim();
        parsedIdForDebounce = raw.toUpperCase().startsWith('BADGE-') ? raw.substring(6) : raw;

        const lastScanMs = scanMemoryRef.current.get(parsedIdForDebounce);
        if (lastScanMs && nowMs - lastScanMs < 10000) {
            setScannerState({ status: 'ERROR', message: '너무 빠릅니다. 10초 대기.', lastScanned: parsedIdForDebounce });
            setTimeout(() => setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE' }), 1000);
            return;
        }

        const confId = cid || selectedConferenceId;
        if (!confId || !selectedZoneId) {
            setScannerState({ status: 'ERROR', message: '설정 미완료', lastScanned: parsedIdForDebounce });
            return;
        }

        setScannerState({ status: 'PROCESSING', message: '확인 중...', lastScanned: parsedIdForDebounce });

        try {
            const isExt = parsedIdForDebounce.startsWith('EXT-');
            const res = await processAttendance(parsedIdForDebounce, selectedZoneId, isExt, mode);

            scanMemoryRef.current.set(parsedIdForDebounce, Date.now());
            setScannerState({
                status: 'SUCCESS',
                message: res.actionText,
                subMessage: res.userName,
                lastScanned: parsedIdForDebounce,
                userData: { name: res.userName, affiliation: res.affiliation },
                actionType: res.actionType,
                recognizedMinutes: res.recognizedMinutes,
                totalMinutes: res.totalMinutes,
                todayMinutes: res.todayMinutes,
                goalMinutes: res.goalMinutes,
                remainingMinutes: res.remainingMinutes,
                isCompleted: res.isCompleted,
                rawSessionMinutes: res.rawSessionMinutes,
                deductedMinutes: res.deductedMinutes
            });
        } catch (e: any) {
            console.error(e);
            setScannerState({ status: 'ERROR', message: e.message || 'Scan Failed', lastScanned: parsedIdForDebounce });
        } finally {
            setTimeout(() => setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE' }), 1200);
        }
    };

    const processAttendance = async (id: string, targetZoneId: string, isExt: boolean, currentMode: string) => {
        const confId = cid || selectedConferenceId;
        const col = isExt ? 'external_attendees' : 'registrations';
        const regRef = doc(db, `conferences/${confId}/${col}/${id}`);

        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(regRef);
            if (!snap.exists()) throw new Error('Data not found');
            const data = snap.data();

            if (data.status !== 'PAID' && data.paymentStatus !== 'PAID') throw new Error("결제 미완료");

            const name = data.userName || data.name || data.userInfo?.name || 'Unknown';
            const aff = data.userOrg || data.organization || data.affiliation || data.userInfo?.affiliation || data.userInfo?.organization || data.userEmail || '';
            const status = data.attendanceStatus || 'OUTSIDE';
            const curZoneId = data.currentZone;
            const lastIn = data.lastCheckIn?.toDate();
            const totalMins = data.totalMinutes || 0;

            let action: 'ENTER' | 'EXIT' = 'ENTER';
            let text = '';
            let minsToAdd = 0;
            let rawDuration = 0;
            let deduction = 0;
            const tsNow = Timestamp.now();
            const now = new Date();

            if (currentMode === 'ENTER_ONLY') {
                if (status === 'INSIDE' && curZoneId === targetZoneId) throw new Error('이미 입장 상태');
                action = 'ENTER'; text = status === 'INSIDE' ? 'Zone Switch' : '입장 완료';
            } else if (currentMode === 'EXIT_ONLY') {
                if (status !== 'INSIDE') throw new Error('입장 기록 없음');
                action = 'EXIT'; text = '퇴장 완료';
            } else { // AUTO
                if (status === 'INSIDE') {
                    if (curZoneId !== targetZoneId) { action = 'ENTER'; text = 'Zone Switch'; }
                    else { action = 'EXIT'; text = '퇴장 완료'; }
                } else { action = 'ENTER'; text = '입장 완료'; }
            }

            const isZoneSwitch = status === 'INSIDE' && text === 'Zone Switch' && curZoneId && curZoneId !== targetZoneId;
            if (status === 'INSIDE' && (action === 'EXIT' || isZoneSwitch)) {
                const rule =
                    allZonesRef.current.find(z => z.id === curZoneId) ||
                    zones.find(z => z.id === curZoneId);
                
                // Fallback for missing lastCheckIn
                let safeLastIn = lastIn;
                if (!safeLastIn) {
                    console.warn(`[GatePage] Missing lastCheckIn for ${id}, falling back to now. Duration will be 0.`);
                    safeLastIn = now;
                }
                
                let bS = safeLastIn, bE = now;
                if (rule && rule.start && rule.end) {
                    const ds =
                        rule.ruleDate ||
                        new Date(bS.getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
                    bS = new Date(Math.max(bS.getTime(), new Date(`${ds}T${rule.start}:00+09:00`).getTime()));
                    bE = new Date(Math.min(now.getTime(), new Date(`${ds}T${rule.end}:00+09:00`).getTime()));
                }
                if (bE > bS) {
                    const diff = Math.floor((bE.getTime() - bS.getTime()) / 60000);
                    let ded = 0;
                    if (rule?.breaks) {
                        rule.breaks.forEach((b: any) => {
                            const ds =
                                rule.ruleDate ||
                                new Date(bS.getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
                            const bsS = new Date(`${ds}T${b.start}:00+09:00`), bsE = new Date(`${ds}T${b.end}:00+09:00`);
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

            const dailyMinutes = { ...(data.dailyMinutes || {}) };
            const ruleForExitDate =
                allZonesRef.current.find(z => z.id === curZoneId) ||
                zones.find(z => z.id === curZoneId);
            const ruleForEnterDate =
                allZonesRef.current.find(z => z.id === targetZoneId) ||
                zones.find(z => z.id === targetZoneId);
            const fallbackDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
            const exitDateStr = ruleForExitDate?.ruleDate || fallbackDateStr;
            const enterDateStr = ruleForEnterDate?.ruleDate || fallbackDateStr;
            if (minsToAdd > 0) {
                dailyMinutes[exitDateStr] = (dailyMinutes[exitDateStr] || 0) + minsToAdd;
            }

            // Initialize zone-level tracking maps
            const zoneMinutes: Record<string, number> = { ...(data.zoneMinutes || {}) };
            const zoneCompleted: Record<string, boolean> = { ...(data.zoneCompleted || {}) };

            // Add minutes to the zone being LEFT (curZoneId)
            if (curZoneId && minsToAdd > 0) {
                zoneMinutes[curZoneId] = (zoneMinutes[curZoneId] || 0) + minsToAdd;
            }

            // Per-zone completion check — only in DAILY_SEPARATE mode
            // In CUMULATIVE mode, completion is determined solely by cumulativeGoalMinutes
            if (curZoneId && minsToAdd > 0) {
                const ruleForZone =
                    allZonesRef.current.find(z => z.id === curZoneId) ||
                    zones.find(z => z.id === curZoneId);
                if (ruleForZone && ruleForZone.completionMode !== 'CUMULATIVE') {
                    const zoneGoal = ruleForZone.goalMinutes || ruleForZone.globalGoalMinutes || 0;
                    if (zoneGoal > 0 && (zoneMinutes[curZoneId] || 0) >= zoneGoal) {
                        zoneCompleted[curZoneId] = true;
                    }
                }
            }

            // Backward-compatible isCompleted
            let isComp = data.isCompleted || false;
            const anyZoneCompleted = Object.values(zoneCompleted).some(v => v === true);
            const ruleForCumulative =
                allZonesRef.current.find(z => z.completionMode === 'CUMULATIVE') ||
                allZonesRef.current.find(z => z.id === targetZoneId) ||
                zones.find(z => z.id === targetZoneId) ||
                zones[0] ||
                null;
            const cumulativeCompleted = ruleForCumulative?.completionMode === 'CUMULATIVE'
                && ruleForCumulative.cumulativeGoalMinutes
                && newTotal >= ruleForCumulative.cumulativeGoalMinutes;
            isComp = anyZoneCompleted || !!cumulativeCompleted || isComp;

            const goalMinutes = ruleForCumulative?.completionMode === 'CUMULATIVE'
                ? (ruleForCumulative?.cumulativeGoalMinutes || 0)
                : (ruleForCumulative?.globalGoalMinutes || 0);
            const remainingMinutes = goalMinutes > 0 ? Math.max(0, goalMinutes - newTotal) : 0;
            const statsDateStr = (action === 'EXIT' || isZoneSwitch)
                ? exitDateStr
                : enterDateStr;

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
                const logExitRef = doc(collection(db, `conferences/${confId}/${col}/${id}/logs`));
                tx.set(logExitRef, { type: 'EXIT', zoneId: curZoneId, timestamp: tsNow, date: exitDateStr, method: 'KIOSK_GATE', rawDuration, deduction, recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });

                const logEnterRef = doc(collection(db, `conferences/${confId}/${col}/${id}/logs`));
                tx.set(logEnterRef, { type: 'ENTER', zoneId: targetZoneId, timestamp: tsNow, date: enterDateStr, method: 'KIOSK_GATE', recognizedMinutes: 0, accumulatedTotal: newTotal });

                const accExitRef = doc(collection(db, `conferences/${confId}/access_logs`));
                tx.set(accExitRef, { action: 'EXIT', scannedQr: data.badgeQr || id, locationId: curZoneId, timestamp: tsNow, date: exitDateStr, method: 'KIOSK_GATE', registrationId: id, isExternal: isExt, rawDuration, deduction, recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });

                const accEnterRef = doc(collection(db, `conferences/${confId}/access_logs`));
                tx.set(accEnterRef, { action: 'ENTRY', scannedQr: data.badgeQr || id, locationId: targetZoneId, timestamp: tsNow, date: enterDateStr, method: 'KIOSK_GATE', registrationId: id, isExternal: isExt, recognizedMinutes: 0, accumulatedTotal: newTotal });
            } else {
                const logRef = doc(collection(db, `conferences/${confId}/${col}/${id}/logs`));
                const logDateStr = action === 'ENTER' ? enterDateStr : exitDateStr;
                tx.set(logRef, { type: action, zoneId: action === 'ENTER' ? targetZoneId : curZoneId, timestamp: tsNow, date: logDateStr, method: 'KIOSK_GATE', rawDuration: action === 'EXIT' ? rawDuration : 0, deduction: action === 'EXIT' ? deduction : 0, recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });

                const accRef = doc(collection(db, `conferences/${confId}/access_logs`));
                const logDateStr2 = action === 'ENTER' ? enterDateStr : exitDateStr;
                tx.set(accRef, { action: action === 'ENTER' ? 'ENTRY' : 'EXIT', scannedQr: data.badgeQr || id, locationId: action === 'ENTER' ? targetZoneId : curZoneId, timestamp: tsNow, date: logDateStr2, method: 'KIOSK_GATE', registrationId: id, isExternal: isExt, rawDuration: action === 'EXIT' ? rawDuration : 0, deduction: action === 'EXIT' ? deduction : 0, recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });
            }

            return {
                actionText: text,
                actionType: action,
                userName: name,
                affiliation: aff,
                recognizedMinutes: minsToAdd,
                totalMinutes: newTotal,
                todayMinutes: dailyMinutes[statsDateStr] || 0,
                goalMinutes,
                remainingMinutes,
                isCompleted: isComp,
                rawSessionMinutes: rawDuration,
                deductedMinutes: deduction
            };
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && inputValue.trim()) processScan(inputValue.trim()); };

    if (loading) return <div className="p-10 text-center font-bold">Loading...</div>;

    const activeZone = zones.find(z => z.id === selectedZoneId);
    const modeLabel =
        mode === 'AUTO'
            ? { ko: '자동', en: 'Auto', tone: 'bg-cyan-600' }
            : mode === 'ENTER_ONLY'
                ? { ko: '입장', en: 'Entry', tone: 'bg-sky-600' }
                : { ko: '퇴장', en: 'Exit', tone: 'bg-indigo-700' };

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(3,105,161,0.16),_transparent_34%),linear-gradient(180deg,_#f3fbfd_0%,_#f8fafc_46%,_#eef6fb_100%)] font-sans">
            <div className="z-[100] flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-6 py-3 text-white backdrop-blur">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-400">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Exit
                    </Button>
                    <div className="flex items-center gap-2">
                        <select value={selectedZoneId} onChange={e => setSelectedZoneId(e.target.value)} className="bg-slate-800 border-none rounded px-2 py-1 text-sm font-bold">
                            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-1 bg-slate-800 p-1 rounded">
                        {(['ENTER_ONLY', 'EXIT_ONLY', 'AUTO'] as const).map(m => (
                            <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded text-[10px] font-bold ${mode === m ? 'bg-blue-600' : 'text-slate-500'}`}>{m}</button>
                        ))}
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className="text-slate-400"><Palette className="w-4 h-4" /></Button>
            </div>

            <div className="relative flex flex-1 flex-col items-center justify-center p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(15,23,42,0.06),_transparent_28%)]" />

                <div className="z-10 mb-8 w-full max-w-6xl text-center">
                    <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-sky-700 shadow-sm backdrop-blur">
                        <MapPin className="h-4 w-4" /> Gate Scanner
                    </div>
                    <div className="mt-6 rounded-[2rem] border border-white/70 bg-white/82 px-8 py-8 shadow-[0_32px_100px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
                        <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
                            {conferenceName.ko}
                        </h1>
                        {conferenceName.en && (
                            <p className="mt-3 text-xl font-semibold tracking-wide text-slate-500 md:text-3xl">
                                {conferenceName.en}
                            </p>
                        )}
                        {conferenceName.subtitle && (
                            <p className="mt-4 text-lg font-medium text-slate-400 md:text-2xl">
                                {conferenceName.subtitle}
                            </p>
                        )}
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 font-bold text-slate-600">
                                <MapPin className="w-4 h-4" /> {activeZone?.name}
                            </div>
                            <div className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.22em] text-white shadow-lg", modeLabel.tone)}>
                                {modeLabel.en}
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
                                {modeLabel.ko}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="z-10 w-full max-w-5xl overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/90 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
                    <div className="border-b border-slate-200 bg-[linear-gradient(90deg,_#0f172a_0%,_#075985_52%,_#0ea5e9_100%)] px-8 py-5 text-white">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="mt-1 text-2xl font-black">
                                    {modeLabel.ko} 모드
                                </p>
                            </div>
                            <div className={cn("rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.24em] text-white", modeLabel.tone)}>
                                {mode}
                            </div>
                        </div>
                    </div>

                    <div className="p-12 flex flex-col items-center">
                        <div className="mb-8 p-8 rounded-full bg-slate-50">
                            {scannerState.status === 'IDLE' && <LogIn className="w-16 h-16 text-slate-200" />}
                            {scannerState.status === 'PROCESSING' && <Loader2 className="w-16 h-16 animate-spin text-blue-500" />}
                            {scannerState.status === 'SUCCESS' && <CheckCircle className="w-16 h-16 text-green-500" />}
                            {scannerState.status === 'ERROR' && <AlertCircle className="w-16 h-16 text-red-500" />}
                        </div>
                        {scannerState.status === 'IDLE' && (
                            <div className="mb-8 rounded-[1.75rem] border border-dashed border-sky-300 bg-sky-50 px-8 py-8 text-center">
                                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[1.5rem] bg-[linear-gradient(135deg,_#0f172a_0%,_#0369a1_100%)] text-white shadow-xl">
                                    <ScanLine className="h-10 w-10" />
                                </div>
                                <p className="mt-5 text-3xl font-black tracking-tight text-slate-900">
                                    QR SCAN
                                </p>
                            </div>
                        )}
                        <h2 className={cn("text-5xl font-black mb-4", scannerState.status === 'ERROR' ? "text-red-600" : scannerState.status === 'SUCCESS' ? "text-green-600" : "text-slate-900")}>
                            {scannerState.message}
                        </h2>
                        {scannerState.status === 'SUCCESS' && scannerState.isCompleted && (
                            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full font-black text-sm mb-4">
                                <CheckCircle className="w-4 h-4" />
                                수강완료
                            </div>
                        )}
                        {scannerState.subMessage && <p className="text-3xl font-bold text-slate-700">{scannerState.subMessage}</p>}
                        {scannerState.userData && <p className="mt-2 text-xl font-medium text-slate-400">{scannerState.userData.affiliation}</p>}
                        {scannerState.status === 'SUCCESS' && typeof scannerState.totalMinutes === 'number' && (
                            <div className="mt-8 w-full max-w-4xl">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left">
                                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">이번 체류 시간</div>
                                        <div className="mt-1 text-2xl font-black text-slate-900">{scannerState.rawSessionMinutes || 0}분</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left">
                                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">휴식 차감</div>
                                        <div className="mt-1 text-2xl font-black text-slate-900">{scannerState.deductedMinutes || 0}분</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left">
                                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">이번 스캔 인정</div>
                                        <div className="mt-1 text-2xl font-black text-slate-900">{scannerState.recognizedMinutes || 0}분</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left">
                                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">오늘 누적</div>
                                        <div className="mt-1 text-2xl font-black text-slate-900">{scannerState.todayMinutes || 0}분</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left">
                                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">총 누적</div>
                                        <div className="mt-1 text-2xl font-black text-slate-900">{scannerState.totalMinutes}분</div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left">
                                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">남은 시간</div>
                                        <div className="mt-1 text-2xl font-black text-slate-900">
                                            {scannerState.goalMinutes ? (scannerState.remainingMinutes || 0) : '-'}분
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-10 flex items-center gap-2 text-slate-300 font-bold uppercase tracking-widest animate-pulse">
                    Scan QR
                </div>

                <input ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleBlur} className="absolute opacity-0 pointer-events-none" autoFocus />
            </div>

            {showSettings && (
                <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
                        <h3 className="font-black text-xl mb-6">Settings</h3>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Text Color</label>
                                <input type="color" value={design.textColor} onChange={e => setDesign(p => ({ ...p, textColor: e.target.value }))} className="w-full h-10 p-1 rounded border-none" />
                            </div>
                            <Button className="w-full font-bold" onClick={() => setShowSettings(false)}>Close</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GatePage;
