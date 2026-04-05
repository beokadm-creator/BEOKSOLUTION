import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../../../store/adminStore';
import { doc, getDoc, Timestamp, addDoc, collection, runTransaction } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Loader2, ArrowLeft, AlertCircle, CheckCircle, X, Palette, MapPin, LogIn } from 'lucide-react';
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
}

const GatePage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const { selectedConferenceId } = useAdminStore();
    const [loading, setLoading] = useState(true);

    const [zones, setZones] = useState<any[]>([]);
    const [selectedZoneId, setSelectedZoneId] = useState<string>('');
    const [mode, setMode] = useState<'ENTER_ONLY' | 'EXIT_ONLY' | 'AUTO'>('ENTER_ONLY');
    const [conferenceTitle, setConferenceTitle] = useState('');
    const [conferenceSubtitle, setConferenceSubtitle] = useState('');

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

    useEffect(() => {
        const confId = cid || selectedConferenceId;
        if (!confId) return;

        const init = async () => {
            try {
                const confRef = doc(db, 'conferences', confId);
                const confSnap = await getDoc(confRef);
                if (confSnap.exists()) {
                    setConferenceTitle(confSnap.data().title?.ko || 'Conference');
                    setConferenceSubtitle(confSnap.data().subtitle || '');
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

                    const uniqueZones = Array.from(new Map(allZones.map(item => [item.id, item])).values());
                    setZones(uniqueZones);

                    const key = `eregi_conf_${confId}_settings`;
                    const saved = localStorage.getItem(key);
                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            if (parsed.gate?.mode) setMode(parsed.gate.mode);
                            if (parsed.gate?.zoneId) setSelectedZoneId(parsed.gate.zoneId);
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
        const lastScanMs = scanMemoryRef.current.get(code);
        if (lastScanMs && nowMs - lastScanMs < 10000) {
            setScannerState({ status: 'ERROR', message: '너무 빠릅니다. 10초 대기.', lastScanned: code });
            setTimeout(() => setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE' }), 1000);
            return;
        }

        const confId = cid || selectedConferenceId;
        if (!confId || !selectedZoneId) {
            setScannerState({ status: 'ERROR', message: '설정 미완료', lastScanned: code });
            return;
        }

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
            const res = await processAttendance(id, selectedZoneId, isExt, mode);

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
            setScannerState({ status: 'ERROR', message: e.message || 'Scan Failed', lastScanned: code });
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

            if (status === 'INSIDE' && (action === 'EXIT' || text === 'Zone Switch')) {
                const rule = zones.find(z => z.id === curZoneId);
                let bS = lastIn || now, bE = now;
                if (rule && rule.start && rule.end) {
                    const ds = rule.ruleDate || bS.toISOString().split('T')[0];
                    bS = new Date(Math.max(bS.getTime(), new Date(`${ds}T${rule.start}:00+09:00`).getTime()));
                    bE = new Date(Math.min(now.getTime(), new Date(`${ds}T${rule.end}:00+09:00`).getTime()));
                }
                if (bE > bS) {
                    const diff = Math.floor((bE.getTime() - bS.getTime()) / 60000);
                    let ded = 0;
                    if (rule?.breaks) {
                        rule.breaks.forEach((b: any) => {
                            const ds = rule.ruleDate || bS.toISOString().split('T')[0];
                            const bsS = new Date(`${ds}T${b.start}:00+09:00`), bsE = new Date(`${ds}T${b.end}:00+09:00`);
                            const oS = Math.max(bS.getTime(), bsS.getTime()), oE = Math.min(bE.getTime(), bsE.getTime());
                            if (oE > oS) ded += Math.floor((oE - oS) / 60000);
                        });
                    }
                    minsToAdd = Math.max(0, diff - ded);
                }
            }

            const newTotal = totalMins + minsToAdd;
            const ruleForGoal = zones.find(z => z.id === (action === 'ENTER' ? targetZoneId : curZoneId));
            let isComp = data.isCompleted || false;
            if (ruleForGoal) {
                const goal = ruleForGoal.completionMode === 'CUMULATIVE' ? ruleForGoal.cumulativeGoalMinutes : (ruleForGoal.goalMinutes || ruleForGoal.globalGoalMinutes || 0);
                if (goal > 0 && newTotal >= goal) isComp = true;
            }

            tx.update(regRef, {
                attendanceStatus: action === 'ENTER' ? 'INSIDE' : 'OUTSIDE',
                currentZone: action === 'ENTER' ? targetZoneId : null,
                totalMinutes: newTotal,
                isCompleted: isComp,
                [action === 'ENTER' ? 'lastCheckIn' : 'lastCheckOut']: tsNow
            });

            const logRef = doc(collection(db, `conferences/${confId}/${col}/${id}/logs`));
            tx.set(logRef, { type: action, zoneId: action === 'ENTER' ? targetZoneId : curZoneId, timestamp: tsNow, method: 'KIOSK', recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });

            const accRef = doc(collection(db, `conferences/${confId}/access_logs`));
            tx.set(accRef, { action: action === 'ENTER' ? 'ENTRY' : 'EXIT', scannedQr: data.badgeQr || id, locationId: action === 'ENTER' ? targetZoneId : curZoneId, timestamp: tsNow, method: 'KIOSK_GATE', registrationId: id, isExternal: isExt, recognizedMinutes: minsToAdd, accumulatedTotal: newTotal });

            return { actionText: text, actionType: action, userName: name, affiliation: aff };
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && inputValue.trim()) processScan(inputValue.trim()); };

    if (loading) return <div className="p-10 text-center font-bold">Loading...</div>;

    const activeZone = zones.find(z => z.id === selectedZoneId);

    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col font-sans overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center z-[100]">
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

            <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                <div className="text-center mb-10 z-10">
                    <h1 className="text-4xl font-black text-slate-900 mb-2">{conferenceTitle}</h1>
                    <p className="text-slate-500 text-xl">{conferenceSubtitle}</p>
                    <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 px-4 py-1 rounded-full text-slate-600 font-bold"><MapPin className="w-4 h-4" /> {activeZone?.name}</div>
                </div>

                <div className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden z-10">
                    <div className="p-16 flex flex-col items-center">
                        <div className="mb-10 p-8 rounded-full bg-slate-50">
                            {scannerState.status === 'IDLE' && <LogIn className="w-16 h-16 text-slate-200" />}
                            {scannerState.status === 'PROCESSING' && <Loader2 className="w-16 h-16 animate-spin text-blue-500" />}
                            {scannerState.status === 'SUCCESS' && <CheckCircle className="w-16 h-16 text-green-500" />}
                            {scannerState.status === 'ERROR' && <AlertCircle className="w-16 h-16 text-red-500" />}
                        </div>
                        <h2 className={cn("text-5xl font-black mb-4", scannerState.status === 'ERROR' ? "text-red-600" : scannerState.status === 'SUCCESS' ? "text-green-600" : "text-slate-900")}>
                            {scannerState.message}
                        </h2>
                        {scannerState.subMessage && <p className="text-3xl font-bold text-slate-700">{scannerState.subMessage}</p>}
                        {scannerState.userData && <p className="text-xl text-slate-400 font-medium mt-2">{scannerState.userData.affiliation}</p>}
                    </div>
                </div>

                <div className="mt-12 flex items-center gap-2 text-slate-300 font-bold uppercase tracking-widest animate-pulse">
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
