import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../../../store/adminStore';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../../../firebase';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { CheckCircle, Printer, X, Settings, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useBixolon } from '../../../hooks/useBixolon';
import { BadgeElement } from '../../../types/schema';

// ── Types ─────────────────────────────────────────────────────────────────
interface ScanResult {
    status: 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
    processingPhase?: 'verify' | 'print';  // 처리 단계 구분
    message: string;
    lastScanned: string;
    userData?: { name: string; affiliation: string };
}

interface DesignConfig {
    bgImage: string | null;
    textColor: string;
}

type IssueOption = 'DIGITAL_ONLY' | 'DIGITAL_PRINT' | 'PRINT_ONLY';

const ISSUE_OPTIONS: { value: IssueOption; label: string; sub: string }[] = [
    { value: 'DIGITAL_ONLY',  label: '디지털',      sub: '앱 QR 발급만' },
    { value: 'DIGITAL_PRINT', label: '디지털+인쇄',  sub: 'QR 발급 + 라벨 출력' },
    { value: 'PRINT_ONLY',    label: '인쇄만',      sub: '물리 라벨만 출력' },
];

// ── Component ──────────────────────────────────────────────────────────────
const InfodeskPage: React.FC = () => {
    const navigate = useNavigate();
    const { cid } = useParams<{ cid: string }>();
    const { selectedConferenceId } = useAdminStore();
    const [loading, setLoading] = useState(true);
    const { printBadge, error: printError } = useBixolon();

    const [conferenceTitle, setConferenceTitle] = useState('');
    const [conferenceSubtitle, setConferenceSubtitle] = useState('');
    const [issueOption, setIssueOption] = useState<IssueOption>('DIGITAL_PRINT');
    const [showSettings, setShowSettings] = useState(false);
    const [design, setDesign] = useState<DesignConfig>(() => {
        const saved = localStorage.getItem('infodesk_design');
        return saved ? JSON.parse(saved) : { bgImage: null, textColor: '#ffffff' };
    });

    const [scanResult, setScanResult] = useState<ScanResult>({ status: 'IDLE', message: '', lastScanned: '' });
    const [badgeLayout, setBadgeLayout] = useState<{ width: number; height: number; elements: BadgeElement[]; enableCutting?: boolean } | null>(null);
    const [attendeeCache, setAttendeeCache] = useState<Map<string, any>>(new Map());

    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');

    // ── 초기화 ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const targetId = cid || selectedConferenceId;
        if (!targetId) return;

        const init = async () => {
            try {
                // 학술대회 정보
                const confSnap = await getDoc(doc(db, 'conferences', targetId));
                if (confSnap.exists()) {
                    setConferenceTitle(confSnap.data().title?.ko || 'Conference');
                    setConferenceSubtitle(confSnap.data().subtitle || '');
                }

                // 명찰 레이아웃
                const layoutSnap = await getDoc(doc(db, `conferences/${targetId}/settings`, 'badge_config'));
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

                // 참석자 데이터 전체 캐시 (O(1) 스캔 속도)
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
                toast.error("설정 로드 실패");
            } finally {
                setLoading(false);
            }
        };

        init();

        // 저장된 설정 복원
        if (cid) {
            const saved = localStorage.getItem(`eregi_conf_${cid}_settings`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.infodesk?.design) setDesign(parsed.infodesk.design);
                    if (parsed.infodesk?.option) setIssueOption(parsed.infodesk.option);
                } catch { /* ignore */ }
            }
        }

        setTimeout(() => inputRef.current?.focus(), 500);
    }, [cid, selectedConferenceId]);

    // 설정 저장
    useEffect(() => {
        if (!cid) return;
        try {
            const key = `eregi_conf_${cid}_settings`;
            const saved = localStorage.getItem(key);
            const parsed = saved ? JSON.parse(saved) : {};
            localStorage.setItem(key, JSON.stringify({ ...parsed, infodesk: { design, option: issueOption } }));
        } catch { /* ignore */ }
    }, [design, issueOption, cid]);

    const handleBlur = () => { if (!showSettings) setTimeout(() => inputRef.current?.focus(), 100); };

    // ── 스캔 처리 (명찰 발급) ─────────────────────────────────────────────
    const processScan = async (code: string) => {
        if (scanResult.status === 'PROCESSING') return;
        setInputValue(''); // 즉시 초기화

        const targetConferenceId = cid || selectedConferenceId;
        if (!targetConferenceId) {
            setScanResult({ status: 'ERROR', message: '학술대회 ID가 없습니다', lastScanned: code });
            return;
        }

        setScanResult({ status: 'PROCESSING', processingPhase: 'verify', message: '', lastScanned: code });

        try {
            // BADGE-* QR = 이미 발급된 명찰 → 데스크에서 수령 안내
            if (code.trim().startsWith('BADGE-')) {
                throw new Error('이미 발급된 명찰입니다. 데스크에서 명찰을 수령해 주세요.');
            }

            // QR 코드에서 등록 ID 추출
            let regId = code.trim();
            if (regId.startsWith('VOUCHER-')) regId = regId.replace('VOUCHER-', '');
            if (regId.startsWith('CONF-'))    regId = regId.replace('CONF-', '');

            // 캐시 우선 조회
            let regData = attendeeCache.get(regId);
            let isExternal = regId.startsWith('EXT-');

            if (!regData) {
                // 캐시 미스: Firestore 직접 조회
                const collName = isExternal ? 'external_attendees' : 'registrations';
                const snap = await getDoc(doc(db, `conferences/${targetConferenceId}/${collName}`, regId));
                if (snap.exists()) regData = { ...snap.data(), id: snap.id, isExternal };
            }

            if (!regData) throw new Error('등록되지 않은 QR코드입니다.');

            isExternal = regData.isExternal || isExternal;

            // 결제 확인 (내부 참석자만)
            if (!isExternal && regData.status !== 'PAID' && regData.paymentStatus !== 'PAID') {
                throw new Error('결제가 완료되지 않은 등록입니다.');
            }

            // 중복 발급 확인
            if (regData.badgeIssued) {
                throw new Error('이미 발급된 명찰입니다. 데스크에서 명찰을 수령해 주세요.');
            }

            // 참석자 정보 추출
            let userName = isExternal
                ? (regData?.name || 'Unknown')
                : (regData?.userName || regData?.name || regData?.userInfo?.name || 'Unknown');
            let userAffiliation = regData?.userOrg || regData?.organization || regData?.affiliation
                || regData?.userInfo?.affiliation || regData?.userInfo?.organization || regData?.userEmail || '';

            if (!userAffiliation || userAffiliation.includes('@')) {
                if (!isExternal && regData?.userInfo) {
                    userAffiliation = regData.userInfo.organization || regData.userInfo.affiliation || userAffiliation;
                }
            }

            // 소속 fallback: user 문서 조회
            if (!isExternal && (!userAffiliation || userAffiliation.includes('@')) && regData?.userId) {
                try {
                    const userSnap = await getDoc(doc(db, `conferences/${targetConferenceId}/users`, regData.userId));
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        userAffiliation = userData.organization || userData.affiliation || userAffiliation;
                        if (userName === 'Unknown') userName = userData.name || 'Unknown';
                    }
                } catch { /* fallback 실패 무시 */ }
            }

            const finalTier = isExternal ? '외부참석자' : (regData.userTier || regData.userInfo?.grade || regData.tier || '');
            const finalLicense = regData.licenseNumber || regData.userInfo?.licenseNumber || '';

            // ── 1단계: Cloud Function으로 디지털 명찰 발급 ─────────────────
            const functions = getFunctions();
            const issueDigitalBadgeFn = httpsCallable(functions, 'issueDigitalBadge');
            const result = await issueDigitalBadgeFn({
                confId: targetConferenceId,
                regId,
                issueOption,
                isExternalAttendee: isExternal
            }) as { data: { success: boolean; badgeQr: string } };

            if (!result.data.success) throw new Error('명찰 발급 처리에 실패했습니다. 다시 시도해 주세요.');

            // ── 2단계: 물리 명찰 인쇄 (옵션) ───────────────────────────────
            if (issueOption !== 'DIGITAL_ONLY') {
                setScanResult(prev => ({ ...prev, processingPhase: 'print' }));

                try {
                    toast.loading("라벨 출력 중...", { id: 'printing' });

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
                        return (regData.baseAmount || 0) + (regData.optionsTotal || 0);
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
                        toast.success("라벨 출력 완료", { id: 'printing' });
                    } else {
                        toast.error(printError || "라벨 출력 실패 — 프린터를 확인해 주세요", { id: 'printing' });
                    }
                } catch (pe) {
                    console.error("Print Error:", pe);
                    toast.error("프린터 연결 오류", { id: 'printing' });
                }
            }

            // ── 성공 ────────────────────────────────────────────────────────
            setScanResult({
                status: 'SUCCESS',
                message: '발급 완료',
                lastScanned: code,
                userData: { name: userName, affiliation: userAffiliation }
            });

        } catch (e) {
            setScanResult({
                status: 'ERROR',
                message: e instanceof Error ? e.message : '처리 오류가 발생했습니다',
                lastScanned: code
            });
        }

        // 2초 후 IDLE로 복귀 (직원이 이름 확인할 시간)
        setTimeout(() => {
            setScanResult(prev => prev.status !== 'PROCESSING' ? { ...prev, status: 'IDLE' } : prev);
            setInputValue('');
        }, 2000);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && inputValue.trim()) processScan(inputValue.trim());
    };

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) setDesign(prev => ({ ...prev, bgImage: ev.target!.result as string }));
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    // ── 로딩 ──────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="fixed inset-0 bg-[#001f3f] flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-14 h-14 animate-spin text-white/25 mx-auto mb-5" />
                <p className="text-white/40 font-bold text-lg tracking-widest uppercase">Loading Info Desk</p>
            </div>
        </div>
    );

    const currentIssueOpt = ISSUE_OPTIONS.find(o => o.value === issueOption)!;
    const hasBgImage = !!design.bgImage;
    const titleColor = hasBgImage ? design.textColor : '#ffffff';

    // ── 메인 렌더 ─────────────────────────────────────────────────────────
    return (
        <div
            className="fixed inset-0 z-[99999] flex flex-col font-sans overflow-hidden select-none"
            style={{
                backgroundImage: hasBgImage ? `url(${design.bgImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: hasBgImage ? undefined : '#001f3f',
            }}
        >
            {/* 배경 이미지 가독성 오버레이 */}
            {hasBgImage && <div className="absolute inset-0 bg-black/55 z-0" />}

            {/* 관리자 컨트롤 바 */}
            <div className="shrink-0 bg-black/65 backdrop-blur-md border-b border-white/10 px-4 py-2.5 flex items-center justify-between z-[10000] relative">
                <div className="flex items-center gap-3">
                    {/* INFO DESK 레이블 */}
                    <div className="flex items-center gap-2 px-3">
                        <Printer className="w-4 h-4 text-[#7ab8e8]" />
                        <span className="text-[#7ab8e8] font-black text-sm tracking-wider">INFO DESK</span>
                    </div>
                    <div className="w-px h-5 bg-white/15" />
                    {/* 발급 방식 선택 */}
                    <div className="flex gap-1 bg-white/10 p-1 rounded-lg">
                        {ISSUE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setIssueOption(opt.value)}
                                className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${issueOption === opt.value ? 'bg-[#003366] text-white shadow-lg' : 'text-white/35 hover:text-white/70'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    {/* 프린터 연결 표시 (인쇄 모드일 때만) */}
                    {issueOption !== 'DIGITAL_ONLY' && (
                        <div className="flex items-center gap-1.5 text-white/30 text-xs font-bold px-2">
                            <Wifi className="w-3.5 h-3.5" />
                            <span>프린터</span>
                        </div>
                    )}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm font-bold px-3 py-2 rounded-lg hover:bg-white/10"
                    >
                        <X className="w-4 h-4" /> 나가기
                    </button>
                </div>
            </div>

            {/* 메인 스테이지 */}
            <div className="flex-1 flex flex-col items-center justify-center relative z-10 overflow-hidden px-8">

                {/* 배경 글로우 (이미지 없을 때) */}
                {!hasBgImage && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#003366]/25 blur-[140px] pointer-events-none" />
                )}

                {/* IDLE */}
                {scanResult.status === 'IDLE' && (
                    <div className="flex flex-col items-center z-10 w-full max-w-xl">
                        {/* 학술대회명 */}
                        <p
                            className="text-base font-bold mb-6 text-center tracking-wide truncate max-w-full"
                            style={{ color: titleColor, opacity: 0.6 }}
                        >
                            {conferenceTitle}
                        </p>

                        {/* 메인 카드 */}
                        <div className="w-full rounded-[32px] overflow-hidden border border-white/10 shadow-2xl mb-7">
                            {/* 헤더: 현재 발급 방식 */}
                            <div className="bg-[#003366] px-8 py-6 text-center">
                                <p className="text-white/50 text-xs font-black uppercase tracking-[0.5em] mb-2">
                                    발급 방식 · Issue Mode
                                </p>
                                <p className="text-white text-4xl font-black mb-1">
                                    {currentIssueOpt.label}
                                </p>
                                <p className="text-white/50 text-sm font-medium">
                                    {currentIssueOpt.sub}
                                </p>
                            </div>

                            {/* 스캔 안내 */}
                            <div className="bg-white/5 px-8 py-7 flex flex-col items-center">
                                <div className="w-16 h-16 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center mb-5">
                                    <Printer className="w-7 h-7 text-white/25" />
                                </div>
                                <p className="text-white/70 text-xl font-bold text-center mb-2">
                                    등록 교환권 QR을 스캔해 주세요
                                </p>
                                <p className="text-white/35 text-sm text-center">
                                    Please scan your Registration Voucher QR
                                </p>
                            </div>
                        </div>

                        {/* 스캔 대기 표시 */}
                        <div className="flex items-center gap-3 text-white/20 font-black uppercase tracking-[0.5em] text-[11px] animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-white/30 animate-ping" />
                            SCAN QR CODE
                        </div>
                    </div>
                )}

                {/* PROCESSING — 단계별 구분 */}
                {scanResult.status === 'PROCESSING' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-[50000] backdrop-blur-md">
                        <Loader2 className="w-20 h-20 animate-spin text-[#7ab8e8] mb-6" />
                        <p className="text-white text-3xl font-black mb-2">
                            {scanResult.processingPhase === 'print' ? '명찰 출력 중...' : '발급 처리 중...'}
                        </p>
                        <p className="text-white/40 text-sm font-medium">
                            {scanResult.processingPhase === 'print'
                                ? '프린터로 데이터를 전송하고 있습니다'
                                : '등록 정보를 확인하고 명찰을 발급합니다'}
                        </p>
                    </div>
                )}

                {/* SUCCESS */}
                {scanResult.status === 'SUCCESS' && (
                    <div className="absolute inset-0 bg-green-700 flex flex-col items-center justify-center z-[60000] px-10">
                        <CheckCircle className="w-28 h-28 text-white mb-5 drop-shadow-2xl" />
                        <h2 className="text-[5rem] md:text-[6rem] font-black text-white leading-none mb-7 text-center">
                            {scanResult.message}
                        </h2>
                        {scanResult.userData && (
                            <div className="text-center">
                                <p className="text-5xl md:text-6xl font-black text-white mb-2 leading-tight">
                                    {scanResult.userData.name}
                                </p>
                                {scanResult.userData.affiliation && (
                                    <p className="text-xl text-white/65 font-medium">
                                        {scanResult.userData.affiliation}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ERROR */}
                {scanResult.status === 'ERROR' && (
                    <div className="absolute inset-0 bg-red-700 flex flex-col items-center justify-center z-[60000] px-10">
                        <X className="w-28 h-28 text-white mb-5 drop-shadow-2xl" />
                        <h2 className="text-[5rem] md:text-[6rem] font-black text-white leading-none mb-6 text-center">
                            발급 실패
                        </h2>
                        <div className="bg-black/20 rounded-2xl px-8 py-4 max-w-lg">
                            <p className="text-2xl md:text-3xl text-white/80 font-bold text-center leading-snug">
                                {scanResult.message}
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
                    className="absolute opacity-0 w-1 h-1 top-0 left-0"
                    autoFocus
                />
            </div>

            {/* 설정 패널 */}
            {showSettings && (
                <div className="fixed inset-0 z-[10001] bg-black/65 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-[#001f3f] border border-white/20 rounded-3xl shadow-2xl w-full max-w-sm p-8">
                        <h3 className="font-black text-lg text-white mb-6 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-white/40" />
                            키오스크 설정
                        </h3>
                        <div className="space-y-5">
                            {/* 배경 이미지 */}
                            <div>
                                <label className="text-xs font-bold text-white/40 uppercase mb-2 block tracking-wider">
                                    배경 이미지
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleBgUpload}
                                    className="text-sm w-full text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/70 file:text-xs file:font-bold"
                                />
                                {hasBgImage && (
                                    <button
                                        onClick={() => setDesign(prev => ({ ...prev, bgImage: null }))}
                                        className="mt-2 w-full py-2 text-xs font-bold text-white/60 border border-white/20 rounded-xl hover:bg-white/10 transition-colors"
                                    >
                                        이미지 제거
                                    </button>
                                )}
                            </div>
                            {/* 텍스트 색상 (배경 이미지 위 글자색) */}
                            {hasBgImage && (
                                <div>
                                    <label className="text-xs font-bold text-white/40 uppercase mb-2 block tracking-wider">
                                        텍스트 색상
                                    </label>
                                    <div className="flex gap-3 items-center">
                                        <input
                                            type="color"
                                            value={design.textColor}
                                            onChange={e => setDesign(prev => ({ ...prev, textColor: e.target.value }))}
                                            className="h-10 w-14 p-1 rounded-xl border border-white/20 bg-white/10 cursor-pointer"
                                        />
                                        <button
                                            onClick={() => setDesign(prev => ({ ...prev, textColor: '#ffffff' }))}
                                            className="w-9 h-9 bg-white rounded-full border-2 border-white/30 shadow"
                                        />
                                        <button
                                            onClick={() => setDesign(prev => ({ ...prev, textColor: '#000000' }))}
                                            className="w-9 h-9 bg-black rounded-full border-2 border-white/20 shadow"
                                        />
                                    </div>
                                </div>
                            )}
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
