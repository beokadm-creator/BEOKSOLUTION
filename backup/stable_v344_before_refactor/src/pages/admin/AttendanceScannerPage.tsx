import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { doc, getDoc, updateDoc, Timestamp, addDoc, collection, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { Loader2, ArrowLeft, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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

const AttendanceScannerPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedConferenceId, selectedConferenceSlug } = useAdminStore();
    const [loading, setLoading] = useState(true);
    
    // Config
    const [zones, setZones] = useState<any[]>([]);
    const [selectedZoneId, setSelectedZoneId] = useState<string>('');
    const [mode, setMode] = useState<'ENTER_ONLY' | 'EXIT_ONLY' | 'AUTO'>('ENTER_ONLY');
    const [conferenceTitle, setConferenceTitle] = useState('');
    const [conferenceSubtitle, setConferenceSubtitle] = useState('');
    
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

                // 2. Fetch ALL Zones from ALL Dates (Flattened)
                const rulesRef = doc(db, `conferences/${selectedConferenceId}/settings/attendance`);
                const rulesSnap = await getDoc(rulesRef);
                if (rulesSnap.exists()) {
                    const allRules = rulesSnap.data().rules || {};
                    let allZones: any[] = [];
                    Object.values(allRules).forEach((rule: any) => {
                        if (rule.zones) {
                            allZones = [...allZones, ...rule.zones];
                        }
                    });
                    
                    // Deduplicate by ID
                    const uniqueZones = Array.from(new Map(allZones.map(item => [item.id, item])).values());
                    setZones(uniqueZones);
                    if (uniqueZones.length > 0) setSelectedZoneId(uniqueZones[0].id);
                }
            } catch (e) {
                console.error(e);
                toast.error("Failed to load scanner config");
            } finally {
                setLoading(false);
            }
        };
        init();
        
        setTimeout(() => inputRef.current?.focus(), 500);
    }, [selectedConferenceId]);

    // Keep focus
    const handleBlur = () => {
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    // PROCESS SCAN
    const processScan = async (code: string) => {
        if (scannerState.status === 'PROCESSING') return;
        if (!selectedZoneId) {
            setScannerState({ status: 'ERROR', message: 'No Zone Selected', lastScanned: code });
            return;
        }

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
            const currentStatus = regData.attendanceStatus || 'OUTSIDE';
            const currentZone = regData.currentZone;

            // 2. Logic Switch
            let action = '';
            
            if (mode === 'ENTER_ONLY') {
                if (currentStatus === 'INSIDE') {
                    if (currentZone === selectedZoneId) throw new Error(`${userName} Already Inside`);
                    // Auto-Switch
                    await performCheckOut(code, currentZone, regData.lastCheckIn);
                    await performCheckIn(code, selectedZoneId);
                    action = 'Switched & Checked In';
                } else {
                    await performCheckIn(code, selectedZoneId);
                    action = '입장 완료 (Checked In)';
                }
            } 
            else if (mode === 'EXIT_ONLY') {
                if (currentStatus !== 'INSIDE') throw new Error(`${userName} Not Entered`);
                await performCheckOut(code, currentZone, regData.lastCheckIn);
                action = '퇴장 완료 (Checked Out)';
            }
            else if (mode === 'AUTO') {
                if (currentStatus === 'INSIDE') {
                    if (currentZone !== selectedZoneId) {
                        await performCheckOut(code, currentZone, regData.lastCheckIn);
                        await performCheckIn(code, selectedZoneId);
                        action = 'Zone Switched';
                    } else {
                        await performCheckOut(code, currentZone, regData.lastCheckIn);
                        action = '퇴장 완료 (Checked Out)';
                    }
                } else {
                    await performCheckIn(code, selectedZoneId);
                    action = '입장 완료 (Checked In)';
                }
            }

            // Success
            setScannerState({ 
                status: 'SUCCESS', 
                message: action, 
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
        }, 3000); // 3s delay for readability
    };

    const performCheckIn = async (id: string, zoneId: string) => {
        await updateDoc(doc(db, 'registrations', id), {
            attendanceStatus: 'INSIDE',
            currentZone: zoneId,
            lastCheckIn: Timestamp.now()
        });
        await addDoc(collection(db, `registrations/${id}/logs`), {
            type: 'ENTER', zoneId, timestamp: Timestamp.now(), method: 'KIOSK'
        });
    };

    const performCheckOut = async (id: string, zoneId: string, lastIn: any) => {
        const now = new Date();
        const start = lastIn?.toDate() || now;
        const diffMins = Math.floor((now.getTime() - start.getTime()) / 60000);
        
        await updateDoc(doc(db, 'registrations', id), {
            attendanceStatus: 'OUTSIDE',
            currentZone: null,
            totalMinutes: increment(diffMins),
            lastCheckOut: Timestamp.now()
        });
        await addDoc(collection(db, `registrations/${id}/logs`), {
            type: 'EXIT', zoneId, timestamp: Timestamp.now(), method: 'KIOSK', recognizedMinutes: diffMins
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (inputValue.trim()) {
                processScan(inputValue.trim());
            }
        }
    };

    if (loading) return <div>Loading Kiosk...</div>;

    const getModeColor = () => {
        if (mode === 'ENTER_ONLY') return 'bg-blue-600';
        if (mode === 'EXIT_ONLY') return 'bg-red-600';
        return 'bg-purple-600';
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col font-sans">
            {/* Top Control Bar (Admin Only) */}
            <div className="bg-gray-100 p-2 flex justify-between items-center border-b">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-gray-500">
                    <X className="w-4 h-4 mr-1" /> Exit Kiosk
                </Button>
                <div className="flex gap-2">
                    <select 
                        value={selectedZoneId} 
                        onChange={e => setSelectedZoneId(e.target.value)}
                        className="text-sm border rounded p-1"
                    >
                        {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative">
                
                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">{conferenceTitle}</h1>
                    <p className="text-2xl text-gray-500">{conferenceSubtitle}</p>
                </div>

                {/* Mode Display */}
                <div className={`p-8 rounded-3xl w-full max-w-2xl shadow-2xl transition-colors duration-500 ${
                    mode === 'ENTER_ONLY' ? 'bg-blue-50 border-4 border-blue-200' :
                    mode === 'EXIT_ONLY' ? 'bg-red-50 border-4 border-red-200' :
                    'bg-purple-50 border-4 border-purple-200'
                }`}>
                    <h2 className={`text-4xl font-black mb-4 ${
                        mode === 'ENTER_ONLY' ? 'text-blue-700' :
                        mode === 'EXIT_ONLY' ? 'text-red-700' :
                        'text-purple-700'
                    }`}>
                        {mode === 'ENTER_ONLY' && '입장 모드 (CHECK-IN)'}
                        {mode === 'EXIT_ONLY' && '퇴장 모드 (CHECK-OUT)'}
                        {mode === 'AUTO' && '자동 모드 (AUTO)'}
                    </h2>
                    
                    <p className="text-gray-500 mb-8 text-lg">
                        명찰의 QR 코드를 스캐너에 대주세요.
                        <br/>(Please scan your QR code)
                    </p>

                    {/* Mode Toggle Buttons */}
                    <div className="flex justify-center gap-4">
                        {mode !== 'ENTER_ONLY' && (
                            <Button 
                                onClick={() => setMode('ENTER_ONLY')}
                                className="bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 h-12 text-lg"
                            >
                                입장 모드로 변경 (Switch to Enter)
                            </Button>
                        )}
                        {mode !== 'EXIT_ONLY' && (
                            <Button 
                                onClick={() => setMode('EXIT_ONLY')}
                                className="bg-white text-red-600 border border-red-200 hover:bg-red-50 h-12 text-lg"
                            >
                                퇴장 모드로 변경 (Switch to Exit)
                            </Button>
                        )}
                    </div>
                </div>

                {/* Processing Indicator */}
                {scannerState.status === 'PROCESSING' && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-40">
                        <Loader2 className="w-24 h-24 animate-spin text-gray-400" />
                    </div>
                )}

                {/* Result Overlay */}
                {(scannerState.status === 'SUCCESS' || scannerState.status === 'ERROR') && (
                    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 ${
                        scannerState.status === 'SUCCESS' ? getModeColor() : 'bg-red-600'
                    } text-white`}>
                        {scannerState.status === 'SUCCESS' ? (
                            <CheckCircle className="w-32 h-32 mb-8" />
                        ) : (
                            <AlertCircle className="w-32 h-32 mb-8" />
                        )}
                        
                        <h2 className="text-5xl font-bold mb-4">{scannerState.message}</h2>
                        
                        {scannerState.userData && (
                            <div className="mt-8 text-center bg-white/10 p-8 rounded-xl backdrop-blur-sm w-full max-w-3xl">
                                <div className="text-6xl font-black mb-4">{scannerState.userData.name}</div>
                                <div className="text-3xl opacity-90">{scannerState.userData.affiliation}</div>
                            </div>
                        )}

                        {scannerState.status === 'ERROR' && (
                            <div className="mt-4 text-2xl opacity-80">{scannerState.message}</div>
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

export default AttendanceScannerPage;
