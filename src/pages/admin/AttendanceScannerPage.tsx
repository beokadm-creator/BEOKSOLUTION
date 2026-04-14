import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ScannerMode } from '../../features/admin-attendance-scanner/types';
import { useScannerSettings } from '../../features/admin-attendance-scanner/hooks/useScannerSettings';
import { useBarcodeScanner } from '../../features/admin-attendance-scanner/hooks/useBarcodeScanner';
import { ScannerTopBar } from '../../features/admin-attendance-scanner/components/ScannerTopBar';
import { ScannerStatusDisplay } from '../../features/admin-attendance-scanner/components/ScannerStatusDisplay';

const AttendanceScannerPage: React.FC = () => {
    const { cid } = useParams<{ cid: string }>();
    const [selectedZoneId, setSelectedZoneId] = useState<string>('');
    const [mode, setMode] = useState<ScannerMode>('ENTER_ONLY');

    const { loading, zones, conferenceTitle, conferenceSubtitle } = useScannerSettings(cid);

    if (zones.length > 0 && !selectedZoneId) {
        setSelectedZoneId(zones[0].id);
    }

    const {
        scannerState,
        inputRef,
        inputValue,
        setInputValue,
        handleKeyDown,
        handleBlur
    } = useBarcodeScanner(cid, selectedZoneId, mode, zones);

    if (loading) return <div className="p-20 text-center font-bold animate-pulse">Initializing Kiosk...</div>;

    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col font-sans">
            <ScannerTopBar 
                zones={zones}
                selectedZoneId={selectedZoneId}
                setSelectedZoneId={setSelectedZoneId}
                mode={mode}
                setMode={setMode}
            />

            <div className="flex-1 relative flex flex-col">
                <ScannerStatusDisplay 
                    conferenceTitle={conferenceTitle}
                    conferenceSubtitle={conferenceSubtitle}
                    zones={zones}
                    selectedZoneId={selectedZoneId}
                    mode={mode}
                    scannerState={scannerState}
                />

                <input 
                    ref={inputRef} 
                    value={inputValue} 
                    onChange={e => setInputValue(e.target.value)} 
                    onKeyDown={handleKeyDown} 
                    onBlur={handleBlur} 
                    className="absolute opacity-0 pointer-events-none" 
                    autoFocus 
                />
            </div>
        </div>
    );
};

export default AttendanceScannerPage;
