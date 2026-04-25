import React from 'react';
import { BadgeElement } from '../../types/schema';
import { Button } from '../ui/button';
import ImageUpload from '../ui/ImageUpload';
import { MmInput } from './MmInput';
import { Trash2, Maximize } from 'lucide-react';

interface BadgePropertyPanelProps {
    confId: string;
    elements: BadgeElement[];
    selectedIndices: number[];
    onUpdate: (idx: number, field: keyof BadgeElement, value: unknown) => void;
    onRemove: (idx: number) => void;
}

const BadgePropertyPanel: React.FC<BadgePropertyPanelProps> = ({
    confId,
    elements,
    selectedIndices,
    onUpdate,
    onRemove
}) => {
    if (selectedIndices.length === 0) {
        return (
            <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                <Maximize className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-xs text-slate-400 font-medium">편집할 요소를 선택하세요</p>
            </div>
        );
    }

    if (selectedIndices.length > 1) {
        return (
            <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-blue-50/20">
                <Maximize className="w-8 h-8 text-blue-300 mb-2" />
            </div>
        );
    }

    const idx = selectedIndices[0];
    const el = elements[idx];

    return (
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-5">
            {/* 헤더: 타입 + 삭제 */}
            <div className="flex justify-between items-center">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold tracking-wider">
                    {el.type}
                </span>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 hover:bg-red-50 h-8 font-medium text-xs" 
                    onClick={() => onRemove(idx)}
                >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> 삭제
                </Button>
            </div>

            {/* 가운데 정렬 토글 - 텍스트 요소에만 표시 */}
            {!['IMAGE'].includes(el.type) && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                    <div>
                        <p className="text-[12px] font-semibold text-slate-700">가운데 정렬</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">인쇄 시 텍스트 너비를 계산해 자동 중앙 배치</p>
                    </div>
                    <button
                        onClick={() => onUpdate(idx, 'textAlign', el.textAlign === 'center' ? 'left' : 'center')}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                            el.textAlign === 'center' ? 'bg-blue-500' : 'bg-slate-200'
                        }`}
                    >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                            el.textAlign === 'center' ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                </div>
            )}

            {/* Y 좌표, X 좌표 */}
            <div className={`grid gap-4 ${(el.textAlign === 'center' && !el.maxWidth) ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {!(el.textAlign === 'center' && !el.maxWidth) && (
                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 ml-1">X 좌표 (mm)</label>
                        <MmInput 
                            valueMm={el.x} 
                            onChange={mm => mm !== undefined && onUpdate(idx, 'x', mm)} 
                            className="w-full" 
                        />
                    </div>
                )}
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500 ml-1">Y 좌표 (mm)</label>
                    <MmInput 
                        valueMm={el.y} 
                        onChange={mm => mm !== undefined && onUpdate(idx, 'y', mm)} 
                        className="w-full" 
                    />
                </div>
            </div>

            {/* 크기 */}
            {el.type === 'IMAGE' ? (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 ml-1">크기 (Width, mm)</label>
                        <MmInput 
                            valueMm={el.fontSize} 
                            onChange={mm => mm !== undefined && onUpdate(idx, 'fontSize', mm)} 
                            placeholder="이미지 가로 크기" 
                            className="w-full" 
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 ml-1">이미지 업로드</label>
                        <ImageUpload 
                            path={`conferences/${confId}/assets/badge`} 
                            onUploadComplete={(url) => onUpdate(idx, 'content', url)} 
                            previewUrl={el.content} 
                            label="" 
                            className="mt-1" 
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500 ml-1">
                        {el.type === 'QR' ? 'QR 크기 (mm)' : '글자 크기 (mm)'}
                    </label>
                    <MmInput 
                        valueMm={el.fontSize} 
                        onChange={mm => mm !== undefined && onUpdate(idx, 'fontSize', mm)} 
                        className="w-full" 
                    />
                </div>
            )}

            {/* 고정 텍스트 내용 */}
            {el.type === 'CUSTOM' && (
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-500 ml-1">내용</label>
                    <input 
                        type="text" 
                        value={el.content || ''} 
                        onChange={e => onUpdate(idx, 'content', e.target.value)} 
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none" 
                    />
                </div>
            )}

            {/* 자동 줄바꿈 기능 (QR, IMAGE 제외) */}
            {!['QR', 'IMAGE'].includes(el.type) && (
                <div className="space-y-2 mt-4 pt-4 border-t border-slate-200/60">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-slate-500 ml-1 flex items-center gap-1.5">
                            최대 너비 (자동 줄바꿈)
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <MmInput 
                            valueMm={el.maxWidth} 
                            onChange={mm => onUpdate(idx, 'maxWidth', mm)}
                            placeholder="제한 없음 (mm)"
                            allowEmpty
                            className="flex-1 border-amber-200 bg-amber-50/30"
                        />
                        {el.maxWidth && (
                            <button 
                                onClick={() => onUpdate(idx, 'maxWidth', undefined)}
                                className="text-[10px] text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-50 whitespace-nowrap"
                            >
                                해제
                            </button>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                        {el.maxWidth
                            ? `✅ ${el.maxWidth}mm 가로 크기에 도달하면, 폰트 크기 유지한 채로 아래로 줄을 내립니다.`
                            : '텍스트 박스의 크기를 지정합니다. 너비를 초과하면 자동 줄바꿈되며 중앙정렬 됩니다.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default BadgePropertyPanel;