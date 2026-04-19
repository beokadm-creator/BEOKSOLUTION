import React from 'react';
import { Button } from '../../ui/button';
import { X, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface AttendanceLogModalProps {
    show: boolean;
    onClose: () => void;
    reg: any;
    logs: any[];
    zones: any[];
}

export const AttendanceLogModal: React.FC<AttendanceLogModalProps> = ({ show, onClose, reg, logs, zones }) => {
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

                <div className="p-0 overflow-y-auto flex-1 bg-white">
                    {logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                            <Clock className="w-10 h-10 opacity-20" />
                            <p className="text-sm">출결 기록이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="relative p-6 space-y-8">
                            <div className="absolute left-[29px] top-6 bottom-6 w-0.5 bg-slate-100" />

                            {logs.map((log) => (
                                <div key={log.id} className="relative flex gap-5 group">
                                    <div className={cn(
                                        "relative z-10 w-2.5 h-2.5 rounded-full mt-1.5 ring-4 ring-white flex-shrink-0",
                                        log.type === 'ENTER' ? "bg-blue-500" : "bg-slate-400"
                                    )} />

                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className={cn(
                                                    "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border mb-1 inline-block",
                                                    log.type === 'ENTER' ? "bg-blue-50 text-blue-600 border-blue-100" : log.type === 'EXIT' ? "bg-slate-50 text-slate-500 border-slate-100" : "bg-amber-50 text-amber-700 border-amber-100"
                                                )}>
                                                    {log.type}
                                                </span>
                                                <div className="font-semibold text-slate-800 text-sm mt-0.5">
                                                    {zones.find(z => z.id === log.zoneId)?.name || log.zoneId || 'Unknown Zone'}
                                                </div>
                                                {log.method && (
                                                    <div className="text-[10px] text-slate-400 font-mono mt-1">{log.method}</div>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-400 font-mono">
                                                {log.timestamp?.toDate().toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        {(log.type === 'EXIT' || log.type === 'ADJUST') && (
                                            <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs space-y-2">
                                                {typeof log.rawDuration === 'number' && (
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>체류 시간 (Raw)</span>
                                                        <span className="font-mono">{log.rawDuration}분</span>
                                                    </div>
                                                )}
                                                {typeof log.deduction === 'number' && (
                                                    <div className="flex justify-between text-red-400">
                                                        <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> 휴게 차감</span>
                                                        <span className="font-mono">-{log.deduction}분</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold text-blue-600 text-sm">
                                                    <span>{log.type === 'ADJUST' ? '조정' : '최종 인정'}</span>
                                                    <span className="font-mono text-base">{log.recognizedMinutes ?? 0}m</span>
                                                </div>
                                                {typeof log.accumulatedTotal === 'number' && (
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>누적</span>
                                                        <span className="font-mono">{log.accumulatedTotal}m</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
