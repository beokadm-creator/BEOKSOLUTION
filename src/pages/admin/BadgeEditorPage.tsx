import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { useConference } from '../../hooks/useConference';
import { useAdmin } from '../../hooks/useAdmin';
import { useBixolon } from '../../hooks/useBixolon';
import { BadgeElement } from '../../types/schema';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import ImageUpload from '../../components/ui/ImageUpload';
import { ImageIcon, Trash2, Save, Maximize, Plus } from 'lucide-react';

const PX_PER_MM = 3.779527;
const toMm = (px: number) => parseFloat((px / PX_PER_MM).toFixed(1));
const toPx = (mm: number) => Math.round(mm * PX_PER_MM);

const DEFAULT_BADGE_WIDTH_MM = 100;
const DEFAULT_BADGE_HEIGHT_MM = 240;

const MmInput: React.FC<{
    valueMm: number | undefined;
    onChange: (mm: number | undefined) => void;
    placeholder?: string;
    step?: number;
    className?: string;
    allowEmpty?: boolean;
}> = ({ valueMm, onChange, placeholder, step = 0.5, className = '', allowEmpty = false }) => {
    const [localVal, setLocalVal] = useState<string>(
        valueMm !== undefined ? String(valueMm) : ''
    );

    const isFocused = useRef(false);
    const prevValueMmRef = useRef(valueMm);
    useEffect(() => {
        if (!isFocused.current && valueMm !== prevValueMmRef.current) {
            setTimeout(() => {
                setLocalVal(valueMm !== undefined ? String(valueMm) : '');
            }, 0);
            prevValueMmRef.current = valueMm;
        }
    }, [valueMm]);

    return (
        <input
            type="number"
            step={step}
            value={localVal}
            placeholder={placeholder}
            className={`border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 ${className}`}
            onFocus={() => { isFocused.current = true; }}
            onChange={e => setLocalVal(e.target.value)}
            onBlur={e => {
                isFocused.current = false;
                const raw = e.target.value.trim();
                if (raw === '' && allowEmpty) {
                    onChange(undefined);
                    setLocalVal('');
                } else {
                    const num = parseFloat(raw);
                    if (!isNaN(num)) {
                        const mm = parseFloat(num.toFixed(1));
                        onChange(mm);
                        setLocalVal(String(mm));
                    }
                }
            }}
        />
    );
};

const BadgeEditorPage: React.FC = () => {
    const { id: confId, info, loading: confLoading } = useConference();
    const { saveBadgeLayout, loading: saving } = useAdmin(confId || '');
    const { printBadge, resetPrinter, printing: bixolonPrinting, error: bixolonError } = useBixolon();

    const [elements, setElements] = useState<BadgeElement[]>([]);
    const [canvasSize, setCanvasSize] = useState({
        width: DEFAULT_BADGE_WIDTH_MM,
        height: DEFAULT_BADGE_HEIGHT_MM
    });
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [bgUrl, setBgUrl] = useState<string | undefined>(undefined);
    const [printerDpmm, setPrinterDpmm] = useState(8);
    const [printOffsetXmm, setPrintOffsetXmm] = useState(0);
    const [printOffsetYmm, setPrintOffsetYmm] = useState(0);
    const [printStartOffsetMm, setPrintStartOffsetMm] = useState(0);
    const [enableCutting, setEnableCutting] = useState(true);
    const [mediaType, setMediaType] = useState(0); // 0: Gap, 1: Continuous, 2: Black Mark
    const [labelGapMm, setLabelGapMm] = useState(3);
    const [marginXMm, setMarginXMm] = useState(0);
    const [marginYMm, setMarginYMm] = useState(0);
    const prevBadgeLayoutRef = useRef(info?.badgeLayout);

    const previewData = {
        NAME: '홍길동',
        ORG: '서울대학교병원',
        QR: 'QR_CODE_PLACEHOLDER',
        CATEGORY: '정회원',
        LICENSE: '12-345678',
        PRICE: '50,000원',
        AFFILIATION: '전문의'
    };

    useEffect(() => {
        if (info?.badgeLayout && info.badgeLayout !== prevBadgeLayoutRef.current) {
            const layout = info.badgeLayout as unknown as {
                width?: number;
                height?: number;
                elements?: BadgeElement[];
                backgroundImageUrl?: string;
                printerDpmm?: number;
                printOffsetXmm?: number;
                printOffsetYmm?: number;
                printStartOffsetMm?: number;
                enableCutting?: boolean;
                unit?: 'px' | 'mm';
                mediaType?: number;
                labelGapMm?: number;
                marginXMm?: number;
                marginYMm?: number;
            };
            setTimeout(() => {
                const detectedUnit =
                    layout.unit === 'px' || layout.unit === 'mm'
                        ? layout.unit
                        : (layout.width && layout.width <= 250 && layout.height && layout.height <= 350 ? 'mm' : 'px');

                if (detectedUnit === 'px') {
                    const convertedElements = (layout.elements || []).map((el) => ({
                        ...el,
                        x: toMm(el.x),
                        y: toMm(el.y),
                        fontSize: toMm(el.fontSize),
                        maxWidth: el.maxWidth !== undefined ? toMm(el.maxWidth) : undefined,
                    }));
                    setElements(convertedElements);
                    setCanvasSize({
                        width: toMm(layout.width || toPx(DEFAULT_BADGE_WIDTH_MM)),
                        height: toMm(layout.height || toPx(DEFAULT_BADGE_HEIGHT_MM)),
                    });
                } else {
                    setElements(layout.elements || []);
                    setCanvasSize({
                        width: layout.width || DEFAULT_BADGE_WIDTH_MM,
                        height: layout.height || DEFAULT_BADGE_HEIGHT_MM,
                    });
                }
                setBgUrl(layout.backgroundImageUrl);
                setPrinterDpmm(layout.printerDpmm || 8);
                setPrintOffsetXmm(layout.printOffsetXmm || 0);
                setPrintOffsetYmm(layout.printOffsetYmm || 0);
                setPrintStartOffsetMm(layout.printStartOffsetMm || 0);
                setEnableCutting(layout.enableCutting ?? true);
                setMediaType(layout.mediaType || 0);
                setLabelGapMm(layout.labelGapMm ?? 3);
                setMarginXMm(layout.marginXMm || 0);
                setMarginYMm(layout.marginYMm || 0);
            }, 0);
            prevBadgeLayoutRef.current = info.badgeLayout;
        }
    }, [info]);

    const handleDragStop = (idx: number, e: unknown, data: { x: number, y: number }) => {
        const newEls = [...elements];
        newEls[idx] = { ...newEls[idx], x: toMm(data.x), y: toMm(data.y) };
        setElements(newEls);
        if (!selectedIndices.includes(idx)) {
            setSelectedIndices([idx]);
        }
    };

    const updateElement = (idx: number, field: keyof BadgeElement, value: unknown) => {
        const newEls = [...elements];
        newEls[idx] = { ...newEls[idx], [field]: value };
        setElements(newEls);
    };

    const handleSave = async () => {
        try {
            await saveBadgeLayout(canvasSize.width, canvasSize.height, elements, bgUrl, {
                printerDpmm,
                printOffsetXmm,
                printOffsetYmm,
                printStartOffsetMm,
                enableCutting,
                mediaType,
                labelGapMm,
                marginXMm,
                marginYMm,
                unit: 'mm'
            });
            toast.success('명찰 레이아웃이 저장되었습니다! ✅');
        } catch (e: any) {
            console.error(e);
            if (e?.code === 'permission-denied' || e?.message?.includes('Missing or insufficient permissions')) {
                toast.error('저장 권한이 없습니다. 세션이 만료되었을 수 있습니다. 다시 로그인해주세요.', { duration: 5000 });
                setTimeout(() => {
                    const params = new URLSearchParams(window.location.search);
                    const society = params.get('society') || sessionStorage.getItem('societyId') || '';
                    window.location.href = society ? `/admin/login?society=${society}` : '/admin/login';
                }, 3000);
            } else {
                toast.error(`저장 실패: ${e?.message || '알 수 없는 오류'}`);
            }
        }
    };

    const handleTestCut = async (cutPaperType: 0 | 1) => {
        const toastId = 'bixolon-test';
        if (bixolonPrinting) return;
        toast.loading('테스트 출력 중...', { id: toastId });
        try {
            const ok = await printBadge(
                {
                    width: canvasSize.width,
                    height: canvasSize.height,
                    elements: [
                        {
                            x: 0,
                            y: 0,
                            fontSize: 1,
                            isVisible: true,
                            type: 'CUSTOM',
                            content: '.',
                        },
                    ],
                    unit: 'mm',
                    enableCutting: true,
                    printerDpmm,
                    printOffsetXmm,
                    printOffsetYmm,
                    printStartOffsetMm,
                    mediaType,
                    labelGapMm,
                    marginXMm,
                    marginYMm,
                    cutPaperType,
                },
                {
                    name: 'TEST',
                    org: 'TEST',
                    category: 'TEST',
                    license: 'TEST',
                    price: 'TEST',
                    affiliation: 'TEST',
                    qrData: 'TEST',
                },
            );
            if (ok) toast.success('테스트 출력 성공', { id: toastId });
            else toast.error(bixolonError || '테스트 출력 실패', { id: toastId, duration: 6000 });
        } catch (e) {
            console.error(e);
            toast.error('테스트 출력 실패', { id: toastId, duration: 6000 });
        }
    };

    const handleResetPrinter = async () => {
        const toastId = 'bixolon-reset';
        if (bixolonPrinting) return;
        toast.loading('프린터 리셋 중...', { id: toastId });
        try {
            const ok = await resetPrinter();
            if (ok) toast.success('프린터 리셋 완료', { id: toastId });
            else toast.error(bixolonError || '프린터 리셋 실패', { id: toastId, duration: 6000 });
        } catch (e) {
            console.error(e);
            toast.error('프린터 리셋 실패', { id: toastId, duration: 6000 });
        }
    };

    const addElement = (type: BadgeElement['type']) => {
        const newElement: BadgeElement = {
            x: parseFloat((canvasSize.width / 2).toFixed(1)),
            y: 20,
            fontSize: type === 'QR' ? 25 : 6,
            isVisible: true,
            type,
            content: type === 'CUSTOM' ? 'New Text' : undefined
        };
        const newElements = [...elements, newElement];
        setElements(newElements);
        setSelectedIndices([newElements.length - 1]);
    };

    const handleSelect = (idx: number, e?: React.MouseEvent) => {
        if (e && (e.shiftKey || e.ctrlKey || e.metaKey)) {
            if (selectedIndices.includes(idx)) {
                setSelectedIndices(selectedIndices.filter(i => i !== idx));
            } else {
                setSelectedIndices([...selectedIndices, idx]);
            }
        } else {
            setSelectedIndices([idx]);
        }
    };

    const alignCenter = () => {
        if (selectedIndices.length === 0) return;
        const newEls = [...elements];
        selectedIndices.forEach(idx => {
            const node = document.getElementById(`badge-el-${idx}`);
            if (node) {
                const rect = node.getBoundingClientRect();
                const nodeWidthMm = toMm(rect.width);
                const newXmm = parseFloat(((canvasSize.width - nodeWidthMm) / 2).toFixed(1));
                newEls[idx] = { ...newEls[idx], x: newXmm };
            }
        });
        setElements(newEls);
        toast.success(`${selectedIndices.length}개 요소 중앙 정렬 완료`);
    };

    if (confLoading) return (
        <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 animate-pulse">Loading Layout...</p>
        </div>
    );

    return (
        <div className="flex h-[calc(100vh-100px)] overflow-hidden bg-slate-50">
            {/* Main Canvas Area */}
            <div className="flex-1 overflow-auto p-12 flex items-center justify-center">
                <div
                    className="relative bg-white shadow-2xl border border-slate-200"
                    style={{ width: toPx(canvasSize.width), height: toPx(canvasSize.height) }}
                    onClick={() => setSelectedIndices([])}
                >
                    {/* Background Image Layer */}
                    {bgUrl && (
                        <img
                            src={bgUrl}
                            alt="Badge Background"
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
                        />
                    )}

                    {/* Grid Overlay (Optional) */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                        style={{
                            backgroundImage: 'radial-gradient(#000 1px, transparent 0)',
                            backgroundSize: `${toPx(5)}px ${toPx(5)}px`
                        }}
                    />

                    {elements.map((el, idx) => (
                        el.isVisible !== false && (
                            <DraggableNode
                                key={idx}
                                el={el}
                                idx={idx}
                                isSelected={selectedIndices.includes(idx)}
                                previewData={previewData}
                                canvasWidth={canvasSize.width}
                                onDragStop={handleDragStop}
                                onSelect={(e) => handleSelect(idx, e)}
                            />
                        )
                    ))}
                </div>
            </div>

            {/* Sidebar Controls */}
            <div className="w-[380px] bg-white border-l border-slate-200 overflow-y-auto p-6 flex flex-col gap-8 shadow-xl">
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-900">명찰 레이아웃 편집기</h2>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? '저장 중...' : '저장'}
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">캔버스 크기 (mm)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">가로 (mm)</label>
                                <MmInput valueMm={canvasSize.width} onChange={mm => mm !== undefined && setCanvasSize(p => ({ ...p, width: mm }))} className="w-full" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">세로 (mm)</label>
                                <MmInput valueMm={canvasSize.height} onChange={mm => mm !== undefined && setCanvasSize(p => ({ ...p, height: mm }))} className="w-full" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[240, 260, 280, 300, 320, 350].map((mm) => (
                                <Button
                                    key={mm}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[11px]"
                                    onClick={() => setCanvasSize({ width: DEFAULT_BADGE_WIDTH_MM, height: mm })}
                                >
                                    100×{mm}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">프린터 보정</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">해상도 (dpmm)</label>
                                <select
                                    value={printerDpmm}
                                    onChange={(e) => setPrinterDpmm(parseInt(e.target.value, 10))}
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                                >
                                    <option value={8}>203 DPI (8 dpmm)</option>
                                    <option value={12}>300 DPI (12 dpmm)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">용지 타입 (센서)</label>
                                <select
                                    value={mediaType}
                                    onChange={(e) => setMediaType(parseInt(e.target.value, 10))}
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                                >
                                    <option value={0}>Gap (라벨지)</option>
                                    <option value={1}>Continuous (연속용지)</option>
                                    <option value={2}>Black Mark (블랙마크)</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">라벨 간격 (mm)</label>
                                <MmInput valueMm={labelGapMm} onChange={mm => mm !== undefined && setLabelGapMm(mm)} step={0.1} className="w-full" />
                            </div>
                            <div />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">X 오프셋 (mm)</label>
                                <input
                                    type="number"
                                    step={0.1}
                                    value={printOffsetXmm}
                                    onChange={(e) => setPrintOffsetXmm(parseFloat(e.target.value || '0'))}
                                    className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 w-full"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">Y 오프셋 (mm)</label>
                                <input
                                    type="number"
                                    step={0.1}
                                    value={printOffsetYmm}
                                    onChange={(e) => setPrintOffsetYmm(parseFloat(e.target.value || '0'))}
                                    className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 w-full"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">시작점 보정 (mm)</label>
                                <input
                                    type="number"
                                    step={0.1}
                                    value={printStartOffsetMm}
                                    onChange={(e) => setPrintStartOffsetMm(parseFloat(e.target.value || '0'))}
                                    className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 w-full"
                                />
                            </div>
                            <div />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">하드웨어 마진 X (mm)</label>
                                <input
                                    type="number"
                                    step={0.1}
                                    value={marginXMm}
                                    onChange={(e) => setMarginXMm(parseFloat(e.target.value || '0'))}
                                    className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 w-full"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">하드웨어 마진 Y (mm)</label>
                                <input
                                    type="number"
                                    step={0.1}
                                    value={marginYMm}
                                    onChange={(e) => setMarginYMm(parseFloat(e.target.value || '0'))}
                                    className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 w-full"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <input
                                type="checkbox"
                                id="enableCutting"
                                checked={enableCutting}
                                onChange={e => setEnableCutting(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label htmlFor="enableCutting" className="text-[11px] font-medium text-slate-500">
                                인쇄 후 자동 커팅 활성화
                            </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 text-[11px]"
                                disabled={bixolonPrinting}
                                onClick={() => handleTestCut(0)}
                            >
                                커팅 테스트(0)
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 text-[11px]"
                                disabled={bixolonPrinting}
                                onClick={() => handleTestCut(1)}
                            >
                                커팅 테스트(1)
                            </Button>
                        </div>
                        <div className="mt-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 text-[11px] w-full"
                                disabled={bixolonPrinting}
                                onClick={handleResetPrinter}
                            >
                                프린터 리셋
                            </Button>
                        </div>
                    </div>

                    {/* 정렬 도구 추가 */}
                    {selectedIndices.length > 0 && (
                        <div className="space-y-4 pt-4 mt-4 border-t border-slate-100">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">정렬 도구 ({selectedIndices.length})</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 text-xs flex gap-2 items-center justify-center bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                    onClick={alignCenter}
                                >
                                    <Maximize className="w-4 h-4 rotate-90" />
                                    가로 중앙 정렬
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 text-xs flex gap-2 items-center justify-center"
                                    onClick={() => setSelectedIndices([])}
                                >
                                    선택 해제
                                </Button>
                            </div>
                            <p className="text-[10px] text-slate-400 text-center italic">Tip: Shift + 클릭으로 다중 선택</p>
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">배경 이미지</h3>
                        <ImageUpload
                            path={`conferences/${confId}/assets/badge_bg`}
                            onUploadComplete={(url) => setBgUrl(url)}
                            previewUrl={bgUrl}
                            label="배경 업로드"
                            className="w-full"
                        />
                        {bgUrl && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 h-8 text-xs"
                                onClick={() => setBgUrl(undefined)}
                            >
                                <Trash2 className="w-3 h-3 mr-1.5" /> 배경 삭제
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">요소 추가</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { type: 'NAME', label: '이름', desc: 'userName', icon: Plus },
                            { type: 'ORG', label: '소속', desc: 'affiliation', icon: Plus },
                            { type: 'CATEGORY', label: '등록구분', desc: 'userTier', icon: Plus },
                            { type: 'LICENSE', label: '면허번호', desc: 'licenseNumber', icon: Plus },
                            { type: 'AFFILIATION', label: '전문분야', desc: 'affiliation2', icon: Plus },
                            { type: 'PRICE', label: '금액', desc: 'amount', icon: Plus },
                            { type: 'QR', label: 'QR코드', desc: 'badgeQr', icon: Plus },
                            { type: 'IMAGE', label: '이미지', desc: '고정이미지', icon: ImageIcon },
                            { type: 'CUSTOM', label: '고정텍스트', desc: '직접입력', icon: Plus },
                        ].map(item => (
                            <Button
                                key={item.type}
                                variant="outline"
                                size="sm"
                                title={`데이터 필드: ${item.desc}`}
                                className="h-14 text-[10px] flex flex-col gap-0.5 px-1"
                                onClick={() => addElement(item.type as BadgeElement['type'])}
                            >
                                <item.icon className="w-3 h-3 shrink-0" />
                                <span className="font-semibold leading-none">{item.label}</span>
                                <span className="text-[8px] text-slate-400 leading-none">{item.desc}</span>
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="flex-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">속성 편집</h3>
                    {selectedIndices.length === 1 ? (
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-5">
                            {/* 헤더: 타입 + 삭제 */}
                            <div className="flex justify-between items-center">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold tracking-wider">{elements[selectedIndices[0]].type}</span>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-8 font-medium text-xs" onClick={() => {
                                    setElements(elements.filter((_, i) => i !== selectedIndices[0]));
                                    setSelectedIndices([]);
                                }}>
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> 삭제
                                </Button>
                            </div>

                            {/* 가운데 정렬 토글 - 텍스트 요소에만 표시 */}
                            {!['IMAGE'].includes(elements[selectedIndices[0]].type) && (
                                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                                    <div>
                                        <p className="text-[12px] font-semibold text-slate-700">가운데 정렬</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">인쇄 시 텍스트 너비를 계산해 자동 중앙 배치</p>
                                    </div>
                                    <button
                                        onClick={() => updateElement(selectedIndices[0], 'textAlign',
                                            elements[selectedIndices[0]].textAlign === 'center' ? 'left' : 'center'
                                        )}
                                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${elements[selectedIndices[0]].textAlign === 'center'
                                            ? 'bg-blue-500' : 'bg-slate-200'
                                            }`}
                                    >
                                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${elements[selectedIndices[0]].textAlign === 'center' ? 'translate-x-6' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>
                            )}

                            {/* Y 좌표, X 좌표 */}
                            <div className={`grid gap-4 ${(elements[selectedIndices[0]].textAlign === 'center' && !elements[selectedIndices[0]].maxWidth) ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {!(elements[selectedIndices[0]].textAlign === 'center' && !elements[selectedIndices[0]].maxWidth) && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-slate-500 ml-1">X 좌표 (mm)</label>
                                        <MmInput valueMm={elements[selectedIndices[0]].x} onChange={mm => mm !== undefined && updateElement(selectedIndices[0], 'x', mm)} className="w-full" />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 ml-1">Y 좌표 (mm)</label>
                                    <MmInput valueMm={elements[selectedIndices[0]].y} onChange={mm => mm !== undefined && updateElement(selectedIndices[0], 'y', mm)} className="w-full" />
                                </div>
                            </div>

                            {/* 크기 */}
                            {elements[selectedIndices[0]].type === 'IMAGE' ? (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-slate-500 ml-1">크기 (Width, mm)</label>
                                        <MmInput valueMm={elements[selectedIndices[0]].fontSize} onChange={mm => mm !== undefined && updateElement(selectedIndices[0], 'fontSize', mm)} placeholder="이미지 가로 크기" className="w-full" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-slate-500 ml-1">이미지 업로드</label>
                                        <ImageUpload path={`conferences/${confId}/assets/badge`} onUploadComplete={(url) => updateElement(selectedIndices[0], 'content', url)} previewUrl={elements[selectedIndices[0]].content} label="" className="mt-1" />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 ml-1">
                                        {elements[selectedIndices[0]].type === 'QR' ? 'QR 크기 (mm)' : '글자 크기 (mm)'}
                                    </label>
                                    <MmInput valueMm={elements[selectedIndices[0]].fontSize} onChange={mm => mm !== undefined && updateElement(selectedIndices[0], 'fontSize', mm)} className="w-full" />
                                </div>
                            )}

                            {/* 고정 텍스트 내용 */}
                            {elements[selectedIndices[0]].type === 'CUSTOM' && (
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 ml-1">내용</label>
                                    <input type="text" value={elements[selectedIndices[0]].content || ''} onChange={e => updateElement(selectedIndices[0], 'content', e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none" />
                                </div>
                            )}

                            {/* 최대 너비 (영역 지정) */}
                            {!['QR', 'IMAGE'].includes(elements[selectedIndices[0]].type) && (
                                <div className="pt-4 border-t border-slate-100 space-y-3">
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">영역 지정 (최대 너비)</p>
                                    <div className="flex gap-2 items-center">
                                        <MmInput
                                            valueMm={elements[selectedIndices[0]].maxWidth}
                                            onChange={mm => updateElement(selectedIndices[0], 'maxWidth', mm)}
                                            placeholder="제한 없음 (mm)"
                                            allowEmpty
                                            className="flex-1 border-amber-200 bg-amber-50/30"
                                        />
                                        {elements[selectedIndices[0]].maxWidth && (
                                            <button onClick={() => updateElement(selectedIndices[0], 'maxWidth', undefined)}
                                                className="text-[10px] text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-50 whitespace-nowrap">해제</button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        {elements[selectedIndices[0]].maxWidth
                                            ? `✅ ${elements[selectedIndices[0]].maxWidth!}mm 가로 크기에 도달하면, 폰트 크기 유지한 채로 아래로 줄을 내립니다.`
                                            : '텍스트 박스의 크기를 지정합니다. 너비를 초과하면 자동 줄바꿈되며 중앙정렬 됩니다.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : selectedIndices.length > 1 ? (
                        <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-blue-50/20">
                            <Maximize className="w-8 h-8 text-blue-300 mb-2" />
                        </div>
                    ) : (
                        <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                            <Maximize className="w-8 h-8 text-slate-200 mb-2" />
                            <p className="text-xs text-slate-400 font-medium">편집할 요소를 선택하세요</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface DraggableNodeProps {
    el: BadgeElement;
    idx: number;
    isSelected: boolean;
    previewData: Record<string, string>;
    canvasWidth: number;
    onDragStop: (idx: number, e: unknown, data: { x: number; y: number }) => void;
    onSelect: (e: React.MouseEvent) => void;
}

const DraggableNode: React.FC<DraggableNodeProps> = ({ el, idx, isSelected, previewData, canvasWidth, onDragStop, onSelect }) => {
    const nodeRef = useRef<HTMLDivElement>(null);
    const isCentered = el.textAlign === 'center';
    // 캔버스 전체 기준 중앙정렬인지 여부 (maxWidth가 없고, textAlign이 center일 때)
    const isCanvasCentered = isCentered && !el.maxWidth;
    // 텍스트 박스 너비: maxWidth가 있으면 해당 영역 우선, 그냥 가운데 정렬이면 캔버스 전체 비율 사용
    const boxWidth = el.maxWidth ? el.maxWidth : (isCentered ? canvasWidth : undefined);
    // 표시 위치 (캔버스 중앙이면 X 드래그 불가 = 0 위치 고정)
    const posX = isCanvasCentered ? 0 : el.x;

    const renderContent = () => {
        if (el.type === 'QR') {
            return (
                <div style={{ width: toPx(el.fontSize), height: toPx(el.fontSize) }} className="bg-black flex items-center justify-center text-white text-[10px]">
                    QR CODE
                </div>
            );
        }
        if (el.type === 'IMAGE') {
            return (
                <div style={{ width: toPx(el.fontSize) }}>
                    {el.content ? (
                        <img src={el.content} alt="badge-asset" className="w-full h-auto object-contain pointer-events-none" />
                    ) : (
                        <div className="w-full aspect-square bg-slate-100 flex items-center justify-center text-slate-400 text-[10px] border border-slate-200">
                            No Image
                        </div>
                    )}
                </div>
            );
        }
        const displayText = previewData[el.type as keyof typeof previewData] || el.content || el.type;

        return (
            <div
                style={{
                    fontSize: toPx(el.fontSize),
                    lineHeight: 1.35,
                    whiteSpace: el.maxWidth ? 'normal' : 'nowrap',
                    wordBreak: el.maxWidth ? 'keep-all' : 'normal',
                }}
                className="font-bold flex flex-col items-center"
            >
                {displayText}
            </div>
        );
    };

    return (
        <Draggable
            nodeRef={nodeRef}
            position={{ x: toPx(posX), y: toPx(el.y) }}
            axis={isCanvasCentered ? 'y' : 'both'}
            onStop={(e, data) => onDragStop(idx, e, data)}
            onStart={(e) => onSelect(e as React.MouseEvent)}
            bounds="parent"
        >
            <div
                ref={nodeRef}
                id={`badge-el-${idx}`}
                className={`absolute cursor-move select-none transition-shadow ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/20 z-10 shadow-lg' : 'hover:ring-1 hover:ring-slate-300'}`}
                style={{
                    left: 0,
                    top: 0,
                    ...(boxWidth ? { width: toPx(boxWidth), textAlign: isCentered ? 'center' : 'left' } : {}),
                    ...(el.maxWidth ? { border: '1px dashed rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(254, 252, 232, 0.3)' } : {})
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(e);
                }}
            >
                {renderContent()}
            </div>
        </Draggable>
    );
};

export default BadgeEditorPage;
