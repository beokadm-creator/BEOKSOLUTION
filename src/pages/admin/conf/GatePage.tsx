import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../../../store/adminStore';
import { doc, getDoc, Timestamp, collection, runTransaction } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Loader2, ArrowLeft, AlertCircle, CheckCircle, Palette, MapPin, ScanLine } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { getKstToday } from '../../../utils/dateUtils';

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

                    const kstToday = getKstToday();
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
            setTimeout(() => setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE' }), 2000);
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
            const lastOut = data.lastCheckOut?.toDate();
            const totalMins = data.totalMinutes || 0;

            let action: 'ENTER' | 'EXIT' = 'ENTER';
            let text = '';
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
                const todayStr = getKstToday();
                const rule =
                    allZonesRef.current.find(z => z.id === curZoneId && z.ruleDate === todayStr) ||
                    zones.find(z => z.id === curZoneId) ||
                    allZonesRef.current.find(z => z.id === curZoneId);
                
                // Fallback for missing lastCheckIn
                let safeLastIn = lastIn;
                if (!safeLastIn) {
                    console.warn(`[GatePage] Missing lastCheckIn for ${id}, falling back to now. Duration will be 0.`);
                    safeLastIn = now;
                }
                
                let bS = safeLastIn, bE = now;
                if (rule && rule.start && rule.end) {
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

            const dailyMinutes = { ...(data.dailyMinutes || {}) };
            const fallbackDateStr = getKstToday();
            const ruleForExitDate =
                allZonesRef.current.find(z => z.id === curZoneId && z.ruleDate === fallbackDateStr) ||
                zones.find(z => z.id === curZoneId) ||
                allZonesRef.current.find(z => z.id === curZoneId);
            const ruleForEnterDate =
                allZonesRef.current.find(z => z.id === targetZoneId && z.ruleDate === fallbackDateStr) ||
                zones.find(z => z.id === targetZoneId) ||
                allZonesRef.current.find(z => z.id === targetZoneId);

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
                    allZonesRef.current.find(z => z.id === curZoneId && z.ruleDate === fallbackDateStr) ||
                    zones.find(z => z.id === curZoneId) ||
                    allZonesRef.current.find(z => z.id === curZoneId);
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
                allZonesRef.current.find(z => z.completionMode === 'CUMULATIVE' && z.ruleDate === fallbackDateStr) ||
                allZonesRef.current.find(z => z.id === targetZoneId && z.ruleDate === fallbackDateStr) ||
                zones.find(z => z.id === targetZoneId) ||
                allZonesRef.current.find(z => z.id === targetZoneId) ||
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
            const statsDateStr = (action === 'EXIT' || isZoneSwitch) ? exitDateStr : enterDateStr;

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

    return (
        <div
            className="fixed inset-0 z-[99999] flex flex-col overflow-hidden font-sans transition-colors duration-500 bg-[#0A192F]"
            style={{
                backgroundImage: (design as any).bgImage ? `url(${(design as any).bgImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: (design as any).bgColor || '#0A192F',
                color: design.textColor || '#ffffff'
            }}
        >
            <style>{`
                @keyframes scan {
                    0% { transform: translateY(-110%); opacity: 0; }
                    15% { opacity: 1; }
                    50% { transform: translateY(0%); opacity: 1; }
                    85% { opacity: 1; }
                    100% { transform: translateY(110%); opacity: 0; }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-10px); }
                    40% { transform: translateX(10px); }
                    60% { transform: translateX(-6px); }
                    80% { transform: translateX(6px); }
                }
            `}</style>
            {/* Minimal Background Effects for Professional Kiosk Look */}
            {!(design as any).bgImage && (
                <>
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0A192F] via-[#0D2A4A] to-[#044B7F] opacity-90" />
                    <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#00E5FF]/10 to-transparent" />
                    <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-[#00E5FF]/5 rounded-full blur-3xl" />
                </>
            )}
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
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-3 py-1 rounded text-[10px] font-bold ${mode === m ? 'bg-blue-600' : 'text-slate-500'}`}
                            >
                                {m === 'ENTER_ONLY' ? '입장' : m === 'EXIT_ONLY' ? '퇴장' : '자동'}
                            </button>
                        ))}
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className="text-slate-400"><Palette className="w-4 h-4" /></Button>
            </div>

            <div className="relative flex flex-1 flex-col items-center justify-center p-8 z-10 w-full max-w-7xl mx-auto">
                
                <div className="z-10 mb-12 w-full text-center">
                    <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/10 px-5 py-2.5 text-sm font-black uppercase tracking-[0.2em] text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.2)] backdrop-blur">
                        <MapPin className="h-5 w-5" /> KIOSK - GATE SCANNER
                    </div>
                    <div className="mt-8 px-4">
                        <h1 className="text-5xl font-black tracking-tight text-white md:text-7xl drop-shadow-xl" style={{ wordBreak: 'keep-all' }}>
                            {conferenceName.ko}
                        </h1>
                        {conferenceName.en && (
                            <p className="mt-4 text-2xl font-bold tracking-wide text-sky-200 md:text-4xl opacity-90">
                                {conferenceName.en}
                            </p>
                        )}
                        {conferenceName.subtitle && (
                            <p className="mt-5 text-xl font-medium text-sky-400 md:text-3xl opacity-80">
                                {conferenceName.subtitle}
                            </p>
                        )}
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                            <div className="inline-flex items-center gap-3 rounded-full bg-white/10 border border-white/20 px-7 py-3 text-xl font-black text-white backdrop-blur shadow-[0_0_25px_rgba(0,229,255,0.12)]">
                                <MapPin className="w-6 h-6 text-[#00E5FF]" /> {activeZone?.name}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="z-10 w-full max-w-4xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-500">
                    <div className="p-12 flex flex-col items-center">
                        <div className="mb-8 flex items-center justify-center">
                            <div className="inline-flex items-center justify-center rounded-full border border-[#00E5FF]/35 bg-[#00E5FF]/10 px-8 py-2.5 text-2xl font-black uppercase tracking-[0.28em] text-[#00E5FF] shadow-[0_0_30px_rgba(0,229,255,0.18)] backdrop-blur">
                                {mode === 'AUTO' ? 'AUTO' : mode === 'ENTER_ONLY' ? 'ENTER' : 'EXIT'}
                            </div>
                        </div>
                        <div className="relative mb-8">
                            {/* Scanning Laser Animation */}
                            <div className="absolute inset-0 z-20 pointer-events-none rounded-[2rem] overflow-hidden">
                                <div className="w-full h-1 bg-[#00E5FF] shadow-[0_0_15px_#00E5FF] animate-[scan_2s_ease-in-out_infinite]" />
                            </div>
                            
                            <div className="relative z-10 flex flex-col items-center justify-center rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 border-2 border-[#00E5FF]/50 px-12 py-10 shadow-[0_0_55px_rgba(0,229,255,0.18)] animate-pulse">
                                <ScanLine className="h-24 w-24 text-[#00E5FF] mb-4" />
                                <p className="text-3xl font-black tracking-tight text-white drop-shadow-md">
                                    QR SCAN
                                </p>
                                {/* Corner brackets */}
                                <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-[#00E5FF] rounded-tl-xl" />
                                <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-[#00E5FF] rounded-tr-xl" />
                                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-[#00E5FF] rounded-bl-xl" />
                                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-[#00E5FF] rounded-br-xl" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 flex items-center gap-3 text-[#00E5FF] font-black text-xl uppercase tracking-[0.3em] animate-pulse drop-shadow-[0_0_10px_rgba(0,229,255,0.5)]">
                    Ready to Scan
                </div>

                {/* Processing Overlay */}
                {scannerState.status === 'PROCESSING' && (
                    <div className="absolute inset-0 z-[60000] flex items-center justify-center bg-[#0A192F]/80 backdrop-blur-md">
                        <div className="flex flex-col items-center rounded-[2rem] bg-white/10 p-12 shadow-2xl border border-white/20">
                            <Loader2 className="w-24 h-24 animate-spin text-[#00E5FF] mb-6 drop-shadow-[0_0_15px_rgba(0,229,255,0.5)]" />
                            <p className="text-3xl font-black text-white tracking-widest animate-pulse">PROCESSING</p>
                        </div>
                    </div>
                )}

                {/* Result Overlay (Success/Error) */}
                {(scannerState.status === 'SUCCESS' || scannerState.status === 'ERROR') && (
                    <div className={`absolute inset-0 z-[60000] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 ${
                        scannerState.status === 'SUCCESS' ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/90 via-[#0A192F]/95 to-[#0A192F]' : 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-900/90 via-[#0A192F]/95 to-[#0A192F]'
                    } backdrop-blur-lg`}>
                        
                        {scannerState.status === 'SUCCESS' ? (
                            <CheckCircle className="w-48 h-48 mb-8 text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.6)] animate-[bounce_1s_ease-in-out]" />
                        ) : (
                            <AlertCircle className="w-48 h-48 mb-8 text-rose-500 drop-shadow-[0_0_30px_rgba(244,63,94,0.6)] animate-[shake_0.5s_ease-in-out]" />
                        )}

                        <h2 className={`text-6xl font-black mb-4 drop-shadow-xl ${scannerState.status === 'SUCCESS' ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {scannerState.message}
                        </h2>

                        {scannerState.status === 'SUCCESS' && scannerState.isCompleted && (
                            <div className="inline-flex items-center gap-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-6 py-3 rounded-full font-black text-xl mb-6 backdrop-blur shadow-[0_0_20px_rgba(52,211,153,0.2)]">
                                <CheckCircle className="w-6 h-6" />
                                수강완료
                            </div>
                        )}

                        {scannerState.subMessage && <p className="text-4xl font-bold text-white drop-shadow-md mb-2">{scannerState.subMessage}</p>}
                        {scannerState.userData && <p className="text-2xl font-medium text-sky-200 opacity-90 mb-10">{scannerState.userData.affiliation}</p>}

                        {scannerState.status === 'SUCCESS' && typeof scannerState.totalMinutes === 'number' && (
                            <div className="w-full max-w-5xl rounded-[2.5rem] border border-white/20 bg-white/10 p-10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                                <div className="grid gap-6 md:grid-cols-3">
                                    <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center shadow-inner">
                                        <div className="text-sm font-black uppercase tracking-widest text-sky-300 opacity-80 mb-2">이번 체류 시간</div>
                                        <div className="text-4xl font-black text-white">{scannerState.rawSessionMinutes || 0}<span className="text-2xl text-white/50 ml-1">분</span></div>
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center shadow-inner">
                                        <div className="text-sm font-black uppercase tracking-widest text-sky-300 opacity-80 mb-2">휴식 차감</div>
                                        <div className="text-4xl font-black text-white">{scannerState.deductedMinutes || 0}<span className="text-2xl text-white/50 ml-1">분</span></div>
                                    </div>
                                    <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center shadow-[inset_0_0_20px_rgba(52,211,153,0.1)] relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 to-transparent opacity-50" />
                                        <div className="relative z-10 text-sm font-black uppercase tracking-widest text-emerald-300 opacity-90 mb-2">이번 스캔 인정</div>
                                        <div className="relative z-10 text-5xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">{scannerState.recognizedMinutes || 0}<span className="text-2xl text-emerald-400/50 ml-1">분</span></div>
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center shadow-inner">
                                        <div className="text-sm font-black uppercase tracking-widest text-sky-300 opacity-80 mb-2">오늘 누적</div>
                                        <div className="text-4xl font-black text-white">{scannerState.todayMinutes || 0}<span className="text-2xl text-white/50 ml-1">분</span></div>
                                    </div>
                                    <div className="rounded-3xl border border-[#00E5FF]/30 bg-[#00E5FF]/10 p-6 text-center shadow-[inset_0_0_20px_rgba(0,229,255,0.1)] relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#00E5FF]/20 to-transparent opacity-50" />
                                        <div className="relative z-10 text-sm font-black uppercase tracking-widest text-[#00E5FF] opacity-90 mb-2">총 누적</div>
                                        <div className="relative z-10 text-5xl font-black text-[#00E5FF] drop-shadow-[0_0_10px_rgba(0,229,255,0.5)]">{scannerState.totalMinutes}<span className="text-2xl text-[#00E5FF]/50 ml-1">분</span></div>
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center shadow-inner">
                                        <div className="text-sm font-black uppercase tracking-widest text-sky-300 opacity-80 mb-2">남은 시간</div>
                                        <div className="text-4xl font-black text-white">
                                            {scannerState.goalMinutes ? (scannerState.remainingMinutes || 0) : '-'}<span className="text-2xl text-white/50 ml-1">분</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {scannerState.status === 'ERROR' && (
                            <div className="mt-8 text-3xl font-medium bg-rose-950/50 border border-rose-500/30 text-rose-200 px-10 py-6 rounded-2xl shadow-[0_0_30px_rgba(244,63,94,0.2)]">
                                {scannerState.message}
                            </div>
                        )}
                    </div>
                )}

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
