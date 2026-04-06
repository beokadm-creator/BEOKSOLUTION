import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../../../store/adminStore';
import { doc, getDoc, Timestamp, collection, runTransaction } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Loader2, ArrowLeft, CheckCircle, X, MapPin, Clock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

interface ScannerResult {
    status: 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
    message: string;
    lastScanned: string;
    userData?: {
        name: string;
        affiliation: string;
        totalMinutes: number;
        minsAdded: number;
        isCompleted: boolean;
    };
    actionType?: 'ENTER' | 'EXIT' | 'ZONE_SWITCH';
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
    const [clockStr, setClockStr] = useState('');

    const [result, setResult] = useState<ScannerResult>({ status: 'IDLE', message: '', lastScanned: '' });
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const scanMemoryRef = useRef<Map<string, number>>(new Map());

    // 실시간 시계
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setClockStr(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    // 초기 설정 로드
    useEffect(() => {
        const confId = cid || selectedConferenceId;
        if (!confId) return;

        const init = async () => {
            try {
                const confSnap = await getDoc(doc(db, 'conferences', confId));
                if (confSnap.exists()) {
                    setConferenceTitle(confSnap.data().title?.ko || 'Conference');
                }

                const rulesSnap = await getDoc(doc(db, `conferences/${confId}/settings/attendance`));
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

                    // localStorage 설정 복원
                    const saved = localStorage.getItem(`eregi_conf_${confId}_settings`);
                    let restoredZoneId = uniqueZones[0]?.id || '';
                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            if (parsed.gate?.mode) setMode(parsed.gate.mode);
                            if (parsed.gate?.zoneId) restoredZoneId = parsed.gate.zoneId;
                        } catch { /* ignore */ }
                    }
                    setSelectedZoneId(restoredZoneId);
                }
            } catch (e) {
                console.error(e);
                toast.error("설정 로드 실패");
            } finally {
                setLoading(false);
            }
        };

        init();
        setTimeout(() => inputRef.current?.focus(), 500);
    }, [cid, selectedConferenceId]);

    // 설정 저장
    useEffect(() => {
        const confId = cid || selectedConferenceId;
        if (!confId || !selectedZoneId) return;
        localStorage.setItem(`eregi_conf_${confId}_settings`, JSON.stringify({ gate: { mode, zoneId: selectedZoneId } }));
    }, [mode, selectedZoneId, cid, selectedConferenceId]);

    const handleBlur = () => setTimeout(() => inputRef.current?.focus(), 100);

    const processScan = async (code: string) => {
        if (result.status === 'PROCESSING') return;
        setInputValue(''); // 즉시 초기화

        const nowMs = Date.now();
        const lastScanMs = scanMemoryRef.current.get(code);
        if (lastScanMs && nowMs - lastScanMs < 10000) {
            setResult({ status: 'ERROR', message: '너무 빠릅니다 (10초 대기)', lastScanned: code });
            setTimeout(() => setResult(p => p.status !== 'PROCESSING' ? { ...p, status: 'IDLE' } : p), 1500);
            return;
        }

        const confId = cid || selectedConferenceId;
        if (!confId || !selectedZoneId) {
            setResult({ status: 'ERROR', message: '설정이 완료되지 않았습니다', lastScanned: code });
            return;
        }

        setResult({ status: 'PROCESSING', message: '', lastScanned: code });

        try {
            // 한글 IME 오입력 처리
            const decodeTypos = (s: string) => {
                const map: Record<string, string> = { 'ㅂ': 'q', 'ㅈ': 'w', 'ㄷ': 'e', 'ㄱ': 'r', 'ㅅ': 't', 'ㅛ': 'y', 'ㅕ': 'u', 'ㅑ': 'i', 'ㅐ': 'o', 'ㅔ': 'p', 'ㅁ': 'a', 'ㄴ': 's', 'ㅇ': 'd', 'ㄹ': 'f', 'ㅎ': 'g', 'ㅗ': 'h', 'ㅓ': 'j', 'ㅏ': 'k', 'ㅣ': 'l', 'ㅋ': 'z', 'ㅌ': 'x', 'ㅊ': 'c', 'ㅍ': 'v', 'ㅠ': 'b', 'ㅜ': 'n', 'ㅡ': 'm' };
                return s.split('').map(c => map[c] || c).join('').replace(/[^a-zA-Z0-9-]/g, '');
            };

            const raw = decodeTypos(code).trim();
            let id = raw;
            if (raw.toUpperCase().startsWith('BADGE-')) id = raw.substring(6);
            const isExt = id.startsWith('EXT-');

            const res = await processAttendance(id, selectedZoneId, isExt, mode, confId);
            scanMemoryRef.current.set(code, Date.now());

            setResult({
                status: 'SUCCESS',
                message: res.actionText,
                lastScanned: id,
                userData: {
                    name: res.userName,
                    affiliation: res.affiliation,
                    totalMinutes: res.totalMinutes,
                    minsAdded: res.minsAdded,
                    isCompleted: res.isCompleted
                },
                actionType: res.actionText === 'Zone Switch' ? 'ZONE_SWITCH' : (res.actionType as 'ENTER' | 'EXIT')
            });
        } catch (e: any) {
            setResult({ status: 'ERROR', message: e.message || '처리 오류', lastScanned: code });
        } finally {
            setTimeout(() => setResult(p => p.status !== 'PROCESSING' ? { ...p, status: 'IDLE' } : p), 1500);
        }
    };

    const processAttendance = async (
        id: string, targetZoneId: string, isExt: boolean, currentMode: string, confId: string
    ) => {
        const col = isExt ? 'external_attendees' : 'registrations';
        const regRef = doc(db, `conferences/${confId}/${col}/${id}`);

        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(regRef);
            if (!snap.exists()) throw new Error('등록 정보 없음');
            const data = snap.data();
            if (data.status !== 'PAID' && data.paymentStatus !== 'PAID') throw new Error('결제 미완료');

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
                action = 'ENTER';
                text = status === 'INSIDE' ? 'Zone Switch' : '입장 완료';
            } else if (currentMode === 'EXIT_ONLY') {
                if (status !== 'INSIDE') throw new Error('입장 기록 없음');
                action = 'EXIT';
                text = '퇴장 완료';
            } else { // AUTO
                if (status === 'INSIDE') {
                    if (curZoneId !== targetZoneId) { action = 'ENTER'; text = 'Zone Switch'; }
                    else { action = 'EXIT'; text = '퇴장 완료'; }
                } else {
                    action = 'ENTER'; text = '입장 완료';
                }
            }

            // 퇴장/존 전환 시 체류 시간 계산
            if (status === 'INSIDE' && (action === 'EXIT' || text === 'Zone Switch')) {
                const rule = zones.find(z => z.id === curZoneId);
                let bS = lastIn || now, bE = now;
                if (rule?.start && rule?.end) {
                    const ds = rule.ruleDate || bS.toISOString().split('T')[0];
                    bS = new Date(Math.max(bS.getTime(), new Date(`${ds}T${rule.start}:00+09:00`).getTime()));
                    bE = new Date(Math.min(now.getTime(), new Date(`${ds}T${rule.end}:00+09:00`).getTime()));
                }
                if (bE > bS) {
                    const diff = Math.floor((bE.getTime() - bS.getTime()) / 60000);
                    let ded = 0;
                    rule?.breaks?.forEach((b: any) => {
                        const ds = rule.ruleDate || bS.toISOString().split('T')[0];
                        const bsS = new Date(`${ds}T${b.start}:00+09:00`);
                        const bsE = new Date(`${ds}T${b.end}:00+09:00`);
                        const oS = Math.max(bS.getTime(), bsS.getTime());
                        const oE = Math.min(bE.getTime(), bsE.getTime());
                        if (oE > oS) ded += Math.floor((oE - oS) / 60000);
                    });
                    minsToAdd = Math.max(0, diff - ded);
                }
            }

            const newTotal = totalMins + minsToAdd;
            const ruleForGoal = zones.find(z => z.id === (action === 'ENTER' ? targetZoneId : curZoneId));
            let isComp = data.isCompleted || false;
            if (ruleForGoal) {
                const goal = ruleForGoal.completionMode === 'CUMULATIVE'
                    ? ruleForGoal.cumulativeGoalMinutes
                    : (ruleForGoal.goalMinutes || ruleForGoal.globalGoalMinutes || 0);
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
            tx.set(logRef, {
                type: action,
                zoneId: action === 'ENTER' ? targetZoneId : curZoneId,
                timestamp: tsNow,
                method: 'KIOSK',
                recognizedMinutes: minsToAdd,
                accumulatedTotal: newTotal
            });

            const accRef = doc(collection(db, `conferences/${confId}/access_logs`));
            tx.set(accRef, {
                action: action === 'ENTER' ? 'ENTRY' : 'EXIT',
                scannedQr: data.badgeQr || id,
                locationId: action === 'ENTER' ? targetZoneId : curZoneId,
                timestamp: tsNow,
                method: 'KIOSK_GATE',
                registrationId: id,
                isExternal: isExt,
                recognizedMinutes: minsToAdd,
                accumulatedTotal: newTotal
            });

            return { actionText: text, actionType: action, userName: name, affiliation: aff, totalMinutes: newTotal, minsAdded: minsToAdd, isCompleted: isComp };
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && inputValue.trim()) processScan(inputValue.trim());
    };

    // ── 로딩 ──────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="fixed inset-0 bg-[#001f3f] flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-14 h-14 animate-spin text-white/25 mx-auto mb-5" />
                <p className="text-white/40 font-bold text-lg tracking-widest uppercase">Loading Gate</p>
            </div>
        </div>
    );

    const activeZone = zones.find(z => z.id === selectedZoneId);

    // 모드별 스타일
    const modeMeta = {
        ENTER_ONLY: { label: '입장', desc: 'Entry Mode', headerBg: 'bg-[#003366]', glowColor: 'rgba(0,51,102,0.5)', btnBg: 'bg-[#003366]' },
        EXIT_ONLY:  { label: '퇴장', desc: 'Exit Mode',  headerBg: 'bg-red-800',   glowColor: 'rgba(185,28,28,0.5)', btnBg: 'bg-red-700' },
        AUTO:       { label: '자동', desc: 'Auto Mode',  headerBg: 'bg-[#1a4d7a]', glowColor: 'rgba(26,77,122,0.5)', btnBg: 'bg-[#24669e]' },
    };
    const meta = modeMeta[mode];

    // ── 메인 렌더 ─────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[9999] bg-[#001f3f] flex flex-col font-sans overflow-hidden select-none">

            {/* 관리자 컨트롤 바 */}
            <div className="shrink-0 bg-black/60 backdrop-blur-md border-b border-white/10 px-4 py-2.5 flex items-center justify-between z-[100]">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm font-bold px-3 py-2 rounded-lg hover:bg-white/10"
                    >
                        <ArrowLeft className="w-4 h-4" /> 나가기
                    </button>
                    <div className="w-px h-5 bg-white/15" />
                    {/* Zone 선택 */}
                    <div className="flex items-center gap-2 text-white/60 text-sm font-bold">
                        <MapPin className="w-3.5 h-3.5" />
                        <select
                            value={selectedZoneId}
                            onChange={e => setSelectedZoneId(e.target.value)}
                            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 font-bold text-white appearance-none cursor-pointer text-sm"
                        >
                            {zones.map(z => (
                                <option key={z.id} value={z.id} className="text-slate-900 bg-white">{z.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-px h-5 bg-white/15" />
                    {/* 모드 전환 */}
                    <div className="flex gap-1 bg-white/10 p-1 rounded-lg">
                        {(['ENTER_ONLY', 'EXIT_ONLY', 'AUTO'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${mode === m ? `${modeMeta[m].btnBg} text-white shadow-lg` : 'text-white/35 hover:text-white/70'}`}
                            >
                                {modeMeta[m].label}
                            </button>
                        ))}
                    </div>
                </div>
                {/* 실시간 시계 */}
                <div className="flex items-center gap-2 text-white/35 font-mono font-bold text-sm tabular-nums">
                    <Clock className="w-3.5 h-3.5" />
                    {clockStr}
                </div>
            </div>

            {/* 메인 스테이지 */}
            <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-8">

                {/* 배경 글로우 */}
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[140px] pointer-events-none transition-all duration-700"
                    style={{ background: meta.glowColor }}
                />

                {/* IDLE */}
                {result.status === 'IDLE' && (
                    <div className="flex flex-col items-center z-10 w-full max-w-xl">
                        {/* 학술대회명 */}
                        <p className="text-white/35 text-base font-bold mb-6 text-center tracking-wide truncate max-w-full">
                            {conferenceTitle}
                        </p>

                        {/* 핵심 카드: 모드 + 구역 */}
                        <div className="w-full rounded-[32px] overflow-hidden border border-white/10 shadow-2xl mb-7">
                            {/* 모드 헤더 — 가장 크고 선명하게 */}
                            <div className={`${meta.headerBg} px-8 py-8 text-center`}>
                                <p className="text-white/50 text-xs font-black uppercase tracking-[0.5em] mb-3">
                                    현재 모드 · {meta.desc}
                                </p>
                                <p className="text-white font-black leading-none" style={{ fontSize: '5.5rem' }}>
                                    {meta.label}
                                </p>
                            </div>
                            {/* 구역 */}
                            <div className="bg-white/5 px-8 py-4 border-t border-white/10 flex items-center justify-center gap-2">
                                <MapPin className="w-4 h-4 text-white/40 shrink-0" />
                                <span className="text-white/70 font-bold text-lg">
                                    {activeZone?.name || '구역 미선택'}
                                </span>
                            </div>
                        </div>

                        {/* 스캔 안내 */}
                        <p className="text-white/35 text-lg font-medium text-center mb-4">
                            등록 QR코드를 스캐너에 인식시켜 주세요
                        </p>
                        <div className="flex items-center gap-3 text-white/20 font-black uppercase tracking-[0.5em] text-[11px] animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-white/30 animate-ping" />
                            SCAN QR CODE
                        </div>
                    </div>
                )}

                {/* PROCESSING */}
                {result.status === 'PROCESSING' && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
                        <Loader2 className="w-20 h-20 animate-spin text-[#7ab8e8] mb-6" />
                        <p className="text-white text-3xl font-black tracking-wide">확인 중...</p>
                    </div>
                )}

                {/* SUCCESS */}
                {result.status === 'SUCCESS' && (
                    <div className="absolute inset-0 bg-green-700 flex flex-col items-center justify-center z-50 px-10">
                        <CheckCircle className="w-28 h-28 text-white mb-5 drop-shadow-2xl" />

                        {/* 액션 레이블 */}
                        <h2 className="text-[5rem] md:text-[6rem] font-black text-white leading-none mb-7 text-center">
                            {result.message}
                        </h2>

                        {/* 참석자 정보 */}
                        {result.userData && (
                            <div className="text-center">
                                <p className="text-5xl md:text-6xl font-black text-white mb-2 leading-tight">
                                    {result.userData.name}
                                </p>
                                {result.userData.affiliation && (
                                    <p className="text-xl text-white/65 font-medium mb-6">
                                        {result.userData.affiliation}
                                    </p>
                                )}

                                {/* 퇴장 시: 이번 세션 수강 시간 표시 */}
                                {result.actionType === 'EXIT' && result.userData.minsAdded > 0 && (
                                    <div className="bg-white/15 border border-white/25 rounded-2xl px-8 py-4 inline-block">
                                        <p className="text-white/60 text-xs font-black uppercase tracking-widest mb-1">
                                            이번 세션 인정 시간
                                        </p>
                                        <p className="text-white text-4xl font-black">
                                            +{result.userData.minsAdded}분
                                            <span className="text-white/55 text-2xl font-bold ml-3">
                                                (누적 {result.userData.totalMinutes}분)
                                            </span>
                                        </p>
                                        {result.userData.isCompleted && (
                                            <p className="text-yellow-300 text-sm font-black mt-2">
                                                ✓ 수강 이수 완료
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ERROR */}
                {result.status === 'ERROR' && (
                    <div className="absolute inset-0 bg-red-700 flex flex-col items-center justify-center z-50 px-10">
                        <X className="w-28 h-28 text-white mb-5 drop-shadow-2xl" />
                        <h2 className="text-[5rem] md:text-[6rem] font-black text-white leading-none mb-6 text-center">
                            인식 실패
                        </h2>
                        <div className="bg-black/20 rounded-2xl px-8 py-4 max-w-lg">
                            <p className="text-2xl md:text-3xl text-white/80 font-bold text-center leading-snug">
                                {result.message}
                            </p>
                        </div>
                    </div>
                )}

                {/* 숨겨진 QR 입력 */}
                <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    className="absolute opacity-0 pointer-events-none w-1 h-1"
                    autoFocus
                />
            </div>
        </div>
    );
};

export default GatePage;
