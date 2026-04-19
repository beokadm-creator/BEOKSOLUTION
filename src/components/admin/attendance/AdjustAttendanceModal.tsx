import React from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface AdjustAttendanceModalProps {
    show: boolean;
    onClose: () => void;
    reg: any;
    zones: any[];
    adjustMode: 'ADJUST_MINUTES' | 'CHECKIN' | 'CHECKOUT';
    setAdjustMode: (mode: 'ADJUST_MINUTES' | 'CHECKIN' | 'CHECKOUT') => void;
    adjustZoneId: string;
    setAdjustZoneId: (val: string) => void;
    adjustCheckInTime: string;
    setAdjustCheckInTime: (val: string) => void;
    adjustCheckOutTime: string;
    setAdjustCheckOutTime: (val: string) => void;
    adjustRecognizedMinutes: string;
    setAdjustRecognizedMinutes: (val: string) => void;
    adjustTodayMinutes: string;
    setAdjustTodayMinutes: (val: string) => void;
    applyAdjust: () => void;
}

export const AdjustAttendanceModal: React.FC<AdjustAttendanceModalProps> = ({
    show, onClose, reg, zones,
    adjustMode, setAdjustMode,
    adjustZoneId, setAdjustZoneId,
    adjustCheckInTime, setAdjustCheckInTime,
    adjustCheckOutTime, setAdjustCheckOutTime,
    adjustRecognizedMinutes, setAdjustRecognizedMinutes,
    adjustTodayMinutes, setAdjustTodayMinutes,
    applyAdjust
}) => {
    if (!show || !reg) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="font-bold text-lg text-slate-900">{reg.userName}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">{reg.userEmail}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-200/50">
                        <X className="w-5 h-5 text-slate-500" />
                    </Button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="flex gap-2">
                        {(['ADJUST_MINUTES', 'CHECKIN', 'CHECKOUT'] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setAdjustMode(m)}
                                className={cn(
                                    "flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-colors",
                                    adjustMode === m ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                )}
                            >
                                {m === 'ADJUST_MINUTES' ? '인정시간' : m === 'CHECKIN' ? '수기 입장' : '수기 퇴장'}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <div className="text-xs font-bold text-slate-500 mb-1">Zone</div>
                            <select
                                value={adjustZoneId}
                                onChange={(e) => setAdjustZoneId(e.target.value)}
                                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                            >
                                {zones.map((z) => (
                                    <option key={z.id} value={z.id}>{z.name}</option>
                                ))}
                            </select>
                        </div>

                        {adjustMode === 'CHECKIN' && (
                            <div className="col-span-2">
                                <div className="text-xs font-bold text-slate-500 mb-1">입장 시간 (HH:MM)</div>
                                <Input value={adjustCheckInTime} onChange={(e) => setAdjustCheckInTime(e.target.value)} placeholder="예: 09:00" className="h-10" />
                            </div>
                        )}

                        {adjustMode === 'CHECKOUT' && (
                            <>
                                <div className="col-span-2">
                                    <div className="text-xs font-bold text-slate-500 mb-1">퇴장 시간 (HH:MM)</div>
                                    <Input value={adjustCheckOutTime} onChange={(e) => setAdjustCheckOutTime(e.target.value)} placeholder="예: 18:00" className="h-10" />
                                </div>
                                <div className="col-span-2">
                                    <div className="text-xs font-bold text-slate-500 mb-1">인정시간 직접 입력 (선택)</div>
                                    <Input value={adjustRecognizedMinutes} onChange={(e) => setAdjustRecognizedMinutes(e.target.value)} placeholder="비우면 자동 계산" className="h-10" />
                                </div>
                            </>
                        )}

                        {adjustMode === 'ADJUST_MINUTES' && (
                            <div className="col-span-2">
                                <div className="text-xs font-bold text-slate-500 mb-1">오늘 인정시간(분) (선택한 날짜 기준)</div>
                                <Input value={adjustTodayMinutes} onChange={(e) => setAdjustTodayMinutes(e.target.value)} placeholder="예: 240" className="h-10" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>취소</Button>
                    <Button onClick={applyAdjust}>적용</Button>
                </div>
            </div>
        </div>
    );
};
