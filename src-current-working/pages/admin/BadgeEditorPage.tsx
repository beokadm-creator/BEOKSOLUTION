import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { useConference } from '../../hooks/useConference';
import { useAdmin } from '../../hooks/useAdmin';
import { BadgeElement } from '../../types/schema';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/button';

const BadgeEditorPage: React.FC = () => {
    const { id: confId, info, loading: confLoading } = useConference();
    const { saveBadgeLayout, loading: saving, error: saveError } = useAdmin();

    const [elements, setElements] = useState<BadgeElement[]>([]);
    const [canvasSize, setCanvasSize] = useState({ width: 400, height: 600 });
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    const previewData = {
        NAME: 'Hong Gildong',
        ORG: 'Korea University',
        QR: 'QR_CODE_PLACEHOLDER',
        CATEGORY: 'Regular',
        LICENSE: '12345'
    };

    useEffect(() => {
        if (info?.badgeLayout) {
            setElements(info.badgeLayout.elements);
            setCanvasSize({ width: info.badgeLayout.width, height: info.badgeLayout.height });
        } else if (!confLoading) {
            setElements([
                { x: 50, y: 100, fontSize: 2, isVisible: true, type: 'NAME' },
                { x: 50, y: 150, fontSize: 2, isVisible: true, type: 'ORG' },
                { x: 100, y: 300, fontSize: 4, isVisible: true, type: 'QR' }
            ]);
        }
    }, [info, confLoading]);

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
            await saveBadgeLayout(canvasSize.width, canvasSize.height, elements);
            toast.success('Layout Saved!');
        } catch (e) {
            toast.error('Save failed');
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);

    if (confLoading) return <div>Loading...</div>;

    return (
        <div className="flex h-[calc(100vh-100px)] overflow-hidden">
            <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-auto p-10">
                <div
                    ref={containerRef}
                    className="relative bg-white shadow-xl border border-gray-300"
                    style={{ width: canvasSize.width, height: canvasSize.height }}
                    onClick={() => setSelectedIdx(null)}
                >
                    {elements.map((el, idx) => (
                        el.isVisible && (
                            <DraggableNode
                                key={idx}
                                el={el}
                                idx={idx}
                                selectedIdx={selectedIdx}
                                previewData={previewData}
                                handleDragStop={handleDragStop}
                                setSelectedIdx={setSelectedIdx}
                            />
                        )
                    ))}
                </div>
            </div>

            <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto p-6 flex flex-col gap-6">
                <div>
                    <h2 className="text-xl font-bold mb-4">Badge Editor</h2>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Canvas Size</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400">Width</label>
                            <input type="number" value={canvasSize.width} onChange={e => setCanvasSize({ ...canvasSize, width: Number(e.target.value) })} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">Height</label>
                            <input type="number" value={canvasSize.height} onChange={e => setCanvasSize({ ...canvasSize, height: Number(e.target.value) })} className="w-full border p-2 rounded" />
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Elements</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {['NAME', 'ORG', 'CATEGORY', 'LICENSE', 'PRICE', 'AFFILIATION', 'QR', 'CUSTOM'].map(type => (
                            <Button key={type} variant="outline" size="sm" className="text-[10px] h-7" onClick={() => {
                                setElements([...elements, { x: 0, y: 0, fontSize: type === 'QR' ? 4 : 2, isVisible: true, type: type as any, content: type === 'CUSTOM' ? 'New Text' : undefined }]);
                            }}>+ {type}</Button>
                        ))}
                    </div>

                    {selectedIdx !== null ? (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-[#003366]">{elements[selectedIdx].type}</span>
                                <Button variant="ghost" size="sm" className="text-red-500 h-6" onClick={() => {
                                    setElements(elements.filter((_, i) => i !== selectedIdx));
                                    setSelectedIdx(null);
                                }}>Delete</Button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-gray-400">X Position</label>
                                        <input type="number" value={elements[selectedIdx].x} onChange={e => updateElement(selectedIdx, 'x', Number(e.target.value))} className="w-full border p-1 rounded text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400">Y Position</label>
                                        <input type="number" value={elements[selectedIdx].y} onChange={e => updateElement(selectedIdx, 'y', Number(e.target.value))} className="w-full border p-1 rounded text-sm" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] text-gray-400">Size (SLCS Unit: 1-10)</label>
                                    <input type="number" value={elements[selectedIdx].fontSize} onChange={e => updateElement(selectedIdx, 'fontSize', Number(e.target.value))} className="w-full border p-1 rounded text-sm" />
                                </div>

                                {elements[selectedIdx].type === 'CUSTOM' && (
                                    <div>
                                        <label className="text-[10px] text-gray-400">Content</label>
                                        <input type="text" value={elements[selectedIdx].content || ''} onChange={e => updateElement(selectedIdx, 'content', e.target.value)} className="w-full border p-1 rounded text-sm" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 italic">Select an element to edit</p>
                    )}
                </div>

                <div className="mt-auto pt-6 border-t">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-[#003366] hover:bg-[#002244]"
                    >
                        {saving ? 'Saving...' : 'Save Layout'}
                    </Button>
                    {saveError && <p className="text-red-500 text-xs mt-2">{saveError}</p>}
                </div>
            </div>
        </div>
    );
};

interface DraggableNodeProps {
    el: BadgeElement;
    idx: number;
    selectedIdx: number | null;
    previewData: any;
    handleDragStop: (idx: number, e: any, data: any) => void;
    setSelectedIdx: (idx: number) => void;
}

const DraggableNode: React.FC<DraggableNodeProps> = ({ el, idx, selectedIdx, previewData, handleDragStop, setSelectedIdx }) => {
    const nodeRef = useRef(null);
    return (
        <Draggable
            nodeRef={nodeRef}
            position={{ x: el.x, y: el.y }}
            onStop={(e, data) => handleDragStop(idx, e, data)}
            onStart={() => setSelectedIdx(idx)}
            bounds="parent"
        >
            <div
                ref={nodeRef}
                className={`absolute cursor-move select-none whitespace-nowrap p-1 ${selectedIdx === idx ? 'ring-2 ring-blue-500 bg-blue-50/30' : 'border border-dashed border-gray-300'}`}
                style={{
                    fontSize: el.fontSize * 12, // Scale SLCS unit for preview
                    fontWeight: 'bold',
                    left: 0, top: 0 // Position is handled by Draggable transform
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIdx(idx);
                }}
            >
                {el.type === 'QR' ? (
                    <div style={{ width: el.fontSize * 20 || 80, height: el.fontSize * 20 || 80 }} className="bg-black flex items-center justify-center text-white text-[10px]">
                        QR
                    </div>
                ) : (
                    previewData[el.type as keyof typeof previewData] || el.content || el.type
                )}
            </div>
        </Draggable>
    );
};

export default BadgeEditorPage;
