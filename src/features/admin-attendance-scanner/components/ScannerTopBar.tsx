import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ScannerMode, Zone } from '../types';

interface ScannerTopBarProps {
    zones: Zone[];
    selectedZoneId: string;
    setSelectedZoneId: (id: string) => void;
    mode: ScannerMode;
    setMode: (mode: ScannerMode) => void;
}

export const ScannerTopBar: React.FC<ScannerTopBarProps> = ({
    zones,
    selectedZoneId,
    setSelectedZoneId,
    mode,
    setMode
}) => {
    const navigate = useNavigate();

    return (
        <div className="bg-slate-100 p-3 flex justify-between items-center border-b shadow-sm">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-500">
                <X className="w-4 h-4 mr-1" /> Close
            </Button>
            <div className="flex gap-4 items-center">
                <select 
                    value={selectedZoneId} 
                    onChange={e => setSelectedZoneId(e.target.value)} 
                    className="bg-white border rounded p-1 font-bold text-sm"
                >
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
                <div className="flex bg-white rounded p-0.5 border shadow-inner">
                    {(['ENTER_ONLY', 'EXIT_ONLY', 'AUTO'] as const).map(m => (
                        <button 
                            key={m} 
                            onClick={() => setMode(m)} 
                            className={`px-4 py-1 rounded text-[10px] font-black transition-all ${
                                mode === m ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'
                            }`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
