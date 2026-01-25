import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../../../../store/adminStore';
import { doc, getDoc, updateDoc, Timestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { Loader2, ArrowLeft, CheckCircle, AlertCircle, Printer, X, Settings, Palette } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// Types
interface ScannerState {
    status: 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
    message: string;
    subMessage?: string;
    lastScanned: string;
    userData?: {
        name: string;
        affiliation: string;
    };
}

interface DesignConfig {
    bgImage: string | null;
    textColor: string;
    fontSize: 'normal' | 'large';
}

interface IssueOption {
    label: string;
    value: 'DIGITAL_ONLY' | 'DIGITAL_PRINT' | 'PRINT_ONLY';
}

const InfoDeskKioskPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedConferenceId, selectedConferenceSlug } = useAdminStore();
    const [loading, setLoading] = useState(true);
    
    // Config
    const [conferenceTitle, setConferenceTitle] = useState('');
    const [conferenceSubtitle, setConferenceSubtitle] = useState('');
    
    // Info Desk Settings
    const [issueOption, setIssueOption] = useState<IssueOption['value']>('DIGITAL_PRINT');
    
    // Design State
    const [showSettings, setShowSettings] = useState(false);
    const [design, setDesign] = useState<DesignConfig>(() => {
        const saved = localStorage.getItem('infodesk_design');
        return saved ? JSON.parse(saved) : { bgImage: null, textColor: '#000000', fontSize: 'normal' };
    });
    
    // Scanner State
    const [scannerState, setScannerState] = useState<ScannerState>({
        status: 'IDLE',
        message: 'Ready to Scan',
        lastScanned: ''
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');

    // Load Data
    useEffect(() => {
        if (!selectedConferenceId) return;
        const init = async () => {
            try {
                // 1. Conf Info
                const confRef = doc(db, 'conferences', selectedConferenceId);
                const confSnap = await getDoc(confRef);
                if (confSnap.exists()) {
                    setConferenceTitle(confSnap.data().title?.ko || 'Conference');
                    setConferenceSubtitle(confSnap.data().subtitle || '');
                }
            } catch (e) {
                console.error(e);
                toast.error("Failed to load kiosk config");
            } finally {
                setLoading(false);
            }
        };
        init();
        
        // Load Option
        const savedOption = localStorage.getItem('infodesk_option');
        if (savedOption) setIssueOption(savedOption as any);

        setTimeout(() => inputRef.current?.focus(), 500);
    }, [selectedConferenceId]);

    // Save Design & Option
    useEffect(() => {
        localStorage.setItem('infodesk_design', JSON.stringify(design));
    }, [design]);
    
    useEffect(() => {
        localStorage.setItem('infodesk_option', issueOption);
    }, [issueOption]);

    // Keep focus
    const handleBlur = () => {
        if (!showSettings) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    // PROCESS SCAN (ISSUANCE LOGIC)
    const processScan = async (code: string) => {
        if (scannerState.status === 'PROCESSING') return;
        
        setScannerState({ status: 'PROCESSING', message: 'Verifying...', lastScanned: code });

        try {
            const regRef = doc(db, 'registrations', code);
            const regSnap = await getDoc(regRef);

            if (!regSnap.exists()) {
                throw new Error("Invalid Registration Code");
            }

            const regData = regSnap.data();
            if (regData.status !== 'PAID') {
                throw new Error("Registration NOT PAID");
            }
            if (regData.slug !== selectedConferenceSlug) {
                throw new Error("Wrong Conference");
            }

            const userName = regData.userName || 'Unknown';
            const userAffiliation = regData.affiliation || regData.userEmail || '';
            
            // Logic: Issue Badge
            // 1. Update Registration
            await updateDoc(regRef, {
                badgeIssued: true,
                badgeIssuedAt: Timestamp.now(),
                badgeType: issueOption
            });

            // 2. Log Action
            await addDoc(collection(db, `registrations/${code}/logs`), {
                type: 'BADGE_ISSUED',
                timestamp: Timestamp.now(),
                method: 'KIOSK_INFODESK',
                option: issueOption
            });

            // 3. Trigger Print (Mock)
            if (issueOption !== 'DIGITAL_ONLY') {
                // In real world, send to print server or local print agent
                console.log(`[PRINT REQUEST] ${userName} (${code})`);
                toast.success("Printing Requested...", { icon: '🖨️' });
            }

            // Success
            setScannerState({ 
                status: 'SUCCESS', 
                message: '명찰이 정상적으로 발급되었습니다.', 
                subMessage: userName, 
                lastScanned: code,
                userData: { name: userName, affiliation: userAffiliation }
            });
            
        } catch (e: any) {
            console.error(e);
            setScannerState({ 
                status: 'ERROR', 
                message: e.message || 'Scan Failed', 
                lastScanned: code 
            });
        }

        setTimeout(() => {
            setScannerState(prev => prev.status === 'PROCESSING' ? prev : { ...prev, status: 'IDLE', message: 'Ready' });
            setInputValue('');
        }, 3000); // 3s delay
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (inputValue.trim()) {
                processScan(inputValue.trim());
            }
        }
    };

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setDesign(prev => ({ ...prev, bgImage: ev.target!.result as string }));
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    if (loading) return <div>Loading Kiosk...</div>;

    return (
        <div 
            className="fixed inset-0 z-[99999] flex flex-col font-sans transition-colors duration-500 bg-white"
            style={{ 
                backgroundImage: design.bgImage ? `url(${design.bgImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: design.textColor 
            }}
        >
            {/* Top Admin Console */}
            <div className="fixed top-0 left-0 right-0 bg-black/80 text-white p-3 z-[10000] flex justify-between items-center backdrop-blur-md shadow-lg">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-yellow-400 flex items-center gap-2">
                        <Printer className="w-4 h-4" /> INFO DESK
                    </span>
                    
                    <div className="flex bg-gray-700 rounded p-1">
                        {[
                            { l: '디지털만', v: 'DIGITAL_ONLY' },
                            { l: '디지털+인쇄', v: 'DIGITAL_PRINT' },
                            { l: '인쇄만', v: 'PRINT_ONLY' }
                        ].map(opt => (
                            <button
                                key={opt.v}
                                onClick={() => setIssueOption(opt.v as any)}
                                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                                    issueOption === opt.v ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {opt.l}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className="text-gray-300 hover:text-white hover:bg-white/10">
                        <Palette className="w-4 h-4 mr-2" /> Style
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => navigate(-1)} className="text-xs">
                        <X className="w-4 h-4 mr-1" /> Exit
                    </Button>
                </div>
            </div>

            {/* Design Settings Modal */}
            {showSettings && (
                <div className="fixed top-16 right-4 bg-white text-black p-4 rounded-lg shadow-xl z-[10001] w-80 border border-gray-200 animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Kiosk Design
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Background Image</label>
                            <input type="file" accept="image/*" onChange={handleBgUpload} className="text-sm w-full" />
                            {design.bgImage && (
                                <Button variant="outline" size="sm" className="mt-2 w-full text-xs" onClick={() => setDesign(prev => ({ ...prev, bgImage: null }))}>
                                    Clear Image
                                </Button>
                            )}
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Text Color</label>
                            <div className="flex gap-2">
                                <input 
                                    type="color" 
                                    value={design.textColor} 
                                    onChange={(e) => setDesign(prev => ({ ...prev, textColor: e.target.value }))}
                                    className="h-8 w-16 p-0 border-0" 
                                />
                                <div className="flex-1 flex gap-1">
                                    <button onClick={() => setDesign(prev => ({ ...prev, textColor: '#000000' }))} className="w-8 h-8 bg-black rounded-full border border-gray-200" />
                                    <button onClick={() => setDesign(prev => ({ ...prev, textColor: '#ffffff' }))} className="w-8 h-8 bg-white rounded-full border border-gray-200" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative mt-16">
                
                {/* Header */}
                <div className="mb-12 drop-shadow-lg">
                    <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                        {conferenceTitle}
                    </h1>
                    <p className="text-2xl md:text-3xl opacity-90 font-light">{conferenceSubtitle}</p>
                </div>

                {/* Main Instruction Card */}
                <div className={`p-10 rounded-3xl w-full max-w-3xl shadow-2xl backdrop-blur-sm border transition-all duration-500 ${
                    design.bgImage ? 'bg-black/40 border-white/20 text-white' : 
                    'bg-green-50 border-green-200 text-green-900'
                }`}>
                    <h2 className="text-5xl font-black mb-6">
                        등록 확인 및 명찰 발급
                    </h2>
                    
                    <p className="opacity-80 mb-8 text-2xl font-medium">
                        등록 교환권(QR)을 스캐너에 인식시켜주세요.
                        <br/>(Please scan your Registration Voucher)
                    </p>
                    
                    <div className="animate-pulse mt-8">
                        <Printer className="w-16 h-16 mx-auto opacity-50" />
                    </div>
                </div>

                {/* Processing Indicator */}
                {scannerState.status === 'PROCESSING' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[50000] backdrop-blur-sm">
                        <div className="bg-white p-8 rounded-2xl flex flex-col items-center">
                            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mb-4" />
                            <p className="text-xl font-bold text-gray-800">발급 처리중...</p>
                        </div>
                    </div>
                )}

                {/* Result Overlay (Success/Error) */}
                {(scannerState.status === 'SUCCESS' || scannerState.status === 'ERROR') && (
                    <div className={`absolute inset-0 z-[60000] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 ${
                        scannerState.status === 'SUCCESS' ? 'bg-green-600' : 'bg-red-600'
                    } text-white`}>
                        {scannerState.status === 'SUCCESS' ? (
                            <CheckCircle className="w-40 h-40 mb-8 drop-shadow-lg" />
                        ) : (
                            <AlertCircle className="w-40 h-40 mb-8 drop-shadow-lg" />
                        )}
                        
                        <h2 className="text-6xl font-black mb-4 drop-shadow-md">{scannerState.message}</h2>
                        
                        {scannerState.userData && (
                            <div className="mt-12 text-center bg-white/10 p-12 rounded-3xl backdrop-blur-md border border-white/20 w-full max-w-4xl shadow-2xl">
                                <div className="text-7xl font-black mb-6 tracking-tight">{scannerState.userData.name}</div>
                                <div className="text-4xl opacity-90 font-light">{scannerState.userData.affiliation}</div>
                            </div>
                        )}

                        {scannerState.status === 'ERROR' && (
                            <div className="mt-6 text-3xl opacity-90 font-medium bg-black/20 px-8 py-4 rounded-xl">
                                {scannerState.message}
                            </div>
                        )}
                    </div>
                )}

                {/* Hidden Input */}
                <input 
                    ref={inputRef}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    className="absolute opacity-0 w-1 h-1 top-0 left-0"
                    autoFocus
                />
            </div>
        </div>
    );
};

export default InfoDeskKioskPage;
