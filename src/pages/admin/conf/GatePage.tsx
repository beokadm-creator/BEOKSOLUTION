import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../../../store/adminStore';
import { doc, getDoc, updateDoc, Timestamp, addDoc, collection, increment } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Loader2, ArrowLeft, AlertCircle, CheckCircle, X, Settings, Palette } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Registration } from '../../../types/schema';

interface ScannerState {
    status: 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
    message: string;
    subMessage?: string;
    lastScanned: string;
    userData?: {
        name: string;
        affiliation: string;
    };
}

interface DesignConfig {
    bgImage: string | null;
    textColor: string;
    fontSize: 'normal' | 'large';
}

const GatePage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const { selectedConferenceId, selectedConferenceSlug } = useAdminStore();
    const [loading, setLoading] = useState(true);

    // Config
    const [zones, setZones] = useState<Array<{
        id: string; name: string; start: string; end: string;
        goalMinutes: number; autoCheckout: boolean;
        breaks: Array<{ label: string; start: string; end: string }>;
        points: number;
        ruleDate: string;
        globalGoalMinutes: number;
        completionMode: 'DAILY_SEPARATE' | 'CUMULATIVE';
        cumulativeGoalMinutes: number;
    }>>([]);
    const [selectedZoneId, setSelectedZoneId] = useState<string>('');
    const [mode, setMode] = useState<'ENTER_ONLY' | 'EXIT_ONLY' | 'AUTO'>('ENTER_ONLY');
    const [conferenceTitle, setConferenceTitle] = useState('');
    const [conferenceSubtitle, setConferenceSubtitle] = useState('');
    const [selectedDate] = useState<string>(new Date().toISOString().slice(0, 10)); // 현재 날짜 기본

    // Design State
    const [showSettings, setShowSettings] = useState(false);
    const [design, setDesign] = useState<DesignConfig>(() => {
        const saved = localStorage.getItem('kiosk_design');
        return saved ? JSON.parse(saved) : { bgImage: null, textColor: '#000000', fontSize: 'normal' };
    });

    // Scanner State
    const [scannerState, setScannerState] = useState<ScannerState>({
        status: 'IDLE',
        message: 'Ready to Scan',
        lastScanned: ''
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');

    // Load Data
    useEffect(() => {
        if (!selectedConferenceId) return;
        const init = async () => {
            try {
                // 1. Conf Info
                const confRef = doc(db, 'conferences', selectedConferenceId);
                const confSnap = await getDoc(confRef);
                if (confSnap.exists()) {
                    setConferenceTitle(confSnap.data().title?.ko || 'Conference');
                    setConferenceSubtitle(confSnap.data().subtitle || '');
                }

                // 2. Fetch ALL Zones from ALL Dates (Flattened)
                const rulesRef = doc(db, `conferences/${selectedConferenceId}/settings/attendance`);
                const rulesSnap = await getDoc(rulesRef);
                if (rulesSnap.exists()) {
                    const allRules = rulesSnap.data().rules || {};
                    let allZones: Array<any> = [];
                    Object.entries(allRules).forEach(([dateStr, rule]: [string, any]) => {
                        if (rule.zones) {
                            rule.zones.forEach((z: any) => {
                                allZones.push({
                                    ...z,
                                    ruleDate: dateStr,
                                    globalGoalMinutes: rule.globalGoalMinutes ?? 0,
                                    completionMode: rule.completionMode || 'DAILY_SEPARATE',
                                    cumulativeGoalMinutes: rule.cumulativeGoalMinutes || 0
                                });
                            });
                        }
                    });

                    // Deduplicate by ID
                    const uniqueZones = Array.from(new Map(allZones.map(item => [item.id, item])).values());
                    setZones(uniqueZones);

                    // Load Unified Settings [v356]
                    let savedZoneId = '';
                    if (cid) {
                        const saved = localStorage.getItem(`eregi_conf_${cid}_settings`);
                        if (saved) {
                            try {
                                const parsed = JSON.parse(saved);
                                if (parsed.gate?.design) setDesign(parsed.gate.design);
                                if (parsed.gate?.mode) setMode(parsed.gate.mode);
                                if (parsed.gate?.zoneId) savedZoneId = parsed.gate.zoneId;
                            } catch (e) {
                                console.error("Failed to parse settings", e);
                            }
                        }
                    }

                    if (savedZoneId && uniqueZones.find(z => z.id === savedZoneId)) {
                        setSelectedZoneId(savedZoneId);
                    } else if (uniqueZones.length > 0) {
                        setSelectedZoneId(uniqueZones[0].id);
                    }
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
    }, [selectedConferenceId, cid]);

    // Save Unified Settings [v356]
    useEffect(() => {
        if (!cid) return;
        const key = `eregi_conf_${cid}_settings`;
        try {
            const saved = localStorage.getItem(key);
            const parsed = saved ? JSON.parse(saved) : {};

            const newSettings = {
                ...parsed,
                gate: {
                    design,
                    mode,
                    zoneId: selectedZoneId
                }
            };
            localStorage.setItem(key, JSON.stringify(newSettings));
        } catch (e) {
            console.error("Failed to save settings", e);
        }
    }, [design, mode, selectedZoneId, cid]);

    // Keep focus
    const handleBlur = () => {
        if (!showSettings) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    // PROCESS SCAN
    const processScan = async (code: string) => {
        if (scannerState.status === 'PROCESSING') return;
        if (!selectedZoneId) {
            setScannerState({ status: 'ERROR', message: 'No Zone Selected', lastScanned: code });
            return;
        }

        setScannerState({ status: 'PROCESSING', message: 'Verifying...', lastScanned: code });

        try {
            // Function to handle Hangul typos from Korean keyboard barcode scanners
            const decodeKoreanTypo = (str: string) => {
                const korToEng: Record<string, string> = {
                    'ㅂ': 'q', 'ㅈ': 'w', 'ㄷ': 'e', 'ㄱ': 'r', 'ㅅ': 't', 'ㅛ': 'y', 'ㅕ': 'u', 'ㅑ': 'i', 'ㅐ': 'o', 'ㅔ': 'p',
                    'ㅁ': 'a', 'ㄴ': 's', 'ㅇ': 'd', 'ㄹ': 'f', 'ㅎ': 'g', 'ㅗ': 'h', 'ㅓ': 'j', 'ㅏ': 'k', 'ㅣ': 'l',
                    'ㅋ': 'z', 'ㅌ': 'x', 'ㅊ': 'c', 'ㅍ': 'v', 'ㅠ': 'b', 'ㅜ': 'n', 'ㅡ': 'm',
                    'ㅃ': 'Q', 'ㅉ': 'W', 'ㄸ': 'E', 'ㄲ': 'R', 'ㅆ': 'T', 'ㅒ': 'O', 'ㅖ': 'P'
                };
                return str.split('').map(char => korToEng[char] || char).join('');
            };

            // Extract registration ID from QR code (remove BADGE- prefix if exists)
            // Scanner might output korean chars if PC keyboard is in Hangul mode.
            let rawCode = decodeKoreanTypo(code).trim();
            let regId = rawCode;

            // Allow case-insensitive prefix match to be safer
            if (rawCode.toUpperCase().startsWith('BADGE-')) {
                regId = rawCode.substring(6);
            } else if (rawCode.toUpperCase().startsWith('VOUCHER-')) {
                throw new Error("등록 교환권입니다. 명찰(Badge) QR을 스캔해 주세요.");
            }

            // Check if external attendee (EXT- prefix)
            const isExternalAttendee = regId.startsWith('EXT-');

            let regData: any;
            let userName: string;
            let userAffiliation: string;
            let currentStatus: string;
            let currentZone: string | null;

            if (isExternalAttendee) {
                // External attendee path
                const extRef = doc(db, `conferences/${selectedConferenceId}/external_attendees`, regId);
                const extSnap = await getDoc(extRef);

                if (!extSnap.exists()) {
                    throw new Error("등록되지 않은 명찰이거나 잘못된 QR코드입니다.");
                }

                regData = extSnap.data();
                if (regData.status !== 'PAID' && regData.paymentStatus !== 'PAID') {
                    throw new Error("결제가 완료되지 않은 명찰입니다.");
                }

                userName = regData.name || 'Unknown';
                userAffiliation = regData.organization || regData.email || '';
                currentStatus = regData.attendanceStatus || 'OUTSIDE';
                currentZone = regData.currentZone;
            } else {
                // Regular registration path
                const regRef = doc(db, `conferences/${selectedConferenceId}/registrations`, regId);
                const regSnap = await getDoc(regRef);

                if (!regSnap.exists()) {
                    throw new Error("등록되지 않은 명찰이거나 잘못된 QR코드입니다.");
                }

                regData = regSnap.data();
                if (regData.status !== 'PAID' && regData.paymentStatus !== 'PAID') {
                    throw new Error("결제가 완료되지 않은 명찰입니다.");
                }
                // Removed strict redundant slug check as we already queried the specific conference subcollection.
                // Depending on data import methods, old registrations might lack the slug field.

                userName = regData.userName || 'Unknown';
                userAffiliation = regData.affiliation || regData.userEmail || '';
                currentStatus = regData.attendanceStatus || 'OUTSIDE';
                currentZone = regData.currentZone;
            }

            // 2. Logic Switch
            let action = '';
            const currentTotalMinutes = typeof (regData as any).totalMinutes === 'number' ? (regData as any).totalMinutes : 0;

            if (mode === 'ENTER_ONLY') {
                if (currentStatus === 'INSIDE') {
                    if (currentZone === selectedZoneId) throw new Error(`${userName}님은 이미 입장 상태입니다.`);
                    // Auto-Switch
                    await performCheckOut(regId, currentZone, regData.lastCheckIn, isExternalAttendee, currentTotalMinutes);
                    await performCheckIn(regId, selectedZoneId, isExternalAttendee);
                    action = 'Switched & Checked In';
                } else {
                    await performCheckIn(regId, selectedZoneId, isExternalAttendee);
                    action = '입장 완료 (Checked In)';
                }
            }
            else if (mode === 'EXIT_ONLY') {
                if (currentStatus !== 'INSIDE') throw new Error(`${userName}님은 입장 기록이 없습니다.`);
                await performCheckOut(regId, currentZone, regData.lastCheckIn, isExternalAttendee, currentTotalMinutes);
                action = '퇴장 완료 (Checked Out)';
            }
            else if (mode === 'AUTO') {
                if (currentStatus === 'INSIDE') {
                    if (currentZone !== selectedZoneId) {
                        await performCheckOut(regId, currentZone, regData.lastCheckIn, isExternalAttendee, currentTotalMinutes);
                        await performCheckIn(regId, selectedZoneId, isExternalAttendee);
                        action = 'Zone Switched';
                    } else {
                        await performCheckOut(regId, currentZone, regData.lastCheckIn, isExternalAttendee, currentTotalMinutes);
                        action = '퇴장 완료 (Checked Out)';
                    }
                } else {
                    await performCheckIn(regId, selectedZoneId, isExternalAttendee);
                    action = '입장 완료 (Checked In)';
                }
            }

            // Success
            setScannerState({
                status: 'SUCCESS',
                message: action,
                subMessage: userName,
                lastScanned: regId,
                userData: { name: userName, affiliation: userAffiliation }
            });

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : 'Scan Failed';
            setScannerState({
                status: 'ERROR',
                message: errorMessage,
                lastScanned: code
            });
        }

        setTimeout(() => {
            setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE', message: 'Ready' });
            setInputValue('');
        }, 3000); // 3s delay for readability
    };

    const performCheckIn = async (id: string, zoneId: string, isExternal: boolean = false) => {
        if (!selectedConferenceId) return;
        const collectionPath = isExternal ? 'external_attendees' : 'registrations';
        await updateDoc(doc(db, `conferences/${selectedConferenceId}/${collectionPath}/${id}`), {
            attendanceStatus: 'INSIDE',
            currentZone: zoneId,
            lastCheckIn: Timestamp.now()
        });
        await addDoc(collection(db, `conferences/${selectedConferenceId}/${collectionPath}/${id}/logs`), {
            type: 'ENTER', zoneId, timestamp: Timestamp.now(), method: 'KIOSK'
        });
    };

    const performCheckOut = async (id: string, zoneId: string | null, lastIn: { toDate: () => Date } | null | undefined, isExternal: boolean = false, currentTotalMinutes: number = 0) => {
        if (!selectedConferenceId) return;
        const collectionPath = isExternal ? 'external_attendees' : 'registrations';
        const now = new Date();
        const start = lastIn?.toDate() || now;
        let boundedStart = start;
        let boundedEnd = now;
        const zoneRule = zones.find(z => z.id === zoneId);
        let deduction = 0;
        let diffMins = 0;

        // 수강 시작/종료 시간 내로 제한 (bounded start and end)
        if (zoneRule && zoneRule.start && zoneRule.end) {
            const localDateStr = zoneRule.ruleDate || start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
            const sessionStart = new Date(`${localDateStr}T${zoneRule.start}:00`);
            const sessionEnd = new Date(`${localDateStr}T${zoneRule.end}:00`);

            boundedStart = new Date(Math.max(start.getTime(), sessionStart.getTime()));
            boundedEnd = new Date(Math.min(now.getTime(), sessionEnd.getTime()));
        }

        if (boundedEnd > boundedStart) {
            diffMins = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);

            // 휴게 시간 차감 로직 추가
            if (zoneRule && zoneRule.breaks && zoneRule.breaks.length > 0) {
                zoneRule.breaks.forEach(brk => {
                    const localDateStr = zoneRule.ruleDate || start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, '0') + "-" + String(start.getDate()).padStart(2, '0');
                    const breakStart = new Date(`${localDateStr}T${brk.start}:00`);
                    const breakEnd = new Date(`${localDateStr}T${brk.end}:00`);
                    const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
                    const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
                    if (overlapEnd > overlapStart) {
                        const overlapMins = Math.floor((overlapEnd - overlapStart) / 60000);
                        deduction += overlapMins;
                    }
                });
            }
        }

        const finalMinutes = Math.max(0, diffMins - deduction); // 휴게 시간 차감 후 저장
        const newTotal = currentTotalMinutes + finalMinutes;

        // "수강완료" 판정 (Goal check)
        let isCompleted = false;
        if (zoneRule) {
            const goal = zoneRule.completionMode === 'CUMULATIVE' && zoneRule.cumulativeGoalMinutes
                ? zoneRule.cumulativeGoalMinutes
                : (zoneRule.goalMinutes && zoneRule.goalMinutes > 0)
                    ? zoneRule.goalMinutes
                    : (zoneRule.globalGoalMinutes || 0);

            if (goal > 0 && newTotal >= goal) {
                isCompleted = true;
            }
        }

        // Only update isCompleted if it's evaluated to true, to avoid overriding previously completed status. 
        // If it was already completed but now evaluated to false (e.g., config changes), maybe it's fine to rely on what live page does, but let's be safe and always update it if completed. Let's just update the value to what we computed, as live page does.
        const updatePayload: any = {
            attendanceStatus: 'OUTSIDE',
            currentZone: null,
            totalMinutes: increment(finalMinutes), // 휴게 시간 차감된 값
            lastCheckOut: Timestamp.now()
        };
        // Always set isCompleted if goal allows evaluation
        if (zoneRule) {
            updatePayload.isCompleted = isCompleted;
        }

        await updateDoc(doc(db, `conferences/${selectedConferenceId}/${collectionPath}/${id}`), updatePayload);

        await addDoc(collection(db, `conferences/${selectedConferenceId}/${collectionPath}/${id}/logs`), {
            type: 'EXIT', zoneId, timestamp: Timestamp.now(), method: 'KIOSK', rawDuration: diffMins, deduction, recognizedMinutes: finalMinutes, evaluatedCompleted: isCompleted, accumulatedTotal: newTotal
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (inputValue.trim()) {
                processScan(inputValue.trim());
            }
        }
    };

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setDesign(prev => ({ ...prev, bgImage: ev.target!.result as string }));
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    if (loading) return <div>Loading Kiosk...</div>;

    const getModeColor = () => {
        if (mode === 'ENTER_ONLY') return 'bg-blue-600';
        if (mode === 'EXIT_ONLY') return 'bg-red-600';
        return 'bg-purple-600';
    };

    const activeZoneName = zones.find(z => z.id === selectedZoneId)?.name || 'No Zone Selected';

    return (
        <div
            className="fixed inset-0 z-[99999] flex flex-col font-sans transition-colors duration-500 bg-white"
            style={{
                backgroundImage: design.bgImage ? `url(${design.bgImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: design.textColor
            }}
        >
            {/* Top Admin Console (Always on top, semi-transparent) */}
            <div className="fixed top-0 left-0 right-0 bg-black/80 text-white p-3 z-[10000] flex justify-between items-center backdrop-blur-md shadow-lg">
                <div className="flex items-center gap-4">
                    <select
                        value={selectedZoneId}
                        onChange={e => setSelectedZoneId(e.target.value)}
                        className="bg-gray-700 border-none text-white text-sm p-2 rounded w-48"
                    >
                        {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                        {zones.length === 0 && <option>No Zones Found</option>}
                    </select>

                    <div className="flex bg-gray-700 rounded p-1">
                        {(['ENTER_ONLY', 'EXIT_ONLY', 'AUTO'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${mode === m ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {m === 'ENTER_ONLY' ? 'IN' : m === 'EXIT_ONLY' ? 'OUT' : 'AUTO'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className="text-gray-300 hover:text-white hover:bg-white/10">
                        <Palette className="w-4 h-4 mr-2" /> Style
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => navigate(-1)} className="text-xs">
                        <X className="w-4 h-4 mr-1" /> Exit
                    </Button>
                </div>
            </div>

            {/* Design Settings Modal */}
            {showSettings && (
                <div className="fixed top-16 right-4 bg-white text-black p-4 rounded-lg shadow-xl z-[10001] w-80 border border-gray-200 animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Kiosk Design
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Background Image</label>
                            <input type="file" accept="image/*" onChange={handleBgUpload} className="text-sm w-full" />
                            {design.bgImage && (
                                <Button variant="outline" size="sm" className="mt-2 w-full text-xs" onClick={() => setDesign(prev => ({ ...prev, bgImage: null }))}>
                                    Clear Image
                                </Button>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Text Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={design.textColor}
                                    onChange={(e) => setDesign(prev => ({ ...prev, textColor: e.target.value }))}
                                    className="h-8 w-16 p-0 border-0"
                                />
                                <div className="flex-1 flex gap-1">
                                    <button onClick={() => setDesign(prev => ({ ...prev, textColor: '#000000' }))} className="w-8 h-8 bg-black rounded-full border border-gray-200" />
                                    <button onClick={() => setDesign(prev => ({ ...prev, textColor: '#ffffff' }))} className="w-8 h-8 bg-white rounded-full border border-gray-200" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative mt-16">

                {/* Header */}
                <div className="mb-12 drop-shadow-lg">
                    <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                        {conferenceTitle}
                    </h1>
                    <p className="text-2xl md:text-3xl opacity-90 font-light">{conferenceSubtitle}</p>

                    {/* Zone Badge */}
                    <div className="mt-6 inline-block bg-white/20 backdrop-blur-md border border-white/30 px-6 py-2 rounded-full text-xl font-bold shadow-sm">
                        📍 {activeZoneName}
                    </div>
                </div>

                {/* Main Instruction Card */}
                <div className={`p-10 rounded-3xl w-full max-w-3xl shadow-2xl backdrop-blur-sm border transition-all duration-500 ${design.bgImage ? 'bg-black/40 border-white/20 text-white' :
                    mode === 'ENTER_ONLY' ? 'bg-blue-50 border-blue-200 text-blue-900' :
                        mode === 'EXIT_ONLY' ? 'bg-red-50 border-red-200 text-red-900' :
                            'bg-purple-50 border-purple-200 text-purple-900'
                    }`}>
                    <h2 className="text-5xl font-black mb-6">
                        {mode === 'ENTER_ONLY' && '입장 모드 (CHECK-IN)'}
                        {mode === 'EXIT_ONLY' && '퇴장 모드 (CHECK-OUT)'}
                        {mode === 'AUTO' && '자동 모드 (AUTO)'}
                    </h2>

                    <p className="opacity-80 mb-8 text-2xl font-medium">
                        명찰의 QR코드를 스캐너에 인식시켜주세요.
                        <br />(Please scan your QR code)
                    </p>

                    <div className="animate-pulse mt-8">
                        <ArrowLeft className="w-12 h-12 mx-auto rotate-[-90deg] opacity-50" />
                    </div>
                </div>

                {/* Processing Indicator */}
                {scannerState.status === 'PROCESSING' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[50000] backdrop-blur-sm">
                        <div className="bg-white p-8 rounded-2xl flex flex-col items-center">
                            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mb-4" />
                            <p className="text-xl font-bold text-gray-800">Processing...</p>
                        </div>
                    </div>
                )}

                {/* Result Overlay (Success/Error) */}
                {(scannerState.status === 'SUCCESS' || scannerState.status === 'ERROR') && (
                    <div className={`absolute inset-0 z-[60000] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 ${scannerState.status === 'SUCCESS' ? getModeColor() : 'bg-red-600'
                        } text-white`}>
                        {scannerState.status === 'SUCCESS' ? (
                            <CheckCircle className="w-40 h-40 mb-8 drop-shadow-lg" />
                        ) : (
                            <AlertCircle className="w-40 h-40 mb-8 drop-shadow-lg" />
                        )}

                        <h2 className="text-6xl font-black mb-4 drop-shadow-md">{scannerState.message}</h2>

                        {scannerState.userData && (
                            <div className="mt-12 text-center bg-white/10 p-12 rounded-3xl backdrop-blur-md border border-white/20 w-full max-w-4xl shadow-2xl">
                                <div className="text-7xl font-black mb-6 tracking-tight">{scannerState.userData.name}</div>
                                <div className="text-4xl opacity-90 font-light">{scannerState.userData.affiliation}</div>
                            </div>
                        )}

                        {scannerState.status === 'ERROR' && (
                            <div className="mt-6 text-3xl opacity-90 font-medium bg-black/20 px-8 py-4 rounded-xl">
                                {scannerState.message}
                            </div>
                        )}
                    </div>
                )}

                {/* Hidden Input */}
                <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    className="absolute opacity-0 w-1 h-1 top-0 left-0"
                    autoFocus
                />
            </div>
        </div>
    );
};

export default GatePage;
