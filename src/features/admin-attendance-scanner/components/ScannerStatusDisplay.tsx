import React from 'react';
import { Loader2, AlertCircle, CheckCircle, LogIn, MapPin } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ScannerState, ScannerMode, Zone } from '../types';

interface ScannerStatusDisplayProps {
    conferenceTitle: string;
    conferenceSubtitle: string;
    zones: Zone[];
    selectedZoneId: string;
    mode: ScannerMode;
    scannerState: ScannerState;
}

export const ScannerStatusDisplay: React.FC<ScannerStatusDisplayProps> = ({
    conferenceTitle,
    conferenceSubtitle,
    zones,
    selectedZoneId,
    mode,
    scannerState
}) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            <div className="mb-12 pointer-events-none">
                <h1 className="text-4xl font-black text-slate-900 mb-2">{conferenceTitle}</h1>
                <p className="text-slate-500 text-xl font-medium">{conferenceSubtitle}</p>
                <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 px-4 py-1 rounded-full text-slate-600 font-bold border border-slate-200">
                    <MapPin className="w-4 h-4" /> {zones.find(z => z.id === selectedZoneId)?.name}
                </div>
            </div>

            <div className={cn(
                "mb-10 px-8 py-3 rounded-full text-white font-black tracking-widest shadow-2xl animate-pulse", 
                mode === 'ENTER_ONLY' ? 'bg-blue-600' : mode === 'EXIT_ONLY' ? 'bg-red-600' : 'bg-purple-600'
            )}>
                {mode} MODE
            </div>

            <div className="w-full max-w-2xl bg-white rounded-[50px] shadow-[0_40px_80px_rgba(0,0,0,0.1)] border border-slate-50 p-16 flex flex-col items-center">
                <div className="mb-10 p-10 rounded-full bg-slate-50 shadow-inner">
                    {scannerState.status === 'IDLE' && <LogIn className="w-16 h-16 text-slate-200" />}
                    {scannerState.status === 'PROCESSING' && <Loader2 className="w-16 h-16 animate-spin text-blue-500" />}
                    {scannerState.status === 'SUCCESS' && <CheckCircle className="w-16 h-16 text-green-500 animate-in zoom-in duration-300" />}
                    {scannerState.status === 'ERROR' && <AlertCircle className="w-16 h-16 text-red-500 animate-in shake-in duration-300" />}
                </div>
                <h2 className={cn(
                    "text-6xl font-black mb-6 transition-all", 
                    scannerState.status === 'ERROR' ? 'text-red-600' : scannerState.status === 'SUCCESS' ? 'text-green-600' : 'text-slate-900'
                )}>
                    {scannerState.message}
                </h2>
                {scannerState.subMessage && <p className="text-3xl font-bold text-slate-700">{scannerState.subMessage}</p>}
                {scannerState.userData && <p className="text-xl text-slate-400 mt-4 font-bold">{scannerState.userData.affiliation}</p>}
            </div>

            <div className="mt-12 flex items-center gap-3 text-slate-300 font-black uppercase tracking-[0.3em]">
                <div className="w-2 h-2 rounded-full bg-slate-200 animate-ping" /> SCAN QR
            </div>
        </div>
    );
};
