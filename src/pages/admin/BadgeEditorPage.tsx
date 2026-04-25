import React, { useEffect } from 'react';
import { useConference } from '../../hooks/useConference';
import { useAdmin } from '../../hooks/useAdmin';
import { BadgeElement } from '../../types/schema';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import ImageUpload from '../../components/ui/ImageUpload';
import { ImageIcon, Trash2, Save, Maximize, Plus } from 'lucide-react';
import { MmInput } from '../../components/badge/MmInput';
import BadgePropertyPanel from '../../components/badge/BadgePropertyPanel';
import BadgeCanvas from '../../components/badge/BadgeCanvas';
import { 
    useBadgeEditor, 
    toMm, 
    DEFAULT_BADGE_WIDTH_MM, 
    DEFAULT_BADGE_HEIGHT_MM 
} from '../../hooks/badge/useBadgeEditor';

const previewData = {
    NAME: '홍길동',
    ORG: '서울대학교병원',
    QR: 'QR_CODE_PLACEHOLDER',
    CATEGORY: '정회원',
    LICENSE: '12-345678',
    PRICE: '50,000원',
    AFFILIATION: '전문의',
    POSITION: '과장'
};

const BadgeEditorPage: React.FC = () => {
    const { id: confId, info, loading: confLoading } = useConference();
    const { saveBadgeLayout, loading: saving } = useAdmin(confId || '');

    const {
        elements,
        setElements,
        canvasSize,
        setCanvasSize,
        selectedIndices,
        setSelectedIndices,
        bgUrl,
        setBgUrl,
        printerDpmm, setPrinterDpmm,
        printerFont, setPrinterFont,
        printOffsetXmm, setPrintOffsetXmm,
        printOffsetYmm, setPrintOffsetYmm,
        printStartOffsetMm, setPrintStartOffsetMm,
        enableCutting, setEnableCutting,
        mediaType, setMediaType,
        labelGapMm, setLabelGapMm,
        cutFeedMm, setCutFeedMm,
        marginXMm, setMarginXMm,
        marginYMm, setMarginYMm,
        prevBadgeLayoutRef,
        handleDragStop,
        updateElement,
        addElement,
        removeElement,
        selectElement
    } = useBadgeEditor();

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
                cutFeedMm?: number;
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
                        width: toMm(layout.width || 377.95), // 100mm in px
                        height: toMm(layout.height || 907.08), // 240mm in px
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
                const layoutRecord = layout as Record<string, unknown>;
                setPrinterFont((layoutRecord as Record<string, unknown>).printerFont as string || 'Malgun Gothic');
                setPrintOffsetXmm(layout.printOffsetXmm || 0);
                setPrintOffsetYmm(layout.printOffsetYmm || 0);
                setPrintStartOffsetMm(layout.printStartOffsetMm || 0);
                setEnableCutting(layout.enableCutting ?? true);
                setMediaType(layout.mediaType || 0);
                const nextMediaType = layout.mediaType || 0;
                const nextGap = layout.labelGapMm;
                setLabelGapMm(
                    nextMediaType === 1 ? 0 : (nextGap && nextGap > 0 ? nextGap : 3)
                );
                setCutFeedMm(layout.cutFeedMm ?? 0);
                setMarginXMm(layout.marginXMm || 0);
                setMarginYMm(layout.marginYMm || 0);
            }, 0);
            prevBadgeLayoutRef.current = info.badgeLayout;
        }
    }, [info, prevBadgeLayoutRef, setBgUrl, setCanvasSize, setCutFeedMm, setElements, setEnableCutting, setLabelGapMm, setMarginXMm, setMarginYMm, setMediaType, setPrintOffsetXmm, setPrintOffsetYmm, setPrintStartOffsetMm, setPrinterDpmm, setPrinterFont]);

    const handleSave = async () => {
        try {
            const effectiveLabelGapMm = mediaType === 1 ? 0 : (labelGapMm > 0 ? labelGapMm : 3);
            const extraSettingsToSave = {
                printerFont,
                printerDpmm,
                printOffsetXmm,
                printOffsetYmm,
                printStartOffsetMm,
                enableCutting,
                mediaType,
                labelGapMm: effectiveLabelGapMm,
                cutFeedMm,
                marginXMm,
                marginYMm,
                unit: 'mm'
            };
            await saveBadgeLayout(canvasSize.width, canvasSize.height, elements, bgUrl, {
                ...extraSettingsToSave
            });
            toast.success('명찰 레이아웃이 저장되었습니다! ✅');
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : String(e);
            if (message.includes('permission-denied') || message.includes('Missing or insufficient permissions')) {
                toast.error('저장 권한이 없습니다. 세션이 만료되었을 수 있습니다. 다시 로그인해주세요.', { duration: 5000 });
                setTimeout(() => {
                    const params = new URLSearchParams(window.location.search);
                    const society = params.get('society') || sessionStorage.getItem('societyId') || '';
                    window.location.href = society ? `/admin/login?society=${society}` : '/admin/login';
                }, 3000);
            } else {
                toast.error(`저장 실패: ${message || '알 수 없는 오류'}`);
            }
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
                <BadgeCanvas
                    canvasSize={canvasSize}
                    bgUrl={bgUrl}
                    elements={elements}
                    selectedIndices={selectedIndices}
                    previewData={previewData}
                    onDragStop={handleDragStop}
                    onSelect={selectElement}
                />
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
                                <label className="text-[11px] font-medium text-slate-500 ml-1">프린터 폰트</label>
                                <input
                                    type="text"
                                    value={printerFont}
                                    onChange={(e) => setPrinterFont(e.target.value)}
                                    className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 w-full"
                                    placeholder="예: Malgun Gothic"
                                />
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
                                <label className="text-[11px] font-medium text-slate-500 ml-1">갭/마크 길이 (mm)</label>
                                <MmInput
                                    valueMm={mediaType === 1 ? 0 : labelGapMm}
                                    onChange={mm => {
                                        if (mediaType === 1) return;
                                        if (mm !== undefined) setLabelGapMm(mm);
                                    }}
                                    step={0.1}
                                    className="w-full"
                                    disabled={mediaType === 1}
                                />
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
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">커팅 여유 (mm)</label>
                                <input
                                    type="number"
                                    step={0.1}
                                    value={cutFeedMm}
                                    onChange={(e) => setCutFeedMm(parseFloat(e.target.value || '0'))}
                                    className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 w-full"
                                />
                            </div>
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
                            { type: 'POSITION', label: '직급', desc: 'position', icon: Plus },
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
                    <BadgePropertyPanel
                        confId={confId || ''}
                        elements={elements}
                        selectedIndices={selectedIndices}
                        onUpdate={updateElement}
                        onRemove={removeElement}
                    />
                </div>
            </div>
        </div>
    );
};

export default BadgeEditorPage;