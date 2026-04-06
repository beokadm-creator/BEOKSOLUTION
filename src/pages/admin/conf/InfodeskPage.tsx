import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../../../store/adminStore';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../../../firebase';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { CheckCircle, AlertCircle, Printer, X, Settings, Palette, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useBixolon } from '../../../hooks/useBixolon';
import { BadgeElement } from '../../../types/schema';

// Types
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

interface IssueOption {
    label: string;
    value: 'DIGITAL_ONLY' | 'DIGITAL_PRINT' | 'PRINT_ONLY';
}

const InfodeskPage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const { selectedConferenceId } = useAdminStore();
    const [loading, setLoading] = useState(true);
    const { printBadge, error: printError } = useBixolon();

    // Config
    const [conferenceTitle, setConferenceTitle] = useState('');
    const [conferenceSubtitle, setConferenceSubtitle] = useState('');

    // Info Desk Settings
    const [issueOption, setIssueOption] = useState<IssueOption['value']>('DIGITAL_PRINT');

    // Design State
    const [showSettings, setShowSettings] = useState(false);
    const [design, setDesign] = useState<DesignConfig>(() => {
        const saved = localStorage.getItem('infodesk_design');
        return saved ? JSON.parse(saved) : { bgImage: null, textColor: '#000000', fontSize: 'normal' };
    });

    // Scanner State
    const [scannerState, setScannerState] = useState<ScannerState>({
        status: 'IDLE',
        message: 'Ready to Scan',
        lastScanned: ''
    });

    const [badgeLayout, setBadgeLayout] = useState<{ width: number; height: number; elements: BadgeElement[]; enableCutting?: boolean } | null>(null);
    const [attendeeCache, setAttendeeCache] = useState<Map<string, any>>(new Map());
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');

    // Load Data
    useEffect(() => {
        const init = async () => {
            const targetId = cid || selectedConferenceId;
            if (!targetId) return;

            try {
                // 1. Conf Info
                const confRef = doc(db, 'conferences', targetId);
                const confSnap = await getDoc(confRef);
                if (confSnap.exists()) {
                    setConferenceTitle(confSnap.data().title?.ko || 'Conference');
                    setConferenceSubtitle(confSnap.data().subtitle || '');
                }

                // 2. Load Badge Layout from Settings [v356]
                const layoutRef = doc(db, `conferences/${targetId}/settings`, 'badge_config');
                const layoutSnap = await getDoc(layoutRef);
                if (layoutSnap.exists()) {
                    const data = layoutSnap.data();
                    if (data.badgeLayoutEnabled) {
                        setBadgeLayout({
                            width: data.badgeLayout?.width || 800,
                            height: data.badgeLayout?.height || 1200,
                            elements: data.badgeLayout?.elements || [],
                            enableCutting: data.badgeLayout?.enableCutting || false
                        });
                    }
                }

                // 3. Pre-fetch Attendees for O(1) Scan speed [v356]
                const cache = new Map();
                const [regsSnap, extsSnap] = await Promise.all([
                    getDocs(collection(db, `conferences/${targetId}/registrations`)),
                    getDocs(collection(db, `conferences/${targetId}/external_attendees`))
                ]);
                regsSnap.forEach(d => cache.set(d.id, { ...d.data(), id: d.id, isExternal: false }));
                extsSnap.forEach(d => cache.set(d.id, { ...d.data(), id: d.id, isExternal: true }));
                setAttendeeCache(cache);

            } catch (e) {
                console.error(e);
                toast.error("Failed to load kiosk config");
            } finally {
                setLoading(false);
            }
        };
        init();

        // Load Unified Settings [v356]
        if (cid) {
            const saved = localStorage.getItem(`eregi_conf_${cid}_settings`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.infodesk?.design) setDesign(parsed.infodesk.design);
                    if (parsed.infodesk?.option) setIssueOption(parsed.infodesk.option);
                } catch (e) {
                    console.error("Failed to parse settings", e);
                }
            }
        }

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
                infodesk: {
                    design,
                    option: issueOption
                }
            };
            localStorage.setItem(key, JSON.stringify(newSettings));
        } catch (e) {
            console.error("Failed to save settings", e);
        }
    }, [design, issueOption, cid]);

    // Keep focus
    const handleBlur = () => {
        if (!showSettings) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    // PROCESS SCAN (ISSUANCE LOGIC)
    const processScan = async (code: string) => {
        if (scannerState.status === 'PROCESSING') return;

        setScannerState({ status: 'PROCESSING', message: 'Verifying...', lastScanned: code });

        try {
            const targetConferenceId = cid || selectedConferenceId;
            if (!targetConferenceId) throw new Error("Conference ID Missing");

            // Safeguard: Check if Access QR (BADGE- prefix)
            let regId = code.trim();
            if (regId.startsWith('BADGE-')) {
                throw new Error("이미 발급된 명찰(Access QR)입니다. 등록 교환권 QR을 스캔해 주세요.");
            }

            // Extract registration ID from QR code
            if (regId.startsWith('VOUCHER-')) {
                regId = regId.replace('VOUCHER-', '');
            }
            if (regId.startsWith('CONF-')) {
                regId = regId.replace('CONF-', '');
            }

            // [Optimized] Use Cache first
            let regData = attendeeCache.get(regId);
            let isExternal = regId.startsWith('EXT-');

            if (!regData) {
                console.log(`[Cache Miss] Fetching ${regId} from Firestore`);
                if (isExternal) {
                    const extRef = doc(db, `conferences/${targetConferenceId}/external_attendees`, regId);
                    const extSnap = await getDoc(extRef);
                    if (extSnap.exists()) regData = { ...extSnap.data(), id: extSnap.id, isExternal: true };
                } else {
                    const regRef = doc(db, `conferences/${targetConferenceId}/registrations`, regId);
                    const regSnap = await getDoc(regRef);
                    if (regSnap.exists()) regData = { ...regSnap.data(), id: regSnap.id, isExternal: false };
                }
            }

            if (!regData) {
                throw new Error("등록되지 않은 명찰이거나 잘못된 QR코드입니다.");
            }

            isExternal = regData.isExternal || isExternal;

            if (!isExternal && regData.status !== 'PAID' && regData.paymentStatus !== 'PAID') {
                throw new Error("결제가 완료되지 않은 명찰입니다.");
            }

            if (regData.badgeIssued) {
                throw new Error("이미 발급된 명찰입니다. 데스크에서 명찰을 수령해주세요");
            }

            let userName = isExternal ? (regData?.name || 'Unknown') : (regData?.userName || regData?.name || regData?.userInfo?.name || 'Unknown');
            let userAffiliation = regData?.userOrg || regData?.organization || regData?.affiliation || regData?.userInfo?.affiliation || regData?.userInfo?.organization || regData?.userEmail || '';

            // [Fix] Ensure we check all possible nested locations for affiliation
            if (!userAffiliation || userAffiliation.includes('@')) {
                if (!isExternal && regData?.userInfo) {
                    userAffiliation = regData.userInfo.organization || regData.userInfo.affiliation || userAffiliation;
                }
            }

            // Fallback: Fetch from user document if internal and missing affiliation
            if (!isExternal && (!userAffiliation || userAffiliation.includes('@')) && regData?.userId) {
                try {
                    const userRef = doc(db, `conferences/${targetConferenceId}/users`, regData.userId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        userAffiliation = userData.organization || userData.affiliation || userAffiliation;
                        if (userName === 'Unknown') userName = userData.name || 'Unknown';
                    }
                } catch (err) {
                    console.error("Failed to fetch user doc for affiliation fallback:", err);
                }
            }

            // Sync with regData snapshot to ensure consistency for other parts
            const finalTier = isExternal ? '외부참석자' : (regData.userTier || regData.userInfo?.grade || regData.tier || '');
            const finalLicense = regData.licenseNumber || regData.userInfo?.licenseNumber || '';

            // Logic: Issue Badge using Cloud Function (supports both regular and external attendees)
            const functions = getFunctions();
            const issueDigitalBadgeFn = httpsCallable(functions, 'issueDigitalBadge');
            const result = await issueDigitalBadgeFn({
                confId: targetConferenceId,
                regId: regId,
                issueOption: issueOption,
                isExternalAttendee: isExternal
            }) as { data: { success: boolean; badgeQr: string } };

            if (!result.data.success) {
                throw new Error("명찰 발급에 실패했습니다. 다시 시도해주세요.");
            }

            // Real Bixolon Printing
            if (issueOption !== 'DIGITAL_ONLY') {
                try {
                    toast.loading("라벨을 출력 중입니다...", { id: 'printing' });

                    // Fallback to default layout if not configured
                    const activeLayout = badgeLayout || {
                        width: 800,
                        height: 1200,
                        elements: [
                            { x: 400, y: 150, fontSize: 6, isVisible: true, type: 'QR' } as BadgeElement,
                            { x: 400, y: 450, fontSize: 4, isVisible: true, type: 'NAME' } as BadgeElement,
                            { x: 400, y: 600, fontSize: 2, isVisible: true, type: 'ORG' } as BadgeElement
                        ]
                    };

                    const getDisplayAmount = () => {
                        if (regData.amount !== undefined) return regData.amount;
                        if (regData.baseAmount !== undefined) {
                            return (regData.baseAmount || 0) + (regData.optionsTotal || 0);
                        }
                        return 0;
                    };

                    const printSuccess = await printBadge(activeLayout, {
                        name: userName,
                        org: userAffiliation,
                        category: finalTier,
                        license: finalLicense,
                        price: `${getDisplayAmount().toLocaleString()}원`,
                        affiliation: userAffiliation,
                        qrData: result.data.badgeQr
                    });

                    if (printSuccess) {
                        toast.success("라벨 출력이 완료되었습니다.", { id: 'printing' });
                    } else {
                        toast.error(printError || "라벨 출력에 실패했습니다.", { id: 'printing' });
                    }
                } catch (pe) {
                    console.error("Print Error:", pe);
                    toast.error("프린터 연결 오류가 발생했습니다.", { id: 'printing' });
                }
            }

            // Success
            setScannerState({
                status: 'SUCCESS',
                message: '명찰이 정상적으로 발급되었습니다.',
                subMessage: userName,
                lastScanned: code,
                userData: { name: userName, affiliation: userAffiliation }
            });

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : 'Scan Failed';
            setScannerState({ status: 'ERROR', message: errorMessage, lastScanned: code });
        }

        setTimeout(() => {
            setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE', message: 'Ready' });
            setInputValue('');
        }, 1000); // 3000ms -> 1000ms 로 줄여 연속 발급 속도 향상
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

    if (loading) return (
        <div className="fixed inset-0 bg-[#001f3f] flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-16 h-16 animate-spin text-white/30 mx-auto mb-4" />
                <p className="text-white/50 font-bold text-xl tracking-widest uppercase">Loading Info Desk</p>
            </div>
        </div>
    );

    return (
        <div
            className="fixed inset-0 z-[99999] flex flex-col font-sans overflow-hidden select-none"
            style={{
                backgroundImage: design.bgImage ? `url(${design.bgImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: design.bgImage ? undefined : '#001f3f',
            }}
        >
            {/* 배경 오버레이 (이미지 있을 때 가독성 확보) */}
            {design.bgImage && <div className="absolute inset-0 bg-black/50 z-0" />}

            {/* ── 관리자 컨트롤 바 ─────────────────────────────────────── */}
            <div className="shrink-0 bg-black/60 backdrop-blur-md border-b border-white/10 px-5 py-2.5 flex items-center justify-between z-[10000] relative">
                <div className="flex items-center gap-3">
                    <span className="text-[#c3daee] font-black text-sm flex items-center gap-2 px-3">
                        <Printer className="w-4 h-4" /> INFO DESK
                    </span>
                    <div className="w-px h-5 bg-white/15" />
                    <div className="flex gap-1 bg-white/10 p-1 rounded-lg">
                        {[
                            { l: '디지털', v: 'DIGITAL_ONLY' },
                            { l: '디지털+인쇄', v: 'DIGITAL_PRINT' },
                            { l: '인쇄만', v: 'PRINT_ONLY' }
                        ].map(opt => (
                            <button
                                key={opt.v}
                                onClick={() => setIssueOption(opt.v as IssueOption['value'])}
                                className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${issueOption === opt.v ? 'bg-[#003366] text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                            >
                                {opt.l}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                    >
                        <Palette className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm font-bold px-3 py-2 rounded-lg hover:bg-white/10"
                    >
                        <X className="w-4 h-4" /> 나가기
                    </button>
                </div>
            </div>

            {/* ── 메인 스테이지 ────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-center relative z-10 overflow-hidden">

                {/* 배경 글로우 (이미지 없을 때) */}
                {!design.bgImage && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#003366]/20 blur-[120px]" />
                    </div>
                )}

                {/* 대기 상태 */}
                {scannerState.status === 'IDLE' && (
                    <div className="flex flex-col items-center z-10 px-8 w-full max-w-3xl">
                        <div className="text-center mb-10" style={{ color: design.bgImage ? design.textColor : undefined }}>
                            <h1 className={`text-5xl md:text-6xl font-black mb-3 leading-tight ${design.bgImage ? '' : 'text-white'}`}>
                                {conferenceTitle}
                            </h1>
                            {conferenceSubtitle && (
                                <p className={`text-2xl font-medium ${design.bgImage ? 'opacity-80' : 'text-white/50'}`}>
                                    {conferenceSubtitle}
                                </p>
                            )}
                        </div>

                        <div className="w-full bg-white/5 border border-white/10 rounded-[40px] p-14 md:p-16 flex flex-col items-center shadow-[0_0_80px_rgba(0,51,102,0.4)] backdrop-blur-sm">
                            <div className="w-44 h-44 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center mb-10">
                                <Printer className="w-20 h-20 text-white/20" />
                            </div>
                            <h2 className="text-5xl md:text-6xl font-black text-white mb-5">등록 확인 및 명찰 발급</h2>
                            <p className="text-white/40 text-xl md:text-2xl font-medium text-center leading-relaxed">
                                등록 교환권(QR)을 스캐너에 인식시켜 주세요
                                <br />
                                <span className="text-white/25 text-lg">Please scan your Registration Voucher</span>
                            </p>
                            <div className="mt-10 flex items-center gap-3 text-white/25 font-black uppercase tracking-[0.5em] text-xs animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-white/30 animate-ping" />
                                SCAN QR CODE
                            </div>
                        </div>
                    </div>
                )}

                {/* 처리 중 전체화면 */}
                {scannerState.status === 'PROCESSING' && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-[50000] backdrop-blur-md">
                        <Loader2 className="w-28 h-28 animate-spin text-[#c3daee] mb-8" />
                        <p className="text-4xl font-black text-white">발급 처리 중...</p>
                    </div>
                )}

                {/* 성공 전체화면 */}
                {scannerState.status === 'SUCCESS' && (
                    <div className="absolute inset-0 bg-green-600 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 z-[60000]">
                        <CheckCircle className="w-52 h-52 text-white drop-shadow-2xl mb-8" />
                        <h2 className="text-7xl md:text-8xl font-black text-white mb-6 drop-shadow-lg">
                            {scannerState.message}
                        </h2>
                        {scannerState.userData && (
                            <div className="text-center bg-white/15 border border-white/20 rounded-3xl px-16 py-10 backdrop-blur-sm mt-4 w-full max-w-4xl">
                                <div className="text-6xl md:text-7xl font-black text-white mb-4 tracking-tight">
                                    {scannerState.userData.name}
                                </div>
                                <div className="text-3xl md:text-4xl text-white/70 font-medium">
                                    {scannerState.userData.affiliation}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 실패 전체화면 */}
                {scannerState.status === 'ERROR' && (
                    <div className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 z-[60000]">
                        <AlertCircle className="w-52 h-52 text-white drop-shadow-2xl mb-8" />
                        <h2 className="text-7xl md:text-8xl font-black text-white mb-6 drop-shadow-lg">발급 실패</h2>
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
                    className="absolute opacity-0 w-1 h-1 top-0 left-0"
                    autoFocus
                />
            </div>

            {/* ── 설정 패널 ────────────────────────────────────────────── */}
            {showSettings && (
                <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-[#001f3f] border border-white/20 rounded-3xl shadow-2xl w-full max-w-sm p-8">
                        <h3 className="font-black text-xl text-white mb-6 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-white/50" /> 키오스크 설정
                        </h3>
                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-white/40 uppercase mb-2 block tracking-wider">배경 이미지</label>
                                <input type="file" accept="image/*" onChange={handleBgUpload} className="text-sm w-full text-white/60" />
                                {design.bgImage && (
                                    <button
                                        onClick={() => setDesign(prev => ({ ...prev, bgImage: null }))}
                                        className="mt-2 w-full py-2 text-xs font-bold text-white/60 border border-white/20 rounded-xl hover:bg-white/10 transition-colors"
                                    >
                                        이미지 제거
                                    </button>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-white/40 uppercase mb-2 block tracking-wider">텍스트 색상</label>
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="color"
                                        value={design.textColor}
                                        onChange={(e) => setDesign(prev => ({ ...prev, textColor: e.target.value }))}
                                        className="h-10 w-16 p-1 rounded-xl border border-white/20 bg-white/10 cursor-pointer"
                                    />
                                    <button onClick={() => setDesign(prev => ({ ...prev, textColor: '#ffffff' }))} className="w-10 h-10 bg-white rounded-full border border-white/30 shadow" />
                                    <button onClick={() => setDesign(prev => ({ ...prev, textColor: '#000000' }))} className="w-10 h-10 bg-black rounded-full border border-white/20 shadow" />
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="w-full py-3 bg-[#003366] hover:bg-[#002244] text-white font-black rounded-xl transition-colors mt-2"
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

export default InfodeskPage;
