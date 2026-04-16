import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../../../store/adminStore';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../../../firebase';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { CheckCircle, AlertCircle, Printer, X, Settings, Palette, Loader2, ScanLine } from 'lucide-react';
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

type ConferenceNameState = {
    ko: string;
    en: string;
    subtitle: string;
};

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
    const [conferenceName, setConferenceName] = useState<ConferenceNameState>({
        ko: '',
        en: '',
        subtitle: ''
    });

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
                    const confData = confSnap.data();
                    setConferenceName({
                        ko: confData.title?.ko || 'Conference',
                        en: confData.title?.en || '',
                        subtitle: confData.subtitle || ''
                    });
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

    if (loading) return <div>Loading Kiosk...</div>;

    return (
        <div
            className="fixed inset-0 z-[99999] flex flex-col overflow-hidden font-sans transition-colors duration-500 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.14),_transparent_30%),linear-gradient(180deg,_#f3fbfd_0%,_#f8fafc_45%,_#eef7fb_100%)]"
            style={{
                backgroundImage: design.bgImage ? `url(${design.bgImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: design.textColor
            }}
        >
            {/* Top Admin Console */}
            <div className="fixed top-0 left-0 right-0 z-[10000] flex items-center justify-between border-b border-white/10 bg-slate-950/88 p-3 text-white shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-yellow-400 flex items-center gap-2">
                        <Printer className="w-4 h-4" /> INFO DESK
                    </span>

                    <div className="flex bg-gray-700 rounded p-1">
                        {[
                            { l: '디지털만', v: 'DIGITAL_ONLY' },
                            { l: '디지털+인쇄', v: 'DIGITAL_PRINT' },
                            { l: '인쇄만', v: 'PRINT_ONLY' }
                        ].map(opt => (
                            <button
                                key={opt.v}
                                onClick={() => setIssueOption(opt.v as IssueOption['value'])}
                                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${issueOption === opt.v ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {opt.l}
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
            <div className="relative mt-16 flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(15,23,42,0.06),_transparent_28%)]" />

                <div className="relative z-10 mb-8 w-full max-w-6xl">
                    <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-sky-700 shadow-sm backdrop-blur">
                        <Printer className="h-4 w-4" /> Info Desk
                    </div>
                    <div className="mt-6 rounded-[2rem] border border-white/70 bg-white/82 px-8 py-8 shadow-[0_32px_100px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
                        <h1
                            className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl"
                            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                        >
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
                    </div>
                </div>

                <div
                    className={`relative z-10 w-full max-w-5xl overflow-hidden rounded-[2.25rem] border p-10 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm transition-all duration-500 ${
                        design.bgImage
                            ? 'border-white/15 bg-slate-950/45 text-white'
                            : 'border-sky-100 bg-white/90 text-slate-900'
                    }`}
                >
                    <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-sky-600 via-cyan-500 to-sky-400" />
                    <div className="grid gap-8 md:grid-cols-[1.05fr_0.95fr] md:items-center">
                        <div className="text-left">
                            <h2 className="text-4xl font-black leading-tight md:text-6xl">
                                QR 스캔 후
                                <br />
                                명찰 전환 · 수령
                            </h2>
                            <p className="mt-6 text-xl font-semibold leading-9 text-slate-600 md:text-2xl">
                                등록 교환권 QR을 인식해 주세요
                            </p>
                        </div>

                        <div className={`rounded-[1.75rem] border p-8 ${design.bgImage ? 'border-white/15 bg-white/10' : 'border-sky-100 bg-sky-50/70'}`}>
                            <div className="mb-6 flex items-center justify-between">
                                <div className="rounded-full bg-slate-950 px-4 py-1.5 text-xs font-black uppercase tracking-[0.24em] text-white">
                                    {issueOption.replace('_', ' ')}
                                </div>
                                <ScanLine className="h-6 w-6 text-sky-600" />
                            </div>
                            <div className="rounded-[1.5rem] border border-dashed border-sky-300 bg-white/90 px-6 py-8 text-center shadow-sm">
                                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[1.5rem] bg-[linear-gradient(135deg,_#0f172a_0%,_#0369a1_100%)] text-white shadow-xl">
                                    <ScanLine className="h-12 w-12" />
                                </div>
                                <p className="mt-6 text-2xl font-black tracking-tight text-slate-900">
                                    QR SCAN
                                </p>
                                <p className="mt-2 text-lg font-semibold text-slate-500">
                                    명찰 전환 / Badge Pickup
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Processing Indicator */}
                {scannerState.status === 'PROCESSING' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[50000] backdrop-blur-sm">
                        <div className="bg-white p-8 rounded-2xl flex flex-col items-center">
                            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mb-4" />
                            <p className="text-xl font-bold text-gray-800">처리중...</p>
                        </div>
                    </div>
                )}

                {/* Result Overlay (Success/Error) */}
                {(scannerState.status === 'SUCCESS' || scannerState.status === 'ERROR') && (
                    <div className={`absolute inset-0 z-[60000] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 ${scannerState.status === 'SUCCESS' ? 'bg-[linear-gradient(180deg,_#059669_0%,_#16a34a_100%)]' : 'bg-[linear-gradient(180deg,_#dc2626_0%,_#b91c1c_100%)]'
                        } text-white`}>
                        {scannerState.status === 'SUCCESS' ? (
                            <CheckCircle className="w-40 h-40 mb-8 drop-shadow-lg" />
                        ) : (
                            <AlertCircle className="w-40 h-40 mb-8 drop-shadow-lg" />
                        )}

                        <h2 className="text-6xl font-black mb-4 drop-shadow-md">{scannerState.message}</h2>

                        {scannerState.userData && (
                            <div className="mt-12 w-full max-w-4xl rounded-[2rem] border border-white/20 bg-white/10 p-12 text-center shadow-2xl backdrop-blur-md">
                                <div className="mb-6 mt-4 text-7xl font-black tracking-tight">{scannerState.userData.name}</div>
                                <div className="text-4xl font-light opacity-90">{scannerState.userData.affiliation}</div>
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

export default InfodeskPage;
