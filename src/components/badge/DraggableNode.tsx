import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import { BadgeElement } from '../../types/schema';
import { toPx, toMm } from '../../hooks/badge/useBadgeEditor';

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
    const boxWidth = el.maxWidth ? el.maxWidth : (isCentered ? toMm(canvasWidth) : undefined);
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
                className={`absolute cursor-move group ${isSelected ? 'ring-2 ring-blue-500 z-10 bg-blue-50/10 rounded border-dashed border border-blue-400' : 'hover:ring-1 hover:ring-slate-300'}`}
                style={{
                    width: boxWidth ? toPx(boxWidth) : undefined,
                    opacity: el.isVisible ? 1 : 0.3
                }}
            >
                {renderContent()}
                {isSelected && (
                    <div className="absolute -top-6 -left-2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap">
                        X:{posX.toFixed(1)} Y:{el.y.toFixed(1)} (mm)
                    </div>
                )}
            </div>
        </Draggable>
    );
};

export default DraggableNode;