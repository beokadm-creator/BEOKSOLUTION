import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { useVendor } from '../../hooks/useVendor';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Camera, Keyboard, AlertCircle, CheckCircle2, Monitor, ChevronLeft } from 'lucide-react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function VendorScannerPage({ mode }: { mode: 'camera' | 'external' }) {
    const { vendorId: paramVendorId } = useParams<{ vendorId: string }>();
    const { activeVendorId } = useOutletContext<{ activeVendorId?: string | null }>();
    const resolvedVendorId = activeVendorId || paramVendorId;
    const vendorLogic = useVendor(resolvedVendorId);

    const {
        vendor,
        conferences,
        conferenceId,
        setConferenceId,
        scanBadge,
        scanResult,
        processVisit,
        conferenceFeatures,
        loading,
        error,
    } = vendorLogic;

    const [qrInput, setQrInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [showGuestbookPopup, setShowGuestbookPopup] = useState(false);
    const [guestbookMessage, setGuestbookMessage] = useState('');

    // Camera Scan State
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    type ScanUser = {
        affiliation?: string;
        organization?: string;
        affiliations?: unknown;
        name?: string;
    };

    type ScanReg = {
        affiliation?: string;
        organization?: string;
        type?: string;
        category?: string;
    };

    const getAffiliationLabel = (user: ScanUser, reg: ScanReg) => {
        const affiliations = user.affiliations;
        if (Array.isArray(affiliations)) {
            const first = affiliations[0];
            if (first && typeof first === 'object' && 'name' in first) {
                const name = (first as { name?: string }).name;
                if (name) return name;
            }
        }
        if (affiliations && typeof affiliations === 'object') {
            const record = affiliations as Record<string, { name?: string }>;
            const firstKey = Object.keys(record)[0];
            if (firstKey && record[firstKey]?.name) {
                return record[firstKey].name || '-';
            }
        }

        return user.affiliation || reg.affiliation || reg.organization || '-';
    };

    const getRegistrationLabel = (reg: ScanReg) => {
        return reg.type || reg.category || '-';
    };

    useEffect(() => {
        // Stop scanner on unmount
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(err => console.error("Scanner stop fail on unmount:", err));
            }
        };
    }, []);

    useEffect(() => {
        if (!isScanning) {
            inputRef.current?.focus();
        }
    }, [scanResult, isScanning, loading]);

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (qrInput.trim()) {
            scanBadge(qrInput.trim());
            setQrInput('');
        }
    };

    const handleAgree = () => {
        if (conferenceFeatures.guestbookEnabled) {
            setShowGuestbookPopup(true);
            return;
        }
        processVisit(true);
    };

    const submitGuestbook = async (message: string) => {
        await processVisit(true, message);
        setGuestbookMessage('');
        setShowGuestbookPopup(false);
    };

    const stopScanner = useCallback(() => {
        if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
                scannerRef.current = null;
                setIsScanning(false);
            }).catch(err => {
                console.error("Scanner stop fail:", err);
                setIsScanning(false);
            });
        }
    }, []);

    const startScanner = useCallback(() => {
        if (mode === 'external') return; // Prevent camera in external mode
        if (isScanning) return;
        setIsScanning(true);
        setCameraError(null);

        setTimeout(() => {
            if (!scannerRef.current) {
                const html5QrCode = new Html5Qrcode("vendor-reader");
                scannerRef.current = html5QrCode;

                html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText) => {
                        scanBadge(decodedText);
                        stopScanner(); // Stop after successful scan
                    },
                    () => {
                        // ignore general frame scan errors
                    }
                ).catch((err) => {
                    console.error("Camera fail:", err);
                    setCameraError("카메라 접근에 실패했습니다. 권한을 확인해주세요.");
                    setIsScanning(false);
                });
            }
        }, 300);
    }, [mode, isScanning, scanBadge, stopScanner]);


    // Auto-start camera if in camera mode and not currently showing a result/error
    useEffect(() => {
        if (mode === 'camera' && !isScanning && !scanResult && !error && !cameraError) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            startScanner();
        }
    }, [mode, isScanning, scanResult, error, cameraError, startScanner]);

    if (mode === 'camera') {
        return (
            <div className="flex flex-col h-full w-full bg-black text-white relative">
                {/* Mobile Header */}
                <div className="flex justify-between items-center p-4 bg-gray-900 shadow-md z-10 shrink-0">
                    <button onClick={() => window.history.back()} className="flex items-center text-gray-300 hover:text-white transition-colors">
                        <ChevronLeft className="w-7 h-7 -ml-2" />
                        <span className="font-bold text-lg">목록으로</span>
                    </button>
                    {conferences.length > 0 && (
                        <select
                            value={conferenceId || ''}
                            onChange={e => setConferenceId(e.target.value)}
                            className="bg-gray-800 text-white border-0 rounded-lg text-sm py-2 px-3 focus:ring-1 focus:ring-indigo-500 font-bold max-w-[150px] truncate"
                        >
                            {conferences.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>

                {/* Error Toast */}
                {error && (
                    <div className="absolute top-20 left-4 right-4 z-50 bg-red-600/95 backdrop-blur text-white px-5 py-4 rounded-2xl flex items-start gap-3 shadow-2xl animate-in fade-in slide-in-from-top-4">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm font-bold leading-relaxed">{error}</div>
                        <button onClick={() => vendorLogic.resetScan()} className="text-white/70 hover:text-white p-1 bg-red-700 rounded-full">✕</button>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 relative flex flex-col items-center justify-center p-6 overflow-y-auto">
                    {!scanResult ? (
                        <>
                            <div className="w-full max-w-sm rounded-[2rem] overflow-hidden border-4 border-indigo-500/30 bg-gray-800 relative aspect-[3/4] flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.2)]">
                                {!isScanning && !cameraError && (
                                    <div className="text-gray-400 flex flex-col items-center animate-pulse">
                                        <Camera className="w-12 h-12 mb-3 opacity-50 text-indigo-400" />
                                        <p className="font-bold tracking-wide">카메라 기동 중...</p>
                                    </div>
                                )}
                                <div id="vendor-reader" className="absolute inset-0 w-full h-full object-cover [&>video]:object-cover [&>video]:h-full"></div>
                                {cameraError && <p className="text-red-400 text-sm font-bold p-6 text-center z-10 bg-black/80 absolute inset-0 flex items-center justify-center">{cameraError}</p>}

                                {isScanning && !cameraError && (
                                    <div className="absolute inset-0 pointer-events-none border-[3px] border-indigo-500/50 m-12 rounded-3xl">
                                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white -mt-1 -ml-1 rounded-tl-lg"></div>
                                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white -mt-1 -mr-1 rounded-tr-lg"></div>
                                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white -mb-1 -ml-1 rounded-bl-lg"></div>
                                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white -mb-1 -mr-1 rounded-br-lg"></div>
                                    </div>
                                )}
                            </div>

                            <p className="mt-10 text-center text-gray-400 font-bold tracking-wide">
                                참관객 명찰의 바코드를 화면 중앙에 맞춰주세요
                            </p>
                        </>
                    ) : (
                        <div className="w-full max-w-sm bg-gray-900 rounded-[2rem] overflow-hidden border border-gray-800 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                            <div className="bg-indigo-600/20 p-8 text-center border-b border-indigo-500/20 relative">
                                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent"></div>
                                <CheckCircle2 className="w-20 h-20 text-indigo-400 mx-auto mb-4 relative z-10 animate-bounce" />
                                <h2 className="text-2xl font-black text-white tracking-tight relative z-10">스캔 성공!</h2>
                                <p className="text-indigo-200 mt-2 text-sm font-bold relative z-10">방문자 정보를 확인하고 저장해주세요.</p>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="bg-gray-800/80 rounded-2xl border border-gray-700/50 p-5 space-y-4">
                                    <div className="grid grid-cols-[100px_1fr] gap-y-4 text-sm items-center">
                                        <div className="text-gray-400 font-bold">이름</div>
                                        <div className="font-bold text-white text-right text-lg">{scanResult.user.name || '알 수 없음'}</div>

                                        <div className="text-gray-400 font-bold">소속</div>
                                        <div className="font-medium text-gray-300 text-right leading-tight">
                                            {getAffiliationLabel(scanResult.user, scanResult.reg)}
                                        </div>

                                        <div className="text-gray-400 font-bold">등록 타입</div>
                                        <div className="font-bold text-indigo-300 text-right uppercase">
                                            {getRegistrationLabel(scanResult.reg)}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-indigo-950/50 p-4 rounded-xl flex items-start gap-3 text-sm text-indigo-200 border border-indigo-900/50">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-indigo-400" />
                                    <div>
                                        <p className="font-bold mb-1 text-indigo-300">개인정보 제공 동의</p>
                                        <p className="leading-tight">방문객이 해당 업체(<span className="text-white font-bold">{vendor?.name}</span>)에 연락처 등 정보를 제공하는 것에 동의합니까?</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 grid grid-cols-2 gap-3 bg-gray-950">
                                <Button
                                    variant="outline"
                                    className="py-7 text-sm font-bold text-gray-400 border-gray-800 bg-gray-900 hover:bg-gray-800 hover:text-white rounded-xl"
                                    onClick={() => processVisit(false)}
                                    disabled={loading}
                                >
                                    동의 거부<br />(익명 스탬프)
                                </Button>
                                <Button
                                    className="py-7 text-sm font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20"
                                    onClick={handleAgree}
                                    disabled={loading}
                                >
                                    동의 및 저장
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                {loading && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100]">
                        <LoadingSpinner text="처리 중..." />
                    </div>
                )}
                <Dialog open={showGuestbookPopup} onOpenChange={setShowGuestbookPopup}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>방명록 남기기</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <p className="text-sm text-gray-500">동의가 완료되었습니다. 파트너 방명록 메시지를 남겨주세요.</p>
                            <textarea
                                value={guestbookMessage}
                                onChange={(e) => setGuestbookMessage(e.target.value)}
                                className="w-full h-28 border border-gray-200 rounded-lg p-3 text-sm"
                                placeholder="예: 제품 설명 잘 들었습니다. 연락 부탁드립니다."
                            />
                        </div>
                        <DialogFooter className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => submitGuestbook('')}
                                className="flex-1"
                            >
                                메시지 없이 저장
                            </Button>
                            <Button
                                onClick={() => submitGuestbook(guestbookMessage)}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                저장
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Lead Scanner</h1>
                    <p className="text-sm text-gray-500">외부 바코드 리더기를 사용하여 방명록을 스캔합니다.</p>
                </div>
                {conferences.length > 0 && (
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-500 uppercase font-semibold">Campaign Mode</span>
                        <select
                            value={conferenceId || ''}
                            onChange={e => setConferenceId(e.target.value)}
                            className="bg-indigo-50 border border-indigo-200 text-sm font-semibold rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-indigo-700 py-1.5 px-3"
                        >
                            {conferences.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <strong className="block font-bold">Error</strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                    <button onClick={() => vendorLogic.resetScan()} className="text-red-500 hover:text-red-700">✕</button>
                </div>
            )}

            {!scanResult ? (
                <Card className="shadow-lg border-t-4 border-t-blue-600">
                    <CardHeader className="text-center pb-4">
                        <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <Monitor className="w-8 h-8" />
                        </div>
                        <CardTitle>외부 바코드 리더기 모드</CardTitle>
                        <CardDescription>
                            커서를 아래 텍스트 박스에 두고 바코드를 스캔하세요.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center gap-4">
                            <form onSubmit={handleScan} className="w-full flex gap-2">
                                <div className="relative flex-1">
                                    <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={qrInput}
                                        onChange={e => setQrInput(e.target.value)}
                                        placeholder="여기를 클릭하고 스캔..."
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        autoFocus
                                    />
                                </div>
                                <Button type="submit" variant="secondary" className="px-6 h-auto" disabled={loading}>
                                    {loading ? <LoadingSpinner text="로딩 중..." /> : 'Enter'}
                                </Button>
                            </form>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="shadow-lg border-t-4 border-t-green-500 overflow-hidden animate-in slide-in-from-bottom-4">
                    <div className="bg-green-50 p-6 text-center border-b border-green-100">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
                        <h2 className="text-2xl font-bold text-green-800">Badge Scanned Successfully!</h2>
                        <p className="text-green-600 mt-1">Please confirm visitor details to save lead.</p>
                    </div>

                    <CardContent className="p-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div className="text-gray-500">Name</div>
                                <div className="font-bold text-gray-900 text-right">{scanResult.user.name || 'N/A'}</div>

                                <div className="text-gray-500">Affiliation</div>
                                <div className="font-medium text-gray-900 text-right">
                                    {getAffiliationLabel(scanResult.user, scanResult.reg)}
                                </div>

                                <div className="text-gray-500">Registration Type</div>
                                <div className="font-medium text-gray-900 text-right uppercase">
                                    {getRegistrationLabel(scanResult.reg)}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 bg-blue-50 p-4 rounded-lg flex items-start gap-3 text-sm text-blue-800">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
                            <div>
                                <p className="font-bold mb-1">Information Privacy Consent</p>
                                <p>Does the visitor consent to providing their contact information (Email/Phone) to {vendor?.name}?</p>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="bg-gray-50 p-6 flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1 py-6 text-base font-bold text-gray-600 border-gray-300"
                            onClick={() => processVisit(false)}
                            disabled={loading}
                        >
                            Decline (Stamp Only)
                        </Button>
                        <Button
                            className="flex-1 py-6 text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={handleAgree}
                            disabled={loading}
                        >
                            Accept & Save Lead
                        </Button>
                    </CardFooter>
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                            <LoadingSpinner />
                        </div>
                    )}
                </Card>
            )}
            <Dialog open={showGuestbookPopup} onOpenChange={setShowGuestbookPopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>방명록 남기기</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-sm text-gray-500">동의가 완료되었습니다. 파트너 방명록 메시지를 남겨주세요.</p>
                        <textarea
                            value={guestbookMessage}
                            onChange={(e) => setGuestbookMessage(e.target.value)}
                            className="w-full h-28 border border-gray-200 rounded-lg p-3 text-sm"
                            placeholder="예: 제품 설명 잘 들었습니다. 연락 부탁드립니다."
                        />
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => submitGuestbook('')}
                            className="flex-1"
                        >
                            메시지 없이 저장
                        </Button>
                        <Button
                            onClick={() => submitGuestbook(guestbookMessage)}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            저장
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
