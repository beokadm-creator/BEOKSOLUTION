import React from 'react';
import { BadgeElement } from '../../types/schema';
import DraggableNode from './DraggableNode';
import { toPx } from '../../hooks/badge/useBadgeEditor';

interface BadgeCanvasProps {
    canvasSize: { width: number, height: number };
    bgUrl?: string;
    elements: BadgeElement[];
    selectedIndices: number[];
    previewData: Record<string, string>;
    onDragStop: (idx: number, e: unknown, data: { x: number; y: number }) => void;
    onSelect: (idx: number, multi: boolean) => void;
}

const BadgeCanvas: React.FC<BadgeCanvasProps> = ({ 
    canvasSize, 
    bgUrl, 
    elements, 
    selectedIndices, 
    previewData, 
    onDragStop, 
    onSelect 
}) => {
    return (
        <div className="bg-slate-100/50 p-12 rounded-3xl flex items-center justify-center min-h-[600px] border border-slate-200">
            <div
                className="relative bg-white shadow-xl overflow-hidden ring-1 ring-slate-200"
                style={{
                    width: toPx(canvasSize.width),
                    height: toPx(canvasSize.height),
                }}
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        onSelect(-1, false);
                    }
                }}
            >
                {bgUrl && (
                    <img
                        src={bgUrl}
                        alt="bg"
                        className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none select-none"
                    />
                )}

                {elements.map((el, idx) => (
                    <DraggableNode
                        key={idx}
                        el={el}
                        idx={idx}
                        isSelected={selectedIndices.includes(idx)}
                        previewData={previewData}
                        canvasWidth={toPx(canvasSize.width)}
                        onDragStop={onDragStop}
                        onSelect={(e) => {
                            e.stopPropagation();
                            onSelect(idx, e.metaKey || e.ctrlKey);
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default BadgeCanvas;