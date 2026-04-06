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

    if (loading) return (
        <div className="fixed inset-0 bg-[#001f3f] flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-16 h-16 animate-spin text-white/30 mx-auto mb-4" />
                <p className="text-white/50 font-bold text-xl tracking-widest uppercase">Loading Gate</p>
            </div>
        </div>
    );

    const activeZone = zones.find(z => z.id === selectedZoneId);
    const modeLabel = { ENTER_ONLY: '입장', EXIT_ONLY: '퇴장', AUTO: '자동' };
    const modeBg = { ENTER_ONLY: 'bg-[#003366]', EXIT_ONLY: 'bg-red-600', AUTO: 'bg-[#24669e]' };

    return (
        <div className="fixed inset-0 z-[9999] bg-[#001f3f] flex flex-col font-sans overflow-hidden select-none">

            {/* ── 관리자 컨트롤 바 ─────────────────────────────────────── */}
            <div className="shrink-0 bg-black/50 backdrop-blur-md border-b border-white/10 px-5 py-2.5 flex items-center justify-between z-[100]">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm font-bold px-3 py-2 rounded-lg hover:bg-white/10"
                    >
                        <ArrowLeft className="w-4 h-4" /> 나가기
                    </button>
                    <div className="w-px h-5 bg-white/15" />
                    <select
                        value={selectedZoneId}
                        onChange={e => setSelectedZoneId(e.target.value)}
                        className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm font-bold text-white appearance-none cursor-pointer"
                    >
                        {zones.map(z => <option key={z.id} value={z.id} className="text-slate-900">{z.name}</option>)}
                    </select>
                    <div className="flex gap-1 bg-white/10 p-1 rounded-lg">
                        {(['ENTER_ONLY', 'EXIT_ONLY', 'AUTO'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${mode === m ? `${modeBg[m]} text-white shadow-lg` : 'text-white/40 hover:text-white/70'}`}
                            >
                                {modeLabel[m]}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                >
                    <Palette className="w-5 h-5" />
                </button>
            </div>

            {/* ── 메인 스테이지 ────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">

                {/* 배경 글로우 */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#003366]/20 blur-[120px]" />
                </div>

                {/* 대기 / 처리 중 상태 */}
                {(scannerState.status === 'IDLE' || scannerState.status === 'PROCESSING') && (
                    <div className="flex flex-col items-center z-10 px-8 w-full max-w-3xl">
                        {/* 학회명 */}
                        <div className="text-center mb-10">
                            <h1 className="text-5xl md:text-6xl font-black text-white mb-3 leading-tight">{conferenceTitle}</h1>
                            {conferenceSubtitle && <p className="text-white/50 text-2xl font-medium">{conferenceSubtitle}</p>}
                            {activeZone && (
                                <div className="mt-5 inline-flex items-center gap-2 bg-white/10 border border-white/20 px-5 py-2 rounded-full text-white/70 font-bold text-lg">
                                    <MapPin className="w-5 h-5" /> {activeZone.name}
                                </div>
                            )}
                        </div>

                        {/* QR 스캔 카드 */}
                        <div className="w-full bg-white/5 border border-white/10 rounded-[40px] p-14 md:p-16 flex flex-col items-center shadow-[0_0_80px_rgba(0,51,102,0.4)]">
                            {scannerState.status === 'IDLE' ? (
                                <>
                                    <div className="w-44 h-44 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center mb-10">
                                        <LogIn className="w-20 h-20 text-white/20" />
                                    </div>
                                    <h2 className="text-5xl md:text-6xl font-black text-white mb-5">QR 스캔 대기</h2>
                                    <p className="text-white/40 text-xl md:text-2xl font-medium text-center leading-relaxed">
                                        등록 QR코드를 스캐너에 인식시켜 주세요
                                    </p>
                                    <div className="mt-10 flex items-center gap-3 text-white/25 font-black uppercase tracking-[0.5em] text-xs animate-pulse">
                                        <div className="w-2 h-2 rounded-full bg-white/30 animate-ping" />
                                        SCAN QR CODE
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Loader2 className="w-28 h-28 animate-spin text-[#c3daee] mb-8" />
                                    <h2 className="text-5xl font-black text-white">확인 중...</h2>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ── 성공 전체화면 ──────────────────────────────────────── */}
                {scannerState.status === 'SUCCESS' && (
                    <div className="absolute inset-0 bg-green-600 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 z-50">
                        <CheckCircle className="w-52 h-52 text-white drop-shadow-2xl mb-8" />
                        <h2 className="text-7xl md:text-8xl font-black text-white mb-6 drop-shadow-lg">
                            {scannerState.message}
                        </h2>
                        {scannerState.userData && (
                            <div className="text-center bg-white/15 border border-white/20 rounded-3xl px-16 py-10 backdrop-blur-sm mt-4">
                                <div className="text-5xl md:text-6xl font-black text-white mb-3">
                                    {scannerState.userData.name}
                                </div>
                                <div className="text-2xl md:text-3xl text-white/70 font-medium">
                                    {scannerState.userData.affiliation}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── 실패 전체화면 ──────────────────────────────────────── */}
                {scannerState.status === 'ERROR' && (
                    <div className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 z-50">
                        <X className="w-52 h-52 text-white drop-shadow-2xl mb-8" />
                        <h2 className="text-7xl md:text-8xl font-black text-white mb-6 drop-shadow-lg">인식 실패</h2>
                        <p className="text-3xl md:text-4xl text-white/80 font-medium bg-black/20 px-10 py-5 rounded-2xl">
                            {scannerState.message}
                        </p>
                    </div>
                )}

                {/* 숨겨진 QR 입력 */}
                <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    className="absolute opacity-0 pointer-events-none"
                    autoFocus
                />
            </div>

            {/* ── 설정 모달 ────────────────────────────────────────────── */}
            {showSettings && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-[#001f3f] border border-white/20 rounded-3xl shadow-2xl w-full max-w-sm p-8">
                        <h3 className="font-black text-xl text-white mb-6 flex items-center gap-2">
                            <Palette className="w-5 h-5 text-white/50" /> 키오스크 설정
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-white/40 uppercase mb-2 block tracking-wider">텍스트 색상</label>
                                <input
                                    type="color"
                                    value={design.textColor}
                                    onChange={e => setDesign(p => ({ ...p, textColor: e.target.value }))}
                                    className="w-full h-12 p-1 rounded-xl border border-white/20 bg-white/10 cursor-pointer"
                                />
                            </div>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="w-full py-3 bg-[#003366] hover:bg-[#002244] text-white font-black rounded-xl transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GatePage;
