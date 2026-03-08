import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp, addDoc, collection, increment, query, where, getDocs, limit, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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

const AttendanceScannerPage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const [loading, setLoading] = useState(true);

    // Config
    const [zones, setZones] = useState<any[]>([]);
    const [selectedZoneId, setSelectedZoneId] = useState<string>('');
    const [mode, setMode] = useState<'ENTER_ONLY' | 'EXIT_ONLY' | 'AUTO'>('ENTER_ONLY');
    const [conferenceTitle, setConferenceTitle] = useState('');
    const [conferenceSubtitle, setConferenceSubtitle] = useState('');

    // Scanner State
    const [scannerState, setScannerState] = useState<ScannerState>({
        status: 'IDLE',
        message: 'Ready to Scan',
        lastScanned: ''
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const scanMemoryRef = useRef<Map<string, number>>(new Map());

    // Load Data
    useEffect(() => {
        if (!cid) return;
        const init = async () => {
            try {
                // 1. Conf Info
                const confRef = doc(db, 'conferences', cid);
                const confSnap = await getDoc(confRef);
                if (confSnap.exists()) {
                    setConferenceTitle(confSnap.data().title?.ko || 'Conference');
                    setConferenceSubtitle(confSnap.data().subtitle || '');
                }

                // 2. Fetch ALL Zones from ALL Dates (Flattened)
                const rulesRef = doc(db, `conferences/${cid}/settings/attendance`);
                const rulesSnap = await getDoc(rulesRef);
                if (rulesSnap.exists()) {
                    const allRules = rulesSnap.data().rules || {};
                    let allZones: unknown[] = [];
                    Object.entries(allRules).forEach(([dateStr, rule]: [string, any]) => {
                        if (rule && typeof rule === 'object' && 'zones' in rule) {
                            (rule.zones as unknown[]).forEach((z: any) => {
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

                    // Deduplicate by ID
                    const uniqueZones = Array.from(new Map(allZones.map((item: unknown) => [typeof item === 'object' && item !== null && 'id' in item ? item.id : '', item])).values());
                    setZones(uniqueZones);
                    if (uniqueZones.length > 0 && typeof uniqueZones[0] === 'object' && uniqueZones[0] !== null && 'id' in uniqueZones[0]) {
                        setSelectedZoneId((uniqueZones[0] as { id: string }).id);
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
    }, [cid]);

    // Keep focus
    const handleBlur = () => {
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    // PROCESS SCAN
    const processScan = async (code: string) => {
        if (scannerState.status === 'PROCESSING') return;

        // 10초 쿨타임 검사 로직 추가 (Debounce 따닥 스캔 방지)
        const nowMs = Date.now();
        const lastScanMs = scanMemoryRef.current.get(code);
        if (lastScanMs && nowMs - lastScanMs < 10000) {
            setScannerState({
                status: 'ERROR',
                message: '방금 처리되었습니다. (10초 후 다시 스캔해 주세요)',
                lastScanned: code
            });
            setTimeout(() => {
                setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE', message: 'Ready' });
                setInputValue('');
            }, 1000);
            return;
        }

        if (!selectedZoneId) {
            setScannerState({ status: 'ERROR', message: 'No Zone Selected', lastScanned: code });
            return;
        }

        setScannerState({ status: 'PROCESSING', message: 'Verifying...', lastScanned: code });

        try {
            if (!cid) {
                console.error("Conference ID is missing.");
                setScannerState({
                    status: 'ERROR',
                    message: 'Conference Not Selected (System Error)',
                    lastScanned: code
                });
                return;
            }

            // === CHANGED: 명찰 QR로 조회 (badgeQr = UUID) ===
            // 1. registrations 컬렉션에서 badgeQr 검색
            const regQuery = query(
                collection(db, `conferences/${cid}/registrations`),
                where('badgeQr', '==', code),
                limit(1)
            );
            const regSnap = await getDocs(regQuery);

            let regDoc: QueryDocumentSnapshot | null = null;

            let isExternal = false;
            if (!regSnap.empty) {
                regDoc = regSnap.docs[0];
                isExternal = false;
            } else {
                // 2. external_attendees 컬렉션에서 badgeQr 검색
                const extQuery = query(
                    collection(db, `conferences/${cid}/external_attendees`),
                    where('badgeQr', '==', code),
                    limit(1)
                );
                const extSnap = await getDocs(extQuery);

                if (!extSnap.empty) {
                    regDoc = extSnap.docs[0];
                    isExternal = true;
                }
            }

            // 3. 명찰 QR을 찾지 못함
            if (!regDoc) {
                throw new Error("❌ Invalid Badge QR\n\n명찰이 발급되지 않았습니다.\n인포데스크에서 명찰 발급을 먼저 받으세요.");
            }

            const regData = regDoc.data();

            // === NEW: 보안 검증 (명찰 발급 여부) ===
            if (!regData.badgeIssued) {
                throw new Error("❌ Badge Not Issued\n\n인포데스크에서 명찰 발급이 필요합니다.\n바우처 QR로는 입장할 수 없습니다.");
            }
            // === END NEW ===

            if (regData.status !== 'PAID' && regData.paymentStatus !== 'PAID') {
                throw new Error("결제가 완료되지 않은 명찰입니다.");
            }

            const regId = regDoc.id; // Use registration ID from query result

            let userName = isExternal ? (regData.name || 'Unknown') : (regData.userName || regData.name || regData.userInfo?.name || 'Unknown');
            let userAffiliation = regData.userOrg || regData.affiliation || regData.organization || regData.userInfo?.affiliation || regData.userInfo?.organization || regData.userEmail || '';

            // Ensure we fetch from user doc if missing or is an email
            if (!isExternal && (userName === 'Unknown' || !userAffiliation || userAffiliation.includes('@')) && regData.userId) {
                try {
                    const userRef = doc(db, `conferences/${cid}/users`, regData.userId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        userAffiliation = userData.organization || userData.affiliation || userAffiliation;
                        userName = userName !== 'Unknown' ? userName : (userData.name || 'Unknown');
                    }
                } catch (err) {
                    console.error("Failed to fetch user doc for affiliation fallback:", err);
                }
            }
            const currentStatus = regData.attendanceStatus || 'OUTSIDE';
            const currentZone = regData.currentZone;
            const currentTotalMinutes = typeof regData.totalMinutes === 'number' ? regData.totalMinutes : 0;

            // 2. Logic Switch
            let action = '';

            if (mode === 'ENTER_ONLY') {
                if (currentStatus === 'INSIDE') {
                    if (currentZone === selectedZoneId) throw new Error(`${userName}님은 이미 입장 상태입니다.`);
                    // Auto-Switch
                    await performCheckOut(regId, currentZone, regData.lastCheckIn, currentTotalMinutes, isExternal);
                    await performCheckIn(regId, selectedZoneId, isExternal);
                    action = 'Switched & Checked In';
                } else {
                    await performCheckIn(regId, selectedZoneId, isExternal);
                    action = '입장 완료 (Checked In)';
                }
            }
            else if (mode === 'EXIT_ONLY') {
                if (currentStatus !== 'INSIDE') throw new Error(`${userName}님은 입장 기록이 없습니다.`);
                await performCheckOut(regId, currentZone, regData.lastCheckIn, currentTotalMinutes, isExternal);
                action = '퇴장 완료 (Checked Out)';
            }
            else if (mode === 'AUTO') {
                if (currentStatus === 'INSIDE') {
                    if (currentZone !== selectedZoneId) {
                        await performCheckOut(regId, currentZone, regData.lastCheckIn, currentTotalMinutes, isExternal);
                        await performCheckIn(regId, selectedZoneId, isExternal);
                        action = 'Zone Switched';
                    } else {
                        await performCheckOut(regId, currentZone, regData.lastCheckIn, currentTotalMinutes, isExternal);
                        action = '퇴장 완료 (Checked Out)';
                    }
                } else {
                    await performCheckIn(regId, selectedZoneId, isExternal);
                    action = '입장 완료 (Checked In)';
                }
            }

            // Success
            setScannerState({
                status: 'SUCCESS',
                message: action,
                subMessage: userName,
                lastScanned: code,
                userData: { name: userName, affiliation: userAffiliation }
            });

            // 쿨타임 기록 갱신 (성공했을 때만 10초 막기 적용)
            scanMemoryRef.current.set(code, Date.now());

        } catch (e) {
            console.error(e);
            setScannerState({
                status: 'ERROR',
                message: e instanceof Error ? e.message : 'Scan Failed',
                lastScanned: code
            });
        }

        setTimeout(() => {
            setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE', message: 'Ready' });
            setInputValue('');
        }, 1000); // 1s delay for readability and speed
    };

    const performCheckIn = async (id: string, zoneId: string, isExternal: boolean = false) => {
        if (!cid) return;
        const collectionName = isExternal ? 'external_attendees' : 'registrations';
        const now = Timestamp.now();

        // 등록자 상태 업데이트
        await updateDoc(doc(db, 'conferences', cid, collectionName, id), {
            attendanceStatus: 'INSIDE',
            currentZone: zoneId,
            lastCheckIn: now
        });

        // [1] 서브컬렉션 로그 (개인별 상세 기록)
        await addDoc(collection(db, 'conferences', cid, collectionName, id, 'logs'), {
            type: 'ENTER', zoneId, timestamp: now, method: 'KIOSK'
        });

        // [2] 루트 access_logs (StatisticsPage / 전체 통계용)
        // scannedQr = badgeQr 값을 사용해야 하므로 등록자 데이터에서 조회
        try {
            const regRef = doc(db, 'conferences', cid, collectionName, id);
            const regSnap = await getDoc(regRef);
            const badgeQr = regSnap.data()?.badgeQr || id;
            await addDoc(collection(db, `conferences/${cid}/access_logs`), {
                action: 'ENTRY',
                scannedQr: badgeQr,
                locationId: zoneId,
                timestamp: now,
                method: 'KIOSK',
                registrationId: id,
                isExternal,
            });
        } catch (e) {
            console.warn('[AccessLog] Failed to write root access_log on ENTRY:', e);
        }
    };

    const performCheckOut = async (id: string, zoneId: string | null, lastIn: unknown, currentTotalMinutes: number = 0, isExternal: boolean = false) => {
        if (!cid) return;
        const now = new Date();
        const start = lastIn && typeof lastIn === 'object' && 'toDate' in lastIn ? (lastIn as { toDate: () => Date }).toDate() : now;
        const zoneRule = zones.find(z => typeof z === 'object' && z !== null && 'id' in z && (z as { id: string }).id === zoneId) as any;

        let durationMinutes = 0;
        let deduction = 0;
        let boundedStart = start;
        let boundedEnd = now;

        if (zoneRule && zoneRule.start && zoneRule.end && zoneRule.ruleDate) {
            // Force KST for session boundaries
            const sessionStart = new Date(`${zoneRule.ruleDate}T${zoneRule.start}:00+09:00`);
            const sessionEnd = new Date(`${zoneRule.ruleDate}T${zoneRule.end}:00+09:00`);
            boundedStart = new Date(Math.max(start.getTime(), sessionStart.getTime()));
            boundedEnd = new Date(Math.min(now.getTime(), sessionEnd.getTime()));
        }

        if (boundedEnd > boundedStart) {
            durationMinutes = Math.floor((boundedEnd.getTime() - boundedStart.getTime()) / 60000);

            if (zoneRule && Array.isArray(zoneRule.breaks)) {
                zoneRule.breaks.forEach((brk: { start: string; end: string }) => {
                    const localDateStr = zoneRule.ruleDate;
                    // Force KST for break boundaries
                    const breakStart = new Date(`${localDateStr}T${brk.start}:00+09:00`);
                    const breakEnd = new Date(`${localDateStr}T${brk.end}:00+09:00`);
                    const overlapStart = Math.max(boundedStart.getTime(), breakStart.getTime());
                    const overlapEnd = Math.min(boundedEnd.getTime(), breakEnd.getTime());
                    if (overlapEnd > overlapStart) {
                        deduction += Math.floor((overlapEnd - overlapStart) / 60000);
                    }
                });
            }
        }

        const finalMinutes = Math.max(0, durationMinutes - deduction); // 휴게 시간 차감 후 저장
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

        const exitNow = Timestamp.now();

        const updatePayload: any = {
            attendanceStatus: 'OUTSIDE',
            currentZone: null,
            totalMinutes: newTotal, // Idempotent: use absolute calculated total to prevent offline queue multiplication
            lastCheckOut: exitNow
        };
        if (zoneRule) {
            updatePayload.isCompleted = isCompleted;
        }

        const collectionName = isExternal ? 'external_attendees' : 'registrations';
        await updateDoc(doc(db, 'conferences', cid, collectionName, id), updatePayload);

        // [1] 서브컬렉션 로그 (개인별 상세 기록)
        await addDoc(collection(db, 'conferences', cid, collectionName, id, 'logs'), {
            type: 'EXIT',
            zoneId,
            timestamp: exitNow,
            method: 'KIOSK',
            recognizedMinutes: finalMinutes,
            evaluatedCompleted: isCompleted,
            accumulatedTotal: newTotal,
            rawDuration: durationMinutes,
            deduction
        });

        // [2] 루트 access_logs (StatisticsPage / 전체 통계용)
        try {
            const regRef = doc(db, 'conferences', cid, collectionName, id);
            const regSnap = await getDoc(regRef);
            const badgeQr = regSnap.data()?.badgeQr || id;
            await addDoc(collection(db, `conferences/${cid}/access_logs`), {
                action: 'EXIT',
                scannedQr: badgeQr,
                locationId: zoneId,
                timestamp: exitNow,
                method: 'KIOSK',
                registrationId: id,
                isExternal,
                recognizedMinutes: finalMinutes,
                accumulatedTotal: newTotal,
                rawDuration: durationMinutes,
                deduction,
            });
        } catch (e) {
            console.warn('[AccessLog] Failed to write root access_log on EXIT:', e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (inputValue.trim()) {
                processScan(inputValue.trim());
            }
        }
    };

    if (loading) return <div>Loading Kiosk...</div>;

    const getModeColor = () => {
        if (mode === 'ENTER_ONLY') return 'bg-blue-600';
        if (mode === 'EXIT_ONLY') return 'bg-red-600';
        return 'bg-purple-600';
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col font-sans">
            {/* Top Control Bar (Admin Only) */}
            <div className="bg-gray-100 p-2 flex justify-between items-center border-b">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-gray-500">
                    <X className="w-4 h-4 mr-1" /> Exit Kiosk
                </Button>
                <div className="flex gap-2">
                    <select
                        value={selectedZoneId}
                        onChange={e => setSelectedZoneId(e.target.value)}
                        className="text-sm border rounded p-1"
                    >
                        {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative">

                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">{conferenceTitle}</h1>
                    <p className="text-2xl text-gray-500">{conferenceSubtitle}</p>
                </div>

                {/* Mode Display */}
                <div className={`p-8 rounded-3xl w-full max-w-2xl shadow-2xl transition-colors duration-500 ${mode === 'ENTER_ONLY' ? 'bg-blue-50 border-4 border-blue-200' :
                    mode === 'EXIT_ONLY' ? 'bg-red-50 border-4 border-red-200' :
                        'bg-purple-50 border-4 border-purple-200'
                    }`}>
                    <h2 className={`text-4xl font-black mb-4 ${mode === 'ENTER_ONLY' ? 'text-blue-700' :
                        mode === 'EXIT_ONLY' ? 'text-red-700' :
                            'text-purple-700'
                        }`}>
                        {mode === 'ENTER_ONLY' && '입장 모드 (CHECK-IN)'}
                        {mode === 'EXIT_ONLY' && '퇴장 모드 (CHECK-OUT)'}
                        {mode === 'AUTO' && '자동 모드 (AUTO)'}
                    </h2>

                    <p className="text-gray-500 mb-8 text-lg">
                        명찰의 QR 코드를 스캐너에 대주세요.
                        <br />(Please scan your QR code)
                    </p>

                    {/* Mode Toggle Buttons */}
                    <div className="flex justify-center gap-4">
                        {mode !== 'ENTER_ONLY' && (
                            <Button
                                onClick={() => setMode('ENTER_ONLY')}
                                className="bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 h-12 text-lg"
                            >
                                입장 모드로 변경 (Switch to Enter)
                            </Button>
                        )}
                        {mode !== 'EXIT_ONLY' && (
                            <Button
                                onClick={() => setMode('EXIT_ONLY')}
                                className="bg-white text-red-600 border border-red-200 hover:bg-red-50 h-12 text-lg"
                            >
                                퇴장 모드로 변경 (Switch to Exit)
                            </Button>
                        )}
                    </div>
                </div>

                {/* Processing Indicator */}
                {scannerState.status === 'PROCESSING' && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-40">
                        <Loader2 className="w-24 h-24 animate-spin text-gray-400" />
                    </div>
                )}

                {/* Result Overlay */}
                {(scannerState.status === 'SUCCESS' || scannerState.status === 'ERROR') && (
                    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 ${scannerState.status === 'SUCCESS' ? getModeColor() : 'bg-red-600'
                        } text-white`}>
                        {scannerState.status === 'SUCCESS' ? (
                            <CheckCircle className="w-32 h-32 mb-8" />
                        ) : (
                            <AlertCircle className="w-32 h-32 mb-8" />
                        )}

                        <h2 className="text-5xl font-bold mb-4">{scannerState.message}</h2>

                        {scannerState.userData && (
                            <div className="mt-8 text-center bg-white/10 p-8 rounded-xl backdrop-blur-sm w-full max-w-3xl">
                                <div className="text-6xl font-black mb-4">{scannerState.userData.name}</div>
                                <div className="text-3xl opacity-90">{scannerState.userData.affiliation}</div>
                            </div>
                        )}

                        {scannerState.status === 'ERROR' && (
                            <div className="mt-4 text-2xl opacity-80">{scannerState.message}</div>
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

export default AttendanceScannerPage;
