import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { useConference } from '../../hooks/useConference';
import { useAdmin } from '../../hooks/useAdmin';
import { BadgeElement } from '../../types/schema';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import ImageUpload from '../../components/ui/ImageUpload';
import { ImageIcon, Trash2, Save, Maximize, Plus } from 'lucide-react';

const PX_PER_MM = 3.779527;
const toMm = (px: number) => (px / PX_PER_MM).toFixed(1);
const toPx = (mm: string | number) => Math.round(Number(mm) * PX_PER_MM);

const BadgeEditorPage: React.FC = () => {
    const { id: confId, info, loading: confLoading } = useConference();
    const { saveBadgeLayout, loading: saving } = useAdmin(confId || '');

    const [elements, setElements] = useState<BadgeElement[]>([]);
    const [canvasSize, setCanvasSize] = useState({ width: 400, height: 600 });
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [bgUrl, setBgUrl] = useState<string | undefined>(undefined);

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
        if (info?.badgeLayout) {

            setElements(info.badgeLayout.elements || []);
            setCanvasSize({
                width: info.badgeLayout.width || 400,
                height: info.badgeLayout.height || 600
            });
            setBgUrl(info.badgeLayout.backgroundImageUrl);
        }
    }, [info]);

    const handleDragStop = (idx: number, e: unknown, data: { x: number, y: number }) => {
        const newEls = [...elements];
        newEls[idx] = { ...newEls[idx], x: Math.round(data.x), y: Math.round(data.y) };
        setElements(newEls);
        setSelectedIdx(idx);
    };

    const updateElement = (idx: number, field: keyof BadgeElement, value: unknown) => {
        const newEls = [...elements];
        newEls[idx] = { ...newEls[idx], [field]: value };
        setElements(newEls);
    };

    const handleSave = async () => {
        try {
            await saveBadgeLayout(canvasSize.width, canvasSize.height, elements, bgUrl);
            toast.success('명찰 레이아웃이 저장되었습니다! ✅');
        } catch (e) {
            console.error(e);
            const err = e as { code?: string; message?: string };
            if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
                toast.error('저장 권한이 없습니다. 세션이 만료되었을 수 있습니다. 다시 로그인해주세요.', { duration: 5000 });
                // 3초 후 로그인 페이지로 이동
                setTimeout(() => {
                    const params = new URLSearchParams(window.location.search);
                    const society = params.get('society') || sessionStorage.getItem('societyId') || '';
                    window.location.href = society ? `/admin/login?society=${society}` : '/admin/login';
                }, 3000);
            } else {
                toast.error(`저장 실패: ${err?.message || '알 수 없는 오류'}`);
            }
        }
    };

    const addElement = (type: BadgeElement['type']) => {
        const newElement: BadgeElement = {
            x: 50,
            y: 50,
            fontSize: type === 'QR' ? 80 : 24,
            isVisible: true,
            type,
            content: type === 'CUSTOM' ? 'New Text' : undefined
        };
        setElements([...elements, newElement]);
        setSelectedIdx(elements.length);
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
                    style={{ width: canvasSize.width, height: canvasSize.height }}
                    onClick={() => setSelectedIdx(null)}
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
                        style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '20px 20px' }}
                    />

                    {elements.map((el, idx) => (
                        el.isVisible && (
                            <DraggableNode
                                key={idx}
                                el={el}
                                idx={idx}
                                isSelected={selectedIdx === idx}
                                previewData={previewData}
                                onDragStop={handleDragStop}
                                onSelect={() => setSelectedIdx(idx)}
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
                                <input
                                    type="number"
                                    step="0.1"
                                    value={toMm(canvasSize.width)}
                                    onChange={e => setCanvasSize({ ...canvasSize, width: toPx(e.target.value) })}
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 ml-1">세로 (mm)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={toMm(canvasSize.height)}
                                    onChange={e => setCanvasSize({ ...canvasSize, height: toPx(e.target.value) })}
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

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
                    {selectedIdx !== null ? (
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-6">
                            <div className="flex justify-between items-center">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold tracking-wider">{elements[selectedIdx].type}</span>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-8 font-medium text-xs" onClick={() => {
                                    setElements(elements.filter((_, i) => i !== selectedIdx));
                                    setSelectedIdx(null);
                                }}>
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> 삭제
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 ml-1">X 좌표 (mm)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={toMm(elements[selectedIdx].x)}
                                        onChange={e => updateElement(selectedIdx, 'x', toPx(e.target.value))}
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 ml-1">Y 좌표 (mm)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={toMm(elements[selectedIdx].y)}
                                        onChange={e => updateElement(selectedIdx, 'y', toPx(e.target.value))}
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            {elements[selectedIdx].type === 'IMAGE' ? (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-slate-500 ml-1">크기 (Width, mm)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={toMm(elements[selectedIdx].fontSize)}
                                            onChange={e => updateElement(selectedIdx, 'fontSize', toPx(e.target.value))}
                                            className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none"
                                            placeholder="이미지 가로 크기"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-slate-500 ml-1">이미지 업로드</label>
                                        <ImageUpload
                                            path={`conferences/${confId}/assets/badge`}
                                            onUploadComplete={(url) => updateElement(selectedIdx, 'content', url)}
                                            previewUrl={elements[selectedIdx].content}
                                            label=""
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 ml-1">
                                        {elements[selectedIdx].type === 'QR' ? 'QR 크기 (mm)' : '글자 크기 (mm)'}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={toMm(elements[selectedIdx].fontSize)}
                                        onChange={e => updateElement(selectedIdx, 'fontSize', toPx(e.target.value))}
                                        className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none"
                                    />
                                </div>
                            )}

                            {elements[selectedIdx].type === 'CUSTOM' && (
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 ml-1">내용</label>
                                    <input type="text" value={elements[selectedIdx].content || ''} onChange={e => updateElement(selectedIdx, 'content', e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none" />
                                </div>
                            )}
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
    onDragStop: (idx: number, e: unknown, data: { x: number; y: number }) => void;
    onSelect: (idx: number) => void;
}

const DraggableNode: React.FC<DraggableNodeProps> = ({ el, idx, isSelected, previewData, onDragStop, onSelect }) => {
    const nodeRef = useRef<HTMLDivElement>(null);

    const renderContent = () => {
        if (el.type === 'QR') {
            return (
                <div style={{ width: el.fontSize, height: el.fontSize }} className="bg-black flex items-center justify-center text-white text-[10px]">
                    QR CODE
                </div>
            );
        }
        if (el.type === 'IMAGE') {
            return (
                <div style={{ width: el.fontSize }}>
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
        return (
            <div style={{ fontSize: el.fontSize }} className="font-bold whitespace-nowrap px-1">
                {previewData[el.type as keyof typeof previewData] || el.content || el.type}
            </div>
        );
    };

    return (
        <Draggable
            nodeRef={nodeRef}
            position={{ x: el.x, y: el.y }}
            onStop={(e, data) => onDragStop(idx, e, data)}
            onStart={() => onSelect(idx)}
            bounds="parent"
        >
            <div
                ref={nodeRef}
                className={`absolute cursor-move select-none transition-shadow ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/20 z-10 shadow-lg' : 'hover:ring-1 hover:ring-slate-300'}`}
                style={{ left: 0, top: 0 }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(idx);
                }}
            >
                {renderContent()}
            </div>
        </Draggable>
    );
};

export default BadgeEditorPage;

